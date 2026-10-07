type VercelRequest = any;
type VercelResponse = any;

function json(res: VercelResponse, status: number, body: unknown) {
  res.status(status).setHeader('content-type', 'application/json; charset=utf-8').end(JSON.stringify(body));
}

function supabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
  if (!url || !key) throw new Error('Supabase server configuration is missing.');
  return { url, key };
}

async function rpc(name: string, body: Record<string, unknown>) {
  const { url, key } = supabaseConfig();
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(detail.slice(0, 300) || `Supabase RPC ${name} failed.`);
  }
  return response.json();
}

async function driveAccessToken() {
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN || '';
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '';

  if (refreshToken && clientId && clientSecret) {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      if (String(body?.error || '') === 'invalid_grant') {
        throw new Error('Google Drive connection expired. Reconnect the Google account and try again.');
      }
      throw new Error('Google Drive could not refresh its private connection. Check the Drive OAuth settings in Vercel.');
    }
    const data = await response.json();
    if (data?.access_token) return String(data.access_token);
    throw new Error('Google Drive did not return an access token. Check the Drive OAuth settings in Vercel.');
  }

  const accessToken = process.env.GOOGLE_DRIVE_ACCESS_TOKEN || '';
  if (!accessToken) throw new Error('Google Drive server connection is not configured in Vercel.');
  return accessToken;
}

function extractFolderId(folderUrl: string) {
  let parsed: URL;
  try { parsed = new URL(folderUrl); } catch { return null; }
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'drive.google.com') return null;
  return parsed.pathname.match(/\/folders\/([A-Za-z0-9_-]+)/i)?.[1] || parsed.searchParams.get('id');
}

async function driveJson(url: string, accessToken: string) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const reason = String(data?.error?.status || '');
    if (response.status === 401) throw new Error('Google Drive authorization expired. Reconnect the Google account or configure a refresh token.');
    if (response.status === 403) throw new Error('The connected Google account cannot access this private folder. Give that account Viewer access; do not make the folder public.');
    if (response.status === 404) throw new Error('Google Drive folder was not found or is not shared with the connected account.');
    throw new Error(`Google Drive request failed (HTTP ${response.status}${reason ? `, ${reason}` : ''}). Check the folder link and Drive connection.`);
  }
  return response.json();
}

const PHOTO_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic', '.heif', '.tif', '.tiff', '.bmp', '.raw', '.arw', '.cr2', '.cr3', '.nef', '.dng', '.raf', '.orf', '.rw2', '.pef', '.srw', '.3fr', '.iiq'];
const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.m4v', '.avi', '.mkv', '.webm', '.wmv', '.flv', '.mpeg', '.mpg', '.3gp'];

function classifyFile(file: any): 'PHOTO' | 'VIDEO' | null {
  const mime = String(file?.mimeType || '').toLowerCase();
  const name = String(file?.name || '').toLowerCase();
  if (mime.startsWith('image/') || PHOTO_EXTENSIONS.some((extension) => name.endsWith(extension))) return 'PHOTO';
  if (mime.startsWith('video/') || mime === 'application/vnd.google-apps.video' || VIDEO_EXTENSIONS.some((extension) => name.endsWith(extension))) return 'VIDEO';
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Only POST is supported.' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const adminToken = String(body.adminToken || '').trim();
    const portalId = String(body.portalId || '').trim();
    const folderUrl = String(body.folderUrl || '').trim();
    const pageToken = String(body.pageToken || '').trim();

    if (!adminToken || !portalId || !folderUrl) return json(res, 400, { error: 'Admin token, portal ID and folder link are required.' });
    if (!/^[0-9a-f-]{36}$/i.test(portalId)) return json(res, 400, { error: 'Invalid delivery portal.' });

    const folderId = extractFolderId(folderUrl);
    if (!folderId) return json(res, 400, { error: 'This is not a valid Google Drive folder link.' });

    const existingResult = await rpc('delivery_admin_list_files', { p_token: adminToken, p_portal_id: portalId });
    const existingFiles = Array.isArray(existingResult) ? existingResult : Array.isArray(existingResult?.files) ? existingResult.files : [];
    const existingByDriveId = new Map<string, string>();
    for (const item of existingFiles) {
      if (item?.drive_file_id && item?.id) existingByDriveId.set(String(item.drive_file_id), String(item.id));
    }

    const connectedToken = typeof body.driveAccessToken === 'string' ? body.driveAccessToken.trim() : '';
    const accessToken = connectedToken || await driveAccessToken();
    const folderUrlApi = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?fields=${encodeURIComponent('id,name,mimeType,trashed')}&supportsAllDrives=true`;
    const folderMetadata = await driveJson(folderUrlApi, accessToken);
    if (folderMetadata.mimeType !== 'application/vnd.google-apps.folder') {
      return json(res, 400, { error: 'The supplied Drive link points to a file, not a folder.' });
    }
    if (folderMetadata.trashed) return json(res, 400, { error: 'This Google Drive folder is in the trash.' });

    const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
    const fields = 'id,name,mimeType,size,fileExtension,modifiedTime,thumbnailLink,parents';
    const next = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '';
    const listUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${encodeURIComponent(`nextPageToken,files(${fields})`)}&pageSize=100&supportsAllDrives=true&includeItemsFromAllDrives=true${next}`;
    const page = await driveJson(listUrl, accessToken);
    const files: any[] = Array.isArray(page.files) ? page.files : [];
    const supported = files.map((file, sourceIndex) => ({ file, sourceIndex, type: classifyFile(file) }))
      .filter((item): item is { file: any; sourceIndex: number; type: 'PHOTO' | 'VIDEO' } => Boolean(item.type));

    let imported = 0;
    for (let start = 0; start < supported.length; start += 5) {
      const batch = supported.slice(start, start + 5);
      const saved = await Promise.all(batch.map(({ file, sourceIndex, type }) => rpc('delivery_admin_upsert_file', {
        p_token: adminToken,
        p_portal_id: portalId,
        p_file_id: existingByDriveId.get(String(file.id)) || null,
        p_source_url: `https://drive.google.com/file/d/${file.id}/view`,
        p_file_type: type,
        p_title: file.name,
        p_file_name: file.name,
        p_mime_type: file.mimeType || null,
        p_sort_order: sourceIndex,
        p_is_visible: true,
      })));
      imported += saved.length;
    }

    return json(res, 200, {
      success: true,
      folderName: String(folderMetadata.name || ''),
      imported,
      skipped: files.length - supported.length,
      nextPageToken: page.nextPageToken || null,
    });
  } catch (error: any) {
    const requestId = String(req.headers?.['x-vercel-id'] || '').slice(0, 100);
    console.error('[delivery-folder-sync] failed', {
      requestId,
      name: String(error?.name || 'Error').slice(0, 80),
      code: String(error?.code || '').slice(0, 80),
    });
    return json(res, 502, { error: error?.message || 'Folder sync failed.' });
  }
}
