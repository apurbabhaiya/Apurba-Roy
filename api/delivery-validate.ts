import { getDeliveryDriveToken, driveReadError } from '../server/googleDrive';
type VercelRequest = any;
type VercelResponse = any;

function json(res: VercelResponse, status: number, body: unknown) {
  res.status(status).setHeader('content-type', 'application/json; charset=utf-8').end(JSON.stringify(body));
}

function supabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) throw new Error('Protected delivery server configuration is missing.');
  return { url, key };
}

async function assertAdmin(adminToken: string, portalId: string) {
  const { url, key } = supabaseConfig();
  const response = await fetch(`${url}/rest/v1/rpc/delivery_admin_list_files`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ p_token: adminToken, p_portal_id: portalId }),
  });
  if (!response.ok) throw new Error('Admin session expired or delivery portal is unavailable.');
}

async function adminUpsert(body: Record<string, unknown>) {
  const { url, key } = supabaseConfig();
  const response = await fetch(`${url}/rest/v1/rpc/delivery_admin_upsert_file`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error((await response.text()).slice(0, 400) || 'Could not save the delivery file.');
  return response.json();
}

function extractDriveId(sourceUrl: string, kind: 'file' | 'folder') {
  const value = sourceUrl.trim();
  let parsed: URL;
  try { parsed = new URL(value); } catch { return null; }
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'drive.google.com') return null;
  const pattern = kind === 'folder'
    ? /\/folders\/([A-Za-z0-9_-]+)/i
    : /\/file\/d\/([A-Za-z0-9_-]+)/i;
  const direct = value.match(pattern)?.[1];
  if (direct) return direct;
  return value.match(/[?&]id=([A-Za-z0-9_-]+)/i)?.[1] || null;
}

async function driveMetadata(id: string, connectedToken?: string) {
  const accessToken = connectedToken || await getDeliveryDriveToken();
  const fields = 'id,name,mimeType,size,fileExtension,thumbnailLink,modifiedTime,trashed,parents';
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=${encodeURIComponent(fields)}&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(driveReadError(response.status));
  }
  const data = await response.json();
  if (data.trashed) throw new Error('This Google Drive item is in the trash.');
  return data;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Only POST is supported.' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const adminToken = String(body.adminToken || '').trim();
    const portalId = String(body.portalId || '').trim();
    const sourceUrl = String(body.sourceUrl || '').trim();
    const fileType = String(body.fileType || 'PHOTO').toUpperCase();
    const title = String(body.title || '').trim();
    const fileNameInput = String(body.fileName || '').trim();
    const sortOrder = Math.max(0, Number(body.sortOrder || 0));
    const isVisible = body.isVisible !== false;
    const existingFileId = body.fileId ? String(body.fileId) : null;

    if (!adminToken || !portalId || !sourceUrl) return json(res, 400, { error: 'Admin token, portal ID and Google Drive link are required.' });
    if (!/^[0-9a-f-]{36}$/i.test(portalId)) return json(res, 400, { error: 'Invalid delivery portal.' });
    if (existingFileId && !/^[0-9a-f-]{36}$/i.test(existingFileId)) return json(res, 400, { error: 'Invalid delivery file.' });
    if (!['PHOTO', 'VIDEO', 'FOLDER'].includes(fileType)) return json(res, 400, { error: 'File type must be Photo, Video or Folder.' });

    await assertAdmin(adminToken, portalId);

    const kind = fileType === 'FOLDER' ? 'folder' : 'file';
    const driveId = extractDriveId(sourceUrl, kind);
    if (!driveId) return json(res, 400, { error: `Could not extract a Google Drive ${kind} ID from this link.` });

    const connectedToken = typeof body.driveAccessToken === 'string' ? body.driveAccessToken.trim() : '';
    const metadata = await driveMetadata(driveId, connectedToken);
    if (fileType === 'FOLDER' && metadata.mimeType !== 'application/vnd.google-apps.folder') {
      return json(res, 400, { error: 'This link is not a Google Drive folder.' });
    }
    const mimeType = String(metadata.mimeType || '').toLowerCase();
    const fileName = String(metadata.name || '').toLowerCase();
    const photoExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic', '.heif', '.tif', '.tiff', '.bmp', '.raw', '.arw', '.cr2', '.cr3', '.nef', '.dng', '.raf', '.orf', '.rw2', '.pef', '.srw', '.3fr', '.iiq'];
    const videoExtensions = ['.mp4', '.mov', '.m4v', '.avi', '.mkv', '.webm', '.wmv', '.flv', '.mpeg', '.mpg', '.3gp'];
    const hasPhotoExtension = photoExtensions.some((extension) => fileName.endsWith(extension));
    const hasVideoExtension = videoExtensions.some((extension) => fileName.endsWith(extension));
    const isPhoto = mimeType.startsWith('image/') || (mimeType === 'application/octet-stream' && hasPhotoExtension);
    const isVideo = mimeType.startsWith('video/') || mimeType === 'application/vnd.google-apps.video' || (mimeType === 'application/octet-stream' && hasVideoExtension);
    if (fileType === 'PHOTO' && !isPhoto) {
      return json(res, 400, { error: `The selected Drive item is ${metadata.mimeType || 'unknown type'}, not a photo. Choose a JPG/PNG/photo file.` });
    }
    if (fileType === 'VIDEO' && !isVideo) {
      return json(res, 400, { error: `The selected Drive item is ${metadata.mimeType || 'unknown type'}, not a video. Choose an MP4/MOV/video file.` });
    }

    if (fileType === 'FOLDER' || body.persist === false) {
      return json(res, 200, {
        verified: true,
        fileType,
        driveId,
        metadata: { id: metadata.id, name: metadata.name, mimeType: metadata.mimeType, size: metadata.size || null, modifiedTime: metadata.modifiedTime || null },
      });
    }

    const saved = await adminUpsert({
      p_token: adminToken,
      p_portal_id: portalId,
      p_file_id: existingFileId,
      p_source_url: sourceUrl,
      p_file_type: fileType,
      p_title: title || metadata.name || null,
      p_file_name: fileNameInput || metadata.name || null,
      p_mime_type: metadata.mimeType || null,
      p_sort_order: sortOrder,
      p_is_visible: isVisible,
    });

    return json(res, 200, {
      verified: true,
      saved: true,
      fileType,
      driveId,
      metadata: { id: metadata.id, name: metadata.name, mimeType: metadata.mimeType, size: metadata.size || null, modifiedTime: metadata.modifiedTime || null },
      file: saved ? { id: saved.id, file_name: saved.file_name, file_type: saved.file_type, mime_type: saved.mime_type, title: saved.title, sort_order: saved.sort_order, is_visible: saved.is_visible } : null,
    });
  } catch (error: any) {
    const requestId = String(req.headers?.['x-vercel-id'] || '').slice(0, 100);
    console.error('[delivery-validate] failed', {
      requestId,
      name: String(error?.name || 'Error').slice(0, 80),
      code: String(error?.code || '').slice(0, 80),
    });
    return json(res, 502, { error: error?.message || 'Google Drive link validation failed.' });
  }
}
