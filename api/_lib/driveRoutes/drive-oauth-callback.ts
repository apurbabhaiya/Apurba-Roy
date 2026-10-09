import { assertDeliveryAdmin, decryptDriveSecret, encryptDriveSecret, supabaseServiceRequest } from '../driveAuth.js';

type VercelRequest = any;
type VercelResponse = any;
function finish(res: VercelResponse, state: 'connected' | 'error', message?: string) {
  const base = process.env.APP_URL || '';
  if (!base) return res.status(503).send('APP_URL is not configured.');
  const target = new URL('/delivery-admin', base);
  target.searchParams.set('drive', state);
  if (message) target.searchParams.set('driveError', message.slice(0, 160));
  return res.status(302).setHeader('location', target.toString()).setHeader('cache-control','no-store').end();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).send('Only GET is supported.');
  try {
    const state = String(req.query.state || '');
    const code = String(req.query.code || '');
    if (!state || !code) return finish(res, 'error', 'Google authorization was cancelled or incomplete.');
    const lookup = await supabaseServiceRequest(`delivery_drive_oauth_states?select=state,encrypted_admin_token,expires_at&state=eq.${encodeURIComponent(state)}&limit=1`);
    if (!lookup.ok) throw new Error('Secure Google authorization state could not be checked.');
    const rows = await lookup.json();
    const saved = Array.isArray(rows) ? rows[0] : null;
    if (!saved || new Date(saved.expires_at).getTime() <= Date.now()) return finish(res, 'error', 'Google authorization expired. Start Connect Google again.');
    await supabaseServiceRequest(`delivery_drive_oauth_states?state=eq.${encodeURIComponent(state)}`, { method: 'DELETE' });
    const adminToken = decryptDriveSecret(String(saved.encrypted_admin_token));
    await assertDeliveryAdmin(adminToken);

    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || '';
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || '';
    const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || '';
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
    });
    const tokens = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok) {
      const messages: Record<string, string> = {
        invalid_client: 'Google OAuth Client ID and Client Secret do not match. Update the matching secret in Vercel and redeploy.',
        invalid_grant: 'Google authorization code expired or was already used. Start Connect Google again from Delivery Admin.',
        redirect_uri_mismatch: 'Google OAuth callback URL does not match the authorized redirect URI.',
        unauthorized_client: 'This Google OAuth client is not authorized for server login. Use a Web application client.',
        invalid_request: 'Google rejected the token request. Check the server OAuth configuration.',
      };
      throw new Error(messages[String(tokens?.error)] || 'Google token exchange failed. Check the OAuth client configuration and reconnect.');
    }
    if (!tokens?.refresh_token) throw new Error('Google did not return a durable refresh token. Remove this app from your Google account connections, then reconnect and approve access.');
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: `Bearer ${tokens.access_token}` } });
    const user = await userResponse.json().catch(() => ({}));
    if (!userResponse.ok || !user?.email) throw new Error('Google account identity could not be verified.');
    const save = await supabaseServiceRequest('delivery_drive_connections?on_conflict=id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ id: 1, account_email: String(user.email), encrypted_refresh_token: encryptDriveSecret(String(tokens.refresh_token)), connected_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
    });
    if (!save.ok) throw new Error('The server could not save the protected Google Drive connection.');
    return finish(res, 'connected');
  } catch (error: any) {
    console.error('[drive-oauth-callback]', String(error?.message || 'OAuth callback failed').slice(0, 180));
    return finish(res, 'error', error?.message || 'Google Drive connection failed.');
  }
}
