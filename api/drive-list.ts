import { assertDeliveryAdmin, getDriveAccessToken } from './_lib/driveAuth.js';

type VercelRequest = any;
type VercelResponse = any;
function json(res: VercelResponse, status: number, body: unknown) {
  return res.status(status).setHeader('content-type','application/json; charset=utf-8').setHeader('cache-control','no-store').end(JSON.stringify(body));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Only POST is supported.' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    await assertDeliveryAdmin(String(body.adminToken || '').trim());
    const parentId = String(body.parentId || 'root').trim();
    if (!/^[A-Za-z0-9_-]{1,256}$/.test(parentId)) return json(res, 400, { error: 'Invalid Drive folder.' });
    const accessToken = await getDriveAccessToken();
    const query = parentId === 'root' ? "'root' in parents and trashed = false" : `'${parentId}' in parents and trashed = false`;
    const params = new URLSearchParams({
      q: query,
      orderBy: 'folder,name',
      pageSize: '1000',
      fields: 'nextPageToken,files(id,name,mimeType,size,modifiedTime,thumbnailLink,parents)',
      supportsAllDrives: 'true', includeItemsFromAllDrives: 'true',
    });
    if (body.pageToken) params.set('pageToken', String(body.pageToken));
    const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return json(res, response.status === 401 ? 503 : 502, { error: response.status === 403 ? 'The connected Google account cannot access this private Drive folder.' : 'Google Drive files could not be loaded.' });
    return json(res, 200, { files: data.files || [], nextPageToken: data.nextPageToken || null });
  } catch (error: any) {
    const status = /admin session/i.test(String(error?.message || '')) ? 401 : 503;
    return json(res, status, { error: error?.message || 'Could not browse Google Drive.' });
  }
}
