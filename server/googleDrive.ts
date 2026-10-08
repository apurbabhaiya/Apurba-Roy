// Shared, server-only authorization for validation, imports and client media.
// Credentials never appear in returned errors or client URLs.
export async function getDeliveryDriveToken(): Promise<string> {
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN || '';
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '';
  if (refreshToken) {
    if (!clientId || !clientSecret) throw new Error('Drive reconnect configuration is incomplete. Configure the Google OAuth client on the server.');
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (data.error === 'invalid_grant') throw new Error('Google Drive permission was revoked or expired. Reconnect the studio Google account.');
      throw new Error('Google Drive authorization could not be refreshed. Check the server OAuth configuration.');
    }
    if (typeof data.access_token !== 'string' || !data.access_token) throw new Error('Google Drive returned no access token. Reconnect the studio Google account.');
    return data.access_token;
  }
  const token = process.env.GOOGLE_DRIVE_ACCESS_TOKEN || '';
  if (!token) throw new Error('The studio Google Drive server connection is missing. Connect Drive before publishing delivery.');
  return token;
}

export function driveReadError(status: number): string {
  if (status === 401) return 'Google Drive authorization expired. Reconnect the studio Google account.';
  if (status === 403) return 'The studio Google account cannot read this file, or Drive has limited downloads. Check permission and try again.';
  if (status === 404) return 'This file was moved, deleted, or is unavailable to the studio Google account.';
  if (status === 429) return 'Google Drive is temporarily limiting requests. Try again later.';
  return `Google Drive could not read the file (HTTP ${status}). Try again.`;
}
