import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

function supabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
  if (!url || !key) throw new Error('Protected delivery server configuration is missing.');
  return { url: url.replace(/\/$/, ''), key };
}

export function encryptDriveSecret(value: string) {
  const rawKey = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || '';
  if (!rawKey) throw new Error('Google Drive encryption key is not configured.');
  const key = Buffer.from(rawKey, 'base64');
  if (key.length !== 32) throw new Error('Google Drive encryption key must be base64 encoded and 32 bytes long.');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
}

export function decryptDriveSecret(value: string) {
  const rawKey = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || '';
  if (!rawKey) throw new Error('Google Drive encryption key is not configured.');
  const key = Buffer.from(rawKey, 'base64');
  const payload = Buffer.from(value, 'base64');
  if (key.length !== 32 || payload.length < 29) throw new Error('Stored Google Drive authorization is invalid.');
  const decipher = createDecipheriv('aes-256-gcm', key, payload.subarray(0, 12));
  decipher.setAuthTag(payload.subarray(12, 28));
  return Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]).toString('utf8');
}

async function serviceRequest(path: string, init: RequestInit = {}) {
  const { url, key } = supabaseConfig();
  return fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

export async function assertDeliveryAdmin(adminToken: string) {
  if (!adminToken || adminToken.length > 256) throw new Error('Admin session is required.');
  const { url, key } = supabaseConfig();
  const response = await fetch(`${url}/rest/v1/rpc/delivery_admin_dashboard`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ p_token: adminToken }),
  });
  if (!response.ok) throw new Error('Admin session expired or invalid.');
}

export async function getDriveConnection() {
  const response = await serviceRequest('delivery_drive_connections?select=id,account_email,encrypted_refresh_token,connected_at,updated_at&id=eq.1&limit=1');
  if (!response.ok) throw new Error('Google Drive connection status could not be checked.');
  const rows = await response.json();
  return Array.isArray(rows) ? rows[0] || null : null;
}

export async function getDriveAccessToken() {
  const connection = await getDriveConnection();
  if (!connection?.encrypted_refresh_token) throw new Error('Google Drive is not connected. Connect an authorized Google account in Delivery Admin.');
  const refreshToken = decryptDriveSecret(String(connection.encrypted_refresh_token));
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || '';
  if (!clientId || !clientSecret) throw new Error('Google OAuth credentials are not configured on the server.');
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.access_token) {
    if (String(data?.error || '') === 'invalid_grant') throw new Error('Google Drive authorization expired. Reconnect the Google account.');
    throw new Error('Google Drive could not refresh its server connection. Reconnect the Google account.');
  }
  return String(data.access_token);
}

export async function supabaseServiceRequest(path: string, init: RequestInit = {}) {
  return serviceRequest(path, init);
}

export type DriveOAuthState = { state: string; encrypted_admin_token: string; expires_at: string };
export type DriveConnection = { id: number; account_email: string; encrypted_refresh_token: string; connected_at: string; updated_at: string };

