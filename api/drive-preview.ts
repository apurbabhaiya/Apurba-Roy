type VercelRequest = any;
type VercelResponse = any;

export const config = { maxDuration: 60 };

function json(res: VercelResponse, status: number, message: string) {
  res.status(status).setHeader('content-type', 'application/json; charset=utf-8').end(JSON.stringify({ error: message }));
}

function widthValue(value: unknown): number {
  const width = Number(value || 1600);
  if (!Number.isFinite(width)) return 1600;
  return Math.max(320, Math.min(1600, Math.round(width)));
}

async function fetchPreview(fileId: string, width: number, token?: string): Promise<Response> {
  const publicUrl = `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w${width}`;
  const auth = token || process.env.GOOGLE_DRIVE_ACCESS_TOKEN || '';

  // For private files, Drive's metadata API returns an authorized thumbnailLink.
  // Fetch that link with the same server-side token. The token never reaches the
  // browser and the endpoint still returns a preview, never the original file.
  if (auth) {
    const metadata = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=thumbnailLink,mimeType,trashed&supportsAllDrives=true`, {
      headers: { Authorization: `Bearer ${auth}` },
    });
    if (metadata.ok) {
      const body = await metadata.json().catch(() => ({}));
      if (body.trashed) throw new Error('This Drive file is in the trash.');
      if (body.thumbnailLink) {
        const thumbnail = await fetch(String(body.thumbnailLink), { headers: { Authorization: `Bearer ${auth}` } });
        if (thumbnail.ok && (thumbnail.headers.get('content-type') || '').startsWith('image/')) return thumbnail;
      }
    }
  }

  return fetch(publicUrl, { redirect: 'follow' });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return json(res, 405, 'Only GET is supported.');
  const fileId = String(req.query.fileId || '').trim();
  if (!fileId || !/^[A-Za-z0-9_-]{10,}$/.test(fileId)) return json(res, 400, 'A valid Google Drive file ID is required.');

  try {
    const upstream = await fetchPreview(fileId, widthValue(req.query.width), String(req.headers['x-google-drive-token'] || ''));
    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => '');
      return json(res, upstream.status || 502, `Preview could not be read from Google Drive. ${detail.slice(0, 180)}`);
    }
    const contentType = upstream.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) return json(res, 502, 'Google Drive returned a non-image preview.');
    res.status(200);
    res.setHeader('content-type', contentType);
    const length = upstream.headers.get('content-length');
    if (length) res.setHeader('content-length', length);
    res.setHeader('cache-control', 'public, max-age=300, stale-while-revalidate=3600');
    const reader = upstream.body.getReader();
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      if (!res.write(Buffer.from(chunk.value))) await new Promise<void>((resolve) => res.once('drain', resolve));
    }
    res.end();
  } catch (error: any) {
    if (!res.headersSent) return json(res, 502, error?.message || 'Preview request failed.');
    res.end();
  }
}
