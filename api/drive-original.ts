type VercelRequest = any;
type VercelResponse = any;

function safeName(value: string): string {
  return (value || 'photo.jpg').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 240) || 'photo.jpg';
}

function json(res: VercelResponse, status: number, message: string) {
  res.status(status).setHeader('content-type', 'application/json; charset=utf-8').end(JSON.stringify({ error: message }));
}

async function getDriveResponse(fileId: string, token?: string): Promise<Response> {
  const auth = token || process.env.GOOGLE_DRIVE_ACCESS_TOKEN || '';
  if (auth) {
    return fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`, {
      headers: { Authorization: `Bearer ${auth}` },
    });
  }
  // Public Drive files can still be streamed without exposing a token.
  return fetch(`https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`, { redirect: 'follow' });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return json(res, 405, 'Only GET is supported.');
  const fileId = String(req.query.fileId || '').trim();
  if (!fileId || !/^[A-Za-z0-9_-]{10,}$/.test(fileId)) return json(res, 400, 'A valid Google Drive file ID is required.');

  try {
    const upstream = await getDriveResponse(fileId, String(req.headers['x-google-drive-token'] || ''));
    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => '');
      return json(res, upstream.status || 502, `Original file could not be read from Google Drive. ${detail.slice(0, 240)}`);
    }
    const filename = safeName(String(req.query.filename || 'photo.jpg'));
    res.status(200);
    res.setHeader('content-type', upstream.headers.get('content-type') || 'application/octet-stream');
    const length = upstream.headers.get('content-length');
    if (length) res.setHeader('content-length', length);
    res.setHeader('content-disposition', `attachment; filename="${filename}"`);
    res.setHeader('cache-control', 'private, no-store, max-age=0');
    const reader = upstream.body.getReader();
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      if (!res.write(Buffer.from(chunk.value))) await new Promise<void>((resolve) => res.once('drain', resolve));
    }
    res.end();
  } catch (error: any) {
    if (!res.headersSent) return json(res, 502, error?.message || 'Original download failed.');
    res.end();
  }
}
