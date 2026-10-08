import { assertDeliveryAdmin, getDriveAccessToken, getDriveConnection } from './_lib/driveAuth';

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
    const connection = await getDriveConnection();
    if (!connection) return json(res, 200, { status: 'disconnected', email: null, connectedAt: null });
    const accessToken = await getDriveAccessToken();
    const response = await fetch('https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress)', { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.user?.emailAddress) return json(res, 200, { status: 'reconnect_required', email: connection.account_email, connectedAt: connection.connected_at });
    return json(res, 200, { status: 'connected', email: String(data.user.emailAddress), displayName: String(data.user.displayName || ''), connectedAt: connection.connected_at });
  } catch (error: any) {
    const status = /admin session/i.test(String(error?.message || '')) ? 401 : 503;
    return json(res, status, { status: 'error', error: error?.message || 'Drive status check failed.' });
  }
}
