type VercelRequest = any;
type VercelResponse = any;

function json(res: VercelResponse, status: number, message: string) {
  res.status(status).setHeader('content-type', 'application/json; charset=utf-8').end(JSON.stringify({ error: message }));
}

function supabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) throw new Error('Protected delivery server configuration is missing.');
  return { url, key };
}

async function deliveryMedia(token: string, fileId: string, mode: 'PREVIEW' | 'ORIGINAL') {
  const { url, key } = supabaseConfig();
  const response = await fetch(`${url}/rest/v1/rpc/get_delivery_media_by_token`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ p_token: token, p_file_id: fileId, p_mode: mode }),
  });
  if (!response.ok) throw new Error((await response.text()).slice(0, 300) || 'Delivery file is unavailable.');
  const data = await response.json();
  if (!data) throw new Error('Delivery file is unavailable.');
  return data;
}

async function driveResponse(fileId: string, mode: 'PREVIEW' | 'ORIGINAL', range?: string, mimeType?: string | null, fileType?: string | null) {
  const auth = process.env.GOOGLE_DRIVE_ACCESS_TOKEN || '';
  if (!auth) throw new Error('Protected Google Drive server configuration is missing.');
  const headers: Record<string, string> = { Authorization: `Bearer ${auth}` };
  if (range) headers.Range = range;

  if (mode === 'PREVIEW' && fileType !== 'VIDEO' && !String(mimeType || '').startsWith('video/')) {
    if (auth) {
      const meta = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=thumbnailLink,mimeType,name,trashed&supportsAllDrives=true`, { headers });
      if (meta.ok) {
        const body = await meta.json().catch(() => ({}));
        if (body.trashed) throw new Error('This Google Drive file is in the trash.');
        if (String(body.mimeType || '').startsWith('image/') && body.thumbnailLink) {
          const thumb = await fetch(String(body.thumbnailLink), { headers });
          if (thumb.ok) return thumb;
        }
      }
    }
    return fetch(`https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w1600`, { headers: range ? { ...headers, Range: range } : headers });
  }

  return fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`, { headers });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return json(res, 405, 'Only GET is supported.');
  const token = String(req.query.token || '').trim();
  const fileId = String(req.query.fileId || '').trim();
  const mode = String(req.query.mode || 'PREVIEW').toUpperCase() === 'ORIGINAL' ? 'ORIGINAL' : 'PREVIEW';
  if (!token || token.length < 12 || token.length > 128) return json(res, 400, 'Invalid delivery token.');
  if (!/^[0-9a-f-]{36}$/i.test(fileId)) return json(res, 400, 'Invalid delivery file ID.');

  try {
    const file = await deliveryMedia(token, fileId, mode);
    if (!file.drive_file_id) return json(res, 400, 'This delivery item is a folder and cannot be streamed directly.');
    const upstream = await driveResponse(String(file.drive_file_id), mode, String(req.headers.range || ''), file.mime_type, file.file_type);
    if (!upstream.ok || !upstream.body) return json(res, upstream.status || 502, 'Google Drive file could not be read.');
    const contentType = upstream.headers.get('content-type') || file.mime_type || (mode === 'PREVIEW' ? 'image/jpeg' : 'application/octet-stream');
    res.status(upstream.status === 206 ? 206 : 200);
    res.setHeader('content-type', contentType);
    for (const header of ['content-length', 'content-range', 'accept-ranges']) {
      const value = upstream.headers.get(header);
      if (value) res.setHeader(header, value);
    }
    res.setHeader('cache-control', 'private, no-store, max-age=0');
    res.setHeader('x-content-type-options', 'nosniff');
    if (mode === 'ORIGINAL') {
      const name = String(file.file_name || file.title || 'ramyachobi-file').replace(/[\\/:*?"<>|\\u0000-\\u001f]/g, '_');
      res.setHeader('content-disposition', `attachment; filename="${name}"`);
    } else {
      res.setHeader('content-disposition', 'inline');
    }
    const reader = upstream.body.getReader();
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      if (!res.write(Buffer.from(next.value))) await new Promise<void>((resolve) => res.once('drain', resolve));
    }
    res.end();
  } catch (error: any) {
    if (!res.headersSent) return json(res, 502, error?.message || 'Protected delivery request failed.');
    res.end();
  }
}
