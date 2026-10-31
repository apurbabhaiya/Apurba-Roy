import { getDriveAccessToken, supabaseServiceRequest } from './_lib/driveAuth.js';
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Only POST is supported.' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const adminToken = String(body.adminToken || '').trim();
    const portalId = String(body.portalId || '').trim();
    const driveFileId = String(body.driveFileId || '').trim();
    const requestedName = String(body.fileName || '').trim();
    const title = String(body.title || '').trim().slice(0, 160);
    const sortOrder = Math.min(1000000, Math.max(0, Math.trunc(Number(body.sortOrder) || 0)));
    if (!adminToken || !portalId || !driveFileId || !requestedName) return json(res, 400, { error: 'Admin session, delivery ID and uploaded ZIP details are required.' });
    if (!/^[0-9a-f-]{36}$/i.test(portalId) || !/^[A-Za-z0-9_-]{10,200}$/.test(driveFileId)) return json(res, 400, { error: 'Invalid delivery or Google Drive file ID.' });
    if (!/\.zip$/i.test(requestedName)) return json(res, 400, { error: 'Only ZIP files can be attached as RAW delivery files.' });

    await rpc('delivery_admin_list_files', { p_token: adminToken, p_portal_id: portalId });
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
      p_token: adminToken,
      p_portal_id: portalId,
      p_file_id: null,
      p_source_url: sourceUrl,
      p_file_type: 'DOCUMENT',
      p_title: title || 'RAW photos & videos ZIP',
      p_file_name: fileName,
      p_mime_type: 'application/zip',
      p_sort_order: sortOrder,
      p_is_visible: true,
    });
    if (!saved?.id) throw new Error('The ZIP was uploaded but could not be linked to this delivery.');

    const update = await supabaseServiceRequest(`delivery_files?id=eq.${encodeURIComponent(String(saved.id))}&portal_id=eq.${encodeURIComponent(portalId)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ file_size_bytes: Number(metadata.size || 0) }),
    });
    if (!update.ok) throw new Error('The ZIP is uploaded, but its file size could not be saved.');

    return json(res, 200, { success: true, file: { ...saved, file_name: fileName, mime_type: 'application/zip', file_size_bytes: Number(metadata.size || 0) } });
  } catch (error: any) {
    const message = String(error?.message || 'Could not attach the uploaded ZIP to this delivery.');
    const status = /admin session/i.test(message) ? 401 : 502;
    console.error('[delivery-raw-upload-complete]', message.slice(0, 160));
    return json(res, status, { error: message });
  }
}
