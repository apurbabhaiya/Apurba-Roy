import { randomBytes } from 'node:crypto';
import { assertDeliveryAdmin, encryptDriveSecret, supabaseServiceRequest } from '../driveAuth.js';

type VercelRequest = any;
type VercelResponse = any;
function json(res: VercelResponse, status: number, body: unknown) {
  return res.status(status).setHeader('content-type', 'application/json; charset=utf-8').setHeader('cache-control','no-store').end(JSON.stringify(body));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Only POST is supported.' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const adminToken = String(body.adminToken || '').trim();
    await assertDeliveryAdmin(adminToken);
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || '';
    const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || '';
    if (!clientId || !redirectUri || !process.env.GOOGLE_OAUTH_CLIENT_SECRET || !process.env.GOOGLE_TOKEN_ENCRYPTION_KEY) {
      return json(res, 503, { error: 'Google OAuth is not configured on the server.' });
    }
    const state = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const saved = await supabaseServiceRequest('delivery_drive_oauth_states', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ state, encrypted_admin_token: encryptDriveSecret(adminToken), expires_at: expiresAt }),
    });
    if (!saved.ok) throw new Error('Could not start a secure Google authorization session.');
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent select_account',
      scope: 'openid email https://www.googleapis.com/auth/drive.readonly',
      include_granted_scopes: 'true',
      state,
    }).toString();
    return json(res, 200, { authorizationUrl: url.toString() });
  } catch (error: any) {
    return json(res, 401, { error: error?.message || 'Could not connect Google Drive.' });
  }
}
