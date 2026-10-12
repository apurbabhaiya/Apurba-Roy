import { getDriveAccessToken, supabaseServiceRequest } from './_lib/driveAuth.js';

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

function classifyFile(mime: string, fileName: string): 'PHOTO' | 'VIDEO' | 'DOCUMENT' {
  const name = fileName.toLowerCase();
  const imageExt = ['.jpg','.jpeg','.png','.webp','.gif','.heic','.heif','.tif','.tiff','.bmp','.raw','.arw','.cr2','.cr3','.nef','.dng','.raf','.orf','.rw2','.pef','.srw','.3fr','.iiq'];
  const videoExt = ['.mp4','.mov','.m4v','.avi','.mkv','.webm','.wmv','.flv','.mpeg','.mpg','.3gp'];
  if (mime.startsWith('image/') || (mime === 'application/octet-stream' && imageExt.some(x => name.endsWith(x)))) return 'PHOTO';
  if (mime.startsWith('video/') || mime === 'application/vnd.google-apps.video' || (mime === 'application/octet-stream' && videoExt.some(x => name.endsWith(x)))) return 'VIDEO';
  return 'DOCUMENT';
}

async function handleMessengerRequest(body: any, res: VercelResponse) {
  const action = String(body.action || 'load');
  if (action === 'load') {
    const [settingsRes, faqsRes, threadsRes] = await Promise.all([
      supabaseServiceRequest('messenger_settings?select=id,page_id,page_name,is_connected,ai_enabled,auto_reply_enabled&id=eq.1&limit=1'),
      supabaseServiceRequest('messenger_faqs?select=id,question,answer,keywords,is_active,created_at&order=created_at.desc'),
      supabaseServiceRequest('messenger_threads?select=id,platform,customer_name,last_message,last_message_at,unread_count,status&order=last_message_at.desc.nullslast&limit=50'),
    ]);
    if (!settingsRes.ok || !faqsRes.ok || !threadsRes.ok) throw new Error('AI Inbox database is not ready. Apply the AI Inbox migration and retry.');
    const [settings, faqs, threads] = await Promise.all([settingsRes.json(), faqsRes.json(), threadsRes.json()]);
    return json(res, 200, { settings: settings[0] || { id: 1, is_connected: false, ai_enabled: false, auto_reply_enabled: false }, faqs, threads });
  }
  if (action === 'settings') {
    const currentRes = await supabaseServiceRequest('messenger_settings?select=id,is_connected&id=eq.1&limit=1');
    if (!currentRes.ok) throw new Error('AI Inbox database is not ready. Apply the AI Inbox migration and retry.');
    const current = (await currentRes.json())[0] || { id: 1, is_connected: false };
    const saved = await supabaseServiceRequest('messenger_settings?on_conflict=id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ id: 1, ai_enabled: Boolean(body.ai_enabled), auto_reply_enabled: Boolean(body.auto_reply_enabled) && Boolean(current.is_connected), updated_at: new Date().toISOString() }),
    });
    if (!saved.ok) throw new Error('Could not save AI Inbox settings.');
    return json(res, 200, { ok: true });
  }
  if (action === 'save_faq') {
    const question = String(body.question || '').trim();
    const answer = String(body.answer || '').trim();
    if (question.length < 3 || question.length > 1000 || !answer || answer.length > 4000) return json(res, 400, { error: 'প্রশ্ন ৩–১০০০ অক্ষর এবং উত্তর ১–৪০০০ অক্ষর দিন।' });
    const record = { question, answer, keywords: Array.isArray(body.keywords) ? body.keywords.map((v: unknown) => String(v).slice(0, 80)).slice(0, 20) : [], is_active: true };
    const saved = await supabaseServiceRequest('messenger_faqs', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(record) });
    if (!saved.ok) throw new Error('FAQ save failed.');
    return json(res, 200, { faq: (await saved.json())[0] });
  }
  if (action === 'delete_faq') {
    const id = String(body.id || '');
    if (!/^[0-9a-f-]{36}$/i.test(id)) return json(res, 400, { error: 'FAQ ID is invalid.' });
    const deleted = await supabaseServiceRequest(`messenger_faqs?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!deleted.ok) throw new Error('FAQ delete failed.');
    return json(res, 200, { ok: true });
  }
  return json(res, 400, { error: 'Unknown AI Inbox action.' });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Only POST is supported.' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const adminToken = String(body.adminToken || '').trim();
    if (body.feature === 'ai-inbox') {
      if (!adminToken) return json(res, 401, { error: 'Admin session is required.' });
      await rpc('delivery_admin_dashboard', { p_token: adminToken });
      return await handleMessengerRequest(body, res);
    }
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
