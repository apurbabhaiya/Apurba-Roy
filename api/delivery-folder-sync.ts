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
  if (!response.ok) throw new Error((await response.text()).slice(0, 300) || `Supabase RPC ${name} failed.`);
  return response.json();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Only POST is supported.' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const adminToken = String(body.adminToken || '').trim();
    const portalId = String(body.portalId || '').trim();
    const folderUrl = String(body.folderUrl || '').trim();
    if (!adminToken || !portalId || !folderUrl) return json(res, 400, { error: 'Admin token, portal ID and folder link are required.' });
    const folderId = folderUrl.match(/\/folders\/([A-Za-z0-9_-]+)/)?.[1] || folderUrl.match(/[?&]id=([A-Za-z0-9_-]+)/)?.[1];
    if (!folderId) return json(res, 400, { error: 'Could not extract the Google Drive folder ID.' });

    const accessToken = process.env.GOOGLE_DRIVE_ACCESS_TOKEN || '';
    if (!accessToken) return json(res, 503, { error: 'GOOGLE_DRIVE_ACCESS_TOKEN is not configured in Vercel.' });

    const query = encodeURIComponent(`'${folderId}' in parents and trashed = false and (mimeType contains 'image/' or mimeType contains 'video/')`);
    const fields = encodeURIComponent('nextPageToken,files(id,name,mimeType,size,thumbnailLink)');
    const files: any[] = [];
    let pageToken = '';
    do {
      const next = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '';
      const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true${next}`, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!response.ok) throw new Error((await response.text()).slice(0, 300) || 'Google Drive folder could not be read.');
      const data = await response.json();
      files.push(...(data.files || []));
      pageToken = data.nextPageToken || '';
    } while (pageToken);

    for (const file of files) {
      await rpc('delivery_admin_upsert_file', {
        p_token: adminToken,
        p_portal_id: portalId,
        p_source_url: `https://drive.google.com/file/d/${file.id}/view`,
        p_file_type: String(file.mimeType || '').startsWith('video/') ? 'VIDEO' : 'PHOTO',
        p_title: file.name,
        p_file_name: file.name,
        p_mime_type: file.mimeType || null,
        p_sort_order: files.indexOf(file),
        p_is_visible: true,
      });
    }

    return json(res, 200, { success: true, folder_id: folderId, imported: files.length });
  } catch (error: any) {
    return json(res, 502, { error: error?.message || 'Folder sync failed.' });
  }
}
