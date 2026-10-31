import { assertDeliveryAdmin, getDriveAccessToken, supabaseServiceRequest } from './_lib/driveAuth.js';
import { safeFileName } from './_lib/fileName.js';

type VercelRequest = any;
type VercelResponse = any;

function json(res: VercelResponse, status: number, body: unknown) {
  return res.status(status).setHeader('content-type', 'application/json; charset=utf-8').setHeader('cache-control', 'no-store').end(JSON.stringify(body));
}

function supabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
  if (!url || !key) throw new Error('Protected delivery server configuration is missing.');
  return { url: url.replace(/\/$/, ''), key };
}

async function rpc(name: string, body: Record<string, unknown>) {
  const { url, key } = supabaseConfig();
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error((await response.text()).slice(0, 400) || `Supabase RPC ${name} failed.`);
  return response.json();
}

function extractDriveId(sourceUrl: string, kind: 'file' | 'folder') {
  let parsed: URL;
  try { parsed = new URL(sourceUrl.trim()); } catch { return null; }
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'drive.google.com') return null;
  const pattern = kind === 'folder' ? /\/folders\/([A-Za-z0-9_-]+)/i : /\/file\/d\/([A-Za-z0-9_-]+)/i;
  return parsed.pathname.match(pattern)?.[1] || parsed.searchParams.get('id');
}

async function driveMetadata(id: string) {
  const token = await getDriveAccessToken();
  const fields = 'id,name,mimeType,size,fileExtension,thumbnailLink,modifiedTime,trashed,parents';
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=${encodeURIComponent(fields)}&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    if (response.status === 404) throw new Error('Google Drive file was not found or is not shared with the connected account.');
    if (response.status === 403) throw new Error('The connected account cannot access this private Drive item. Share it with that account; do not make it public.');
    throw new Error(`Google Drive metadata request failed (HTTP ${response.status}).`);
  }
  const data = await response.json();
  if (data.trashed) throw new Error('This Google Drive item is in the trash.');
  return data;
}

async function assertPortalAccess(adminToken: string, portalId: string) {
  await rpc('delivery_admin_list_files', { p_token: adminToken, p_portal_id: portalId });
}

async function startRawZipUpload(adminToken: string, portalId: string, fileName: string, fileSize: number) {
  if (!adminToken || !portalId || !fileName || !Number.isSafeInteger(fileSize) || fileSize < 1 || fileSize > 5 * 1024 ** 4) {
    throw new Error('Choose a non-empty ZIP file up to Google Drive’s 5 TB file limit.');
  }
  if (!/^[0-9a-f-]{36}$/i.test(portalId)) throw new Error('Invalid delivery ID.');
  if (!/\.zip$/i.test(fileName)) throw new Error('Only .zip files can be uploaded as RAW delivery files.');
  await assertDeliveryAdmin(adminToken);
  await assertPortalAccess(adminToken, portalId);
  const accessToken = await getDriveAccessToken();
  const metadata = { name: safeFileName(fileName, 'ramyachobi-raw.zip'), mimeType: 'application/zip' };
  const upload = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,size,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json; charset=UTF-8',
      'x-upload-content-type': 'application/zip',
      'x-upload-content-length': String(fileSize),
    },
    body: JSON.stringify(metadata),
  });
  if (!upload.ok) {
    if (upload.status === 403) throw new Error('Google Drive upload permission is missing. Reconnect Google Drive in Delivery Admin and grant file access.');
    throw new Error(`Google Drive could not start the ZIP upload (HTTP ${upload.status}).`);
  }
  const uploadUrl = upload.headers.get('location');
  if (!uploadUrl || !uploadUrl.startsWith('https://www.googleapis.com/upload/drive/')) throw new Error('Google Drive did not return a valid resumable upload session.');
  return { uploadUrl, fileName: metadata.name };
}

async function saveRawZipUpload(body: Record<string, any>) {
  const adminToken = String(body.adminToken || '').trim();
  const portalId = String(body.portalId || '').trim();
  const driveFileId = String(body.driveFileId || '').trim();
  const requestedName = String(body.fileName || '').trim();
  const title = String(body.title || '').trim().slice(0, 160);
  const sortOrder = Math.min(1000000, Math.max(0, Math.trunc(Number(body.sortOrder) || 0)));
  if (!adminToken || !portalId || !driveFileId || !requestedName) throw new Error('Admin session, delivery ID and uploaded ZIP details are required.');
  if (!/^[0-9a-f-]{36}$/i.test(portalId) || !/^[A-Za-z0-9_-]{10,200}$/.test(driveFileId)) throw new Error('Invalid delivery or Google Drive file ID.');
  if (!/\.zip$/i.test(requestedName)) throw new Error('Only ZIP files can be attached as RAW delivery files.');
  await assertPortalAccess(adminToken, portalId);
  const accessToken = await getDriveAccessToken();
  const metadataResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFileId)}?fields=id,name,mimeType,size,trashed&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!metadataResponse.ok) throw new Error(`Google Drive could not verify the uploaded ZIP (HTTP ${metadataResponse.status}).`);
  const metadata = await metadataResponse.json();
  if (metadata.trashed) throw new Error('The uploaded ZIP is in the Google Drive trash.');
  if (!/\.zip$/i.test(String(metadata.name || '')) || !['application/zip', 'application/x-zip-compressed', 'application/octet-stream'].includes(String(metadata.mimeType || ''))) {
    throw new Error('Google Drive upload is not a ZIP file.');
  }
  const fileName = safeFileName(String(metadata.name || requestedName), 'ramyachobi-raw.zip');
  const sourceUrl = `https://drive.google.com/file/d/${encodeURIComponent(driveFileId)}/view`;
  const saved: any = await rpc('delivery_admin_upsert_file', {
    p_token: adminToken, p_portal_id: portalId, p_file_id: null, p_source_url: sourceUrl,
    p_file_type: 'DOCUMENT', p_title: title || 'RAW photos & videos ZIP', p_file_name: fileName,
    p_mime_type: 'application/zip', p_sort_order: sortOrder, p_is_visible: true,
  });
  if (!saved?.id) throw new Error('The ZIP was uploaded but could not be linked to this delivery.');
  const update = await supabaseServiceRequest(`delivery_files?id=eq.${encodeURIComponent(String(saved.id))}&portal_id=eq.${encodeURIComponent(portalId)}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ file_size_bytes: Number(metadata.size || 0) }),
  });
  if (!update.ok) throw new Error('The ZIP is uploaded, but its file size could not be saved.');
  return { success: true, file: { ...saved, file_name: fileName, mime_type: 'application/zip', file_size_bytes: Number(metadata.size || 0) } };
}

function classifyFile(mime: string, fileName: string): 'PHOTO' | 'VIDEO' | 'DOCUMENT' {
  const name = fileName.toLowerCase();
  const imageExt = ['.jpg','.jpeg','.png','.webp','.gif','.heic','.heif','.tif','.tiff','.bmp','.raw','.arw','.cr2','.cr3','.nef','.dng','.raf','.orf','.rw2','.pef','.srw','.3fr','.iiq'];
  const videoExt = ['.mp4','.mov','.m4v','.avi','.mkv','.webm','.wmv','.flv','.mpeg','.mpg','.3gp'];
  if (mime.startsWith('image/') || (mime === 'application/octet-stream' && imageExt.some(x => name.endsWith(x)))) return 'PHOTO';
  if (mime.startsWith('video/') || mime === 'application/vnd.google-apps.video' || (mime === 'application/octet-stream' && videoExt.some(x => name.endsWith(x)))) return 'VIDEO';
  return 'DOCUMENT';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Only POST is supported.' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const action = String(body.action || 'validate');
    if (action === 'raw-upload-init') {
      const result = await startRawZipUpload(String(body.adminToken || '').trim(), String(body.portalId || '').trim(), String(body.fileName || '').trim(), Number(body.fileSize));
      return json(res, 200, result);
    }
    if (action === 'raw-upload-complete') return json(res, 200, await saveRawZipUpload(body));
    const adminToken = String(body.adminToken || '').trim();
    const portalId = String(body.portalId || '').trim();
    const sourceUrl = String(body.sourceUrl || '').trim();
    const requestedType = String(body.fileType || 'PHOTO').toUpperCase();
    const title = String(body.title || '').trim();
    const fileNameInput = String(body.fileName || '').trim();
    const sortOrder = Math.max(0, Number(body.sortOrder || 0));
    const existingFileId = body.fileId ? String(body.fileId) : null;
    if (!adminToken || !portalId || !sourceUrl) return json(res, 400, { error: 'Admin token, delivery ID and private Drive link are required.' });
    if (!/^[0-9a-f-]{36}$/i.test(portalId) || (existingFileId && !/^[0-9a-f-]{36}$/i.test(existingFileId))) return json(res, 400, { error: 'Invalid delivery or file ID.' });
    if (!['PHOTO','VIDEO','DOCUMENT','FOLDER'].includes(requestedType)) return json(res, 400, { error: 'Choose a photo, video, document or folder.' });
    await rpc('delivery_admin_list_files', { p_token: adminToken, p_portal_id: portalId });
    const fileType = requestedType as 'PHOTO' | 'VIDEO' | 'DOCUMENT' | 'FOLDER';
    const driveId = extractDriveId(sourceUrl, fileType === 'FOLDER' ? 'folder' : 'file');
    if (!driveId) return json(res, 400, { error: 'This is not a valid private Google Drive file or folder link.' });
    const metadata = await driveMetadata(driveId);
    if (fileType === 'FOLDER') {
      if (metadata.mimeType !== 'application/vnd.google-apps.folder') return json(res, 400, { error: 'This Drive item is not a folder.' });
      return json(res, 200, { verified: true, fileType, driveId, metadata: { id: metadata.id, name: metadata.name, mimeType: metadata.mimeType } });
    }
    const detected = classifyFile(String(metadata.mimeType || ''), String(metadata.name || ''));
    if (fileType !== detected) return json(res, 400, { error: `This Drive item is a ${detected.toLowerCase()}, not a ${fileType.toLowerCase()}.` });
    if (body.persist === false) return json(res, 200, { verified: true, fileType, driveId, metadata: { id: metadata.id, name: metadata.name, mimeType: metadata.mimeType, size: metadata.size || null } });

    const saved: any = await rpc('delivery_admin_upsert_file', {
      p_token: adminToken, p_portal_id: portalId, p_file_id: existingFileId,
      p_source_url: sourceUrl, p_file_type: fileType, p_title: title || metadata.name || null,
      p_file_name: fileNameInput || metadata.name || null, p_mime_type: metadata.mimeType || null,
      p_sort_order: sortOrder, p_is_visible: body.isVisible !== false,
    });
    if (saved?.id && metadata.size) {
      const update = await supabaseServiceRequest(`delivery_files?id=eq.${encodeURIComponent(String(saved.id))}&portal_id=eq.${encodeURIComponent(portalId)}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ file_size_bytes: Number(metadata.size) }),
      });
      if (!update.ok) throw new Error('File was added but its file size could not be saved.');
    }
    return json(res, 200, { verified: true, saved: true, fileType, driveId, metadata: { id: metadata.id, name: metadata.name, mimeType: metadata.mimeType, size: metadata.size || null }, file: saved });
  } catch (error: any) {
    const status = /admin session/i.test(String(error?.message || '')) ? 401 : 502;
    console.error('[delivery-validate]', String(error?.message || 'Drive validation failed').slice(0, 180));
    return json(res, status, { error: error?.message || 'Google Drive link validation failed.' });
  }
}
