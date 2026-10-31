import { assertDeliveryAdmin, getDriveAccessToken } from './_lib/driveAuth.js';
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

async function assertPortalAccess(adminToken: string, portalId: string) {
  const { url, key } = supabaseConfig();
  const response = await fetch(`${url}/rest/v1/rpc/delivery_admin_list_files`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ p_token: adminToken, p_portal_id: portalId }),
  });
  if (!response.ok) throw new Error('Admin session expired or invalid, or this delivery was not found.');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Only POST is supported.' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const adminToken = String(body.adminToken || '').trim();
    const portalId = String(body.portalId || '').trim();
    const fileName = String(body.fileName || '').trim();
    const fileSize = Number(body.fileSize);
    if (!adminToken || !portalId || !fileName || !Number.isSafeInteger(fileSize) || fileSize < 1 || fileSize > 5 * 1024 ** 4) {
      return json(res, 400, { error: 'Choose a non-empty ZIP file up to Google Drive’s 5 TB file limit.' });
    }
    if (!/^[0-9a-f-]{36}$/i.test(portalId)) return json(res, 400, { error: 'Invalid delivery ID.' });
    if (!/\.zip$/i.test(fileName)) return json(res, 400, { error: 'Only .zip files can be uploaded as RAW delivery files.' });

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
    if (!upload.ok) return json(res, 502, { error: `Google Drive could not start the ZIP upload (HTTP ${upload.status}).` });
    const uploadUrl = upload.headers.get('location');
    if (!uploadUrl || !uploadUrl.startsWith('https://www.googleapis.com/upload/drive/')) {
      return json(res, 502, { error: 'Google Drive did not return a valid resumable upload session.' });
    }
    // This short-lived, file-specific session URL is returned only after admin and portal checks.
    return json(res, 200, { uploadUrl, fileName: metadata.name });
  } catch (error: any) {
    const message = String(error?.message || 'Could not start the ZIP upload.');
    const status = /admin session/i.test(message) ? 401 : 502;
    console.error('[delivery-raw-upload-init]', message.slice(0, 160));
    return json(res, status, { error: message });
  }
}
