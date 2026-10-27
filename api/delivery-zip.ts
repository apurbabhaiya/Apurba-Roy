import JSZip from 'jszip';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { getDriveAccessToken } from './_lib/driveAuth.js';
import { uniqueZipName } from './_lib/fileName.js';

type VercelRequest = any;
type VercelResponse = any;

function json(res: VercelResponse, status: number, message: string) {
  res.status(status).setHeader('content-type', 'application/json; charset=utf-8').end(JSON.stringify({ error: message }));
}

function supabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
  if (!url || !key) throw new Error('Protected delivery server configuration is missing.');
  return { url, key };
}

async function getFile(token: string, id: string, adminToken?: string) {
  const { url, key } = supabaseConfig();
  const response = await fetch(`${url}/rest/v1/rpc/get_delivery_media_by_token`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ p_token: token, p_file_id: id, p_mode: 'ORIGINAL', ...(adminToken ? { p_admin_token: adminToken } : {}) }),
  });
  if (!response.ok) throw new Error('Download is not permitted. Check payment, expiry and file permissions.');
  const data = await response.json();
  if (!data) throw new Error('A delivery file is unavailable or access is not permitted.');
  if (!data.drive_file_id) throw new Error('Folders cannot be added to a ZIP.');
  return data;
}

async function fetchOriginal(fileId: string, auth: string): Promise<Response> {
  return fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${auth}` } });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return json(res, 405, 'Only POST is supported.');
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const token = String(body.token || '').trim();
    const ids = Array.isArray(body.files) ? [...new Set<string>(body.files.map((id: unknown) => String(id)))] : [];
    const adminToken = String(req.headers?.['x-admin-token'] || '').trim();
    if (adminToken.length > 256) return json(res, 400, 'Invalid admin preview session.');
    if (!token || token.length < 12 || token.length > 128 || ids.length < 1 || ids.length > 5000) return json(res, 400, 'Invalid delivery ZIP request.');
    const files = [];
    for (const id of ids) {
      if (!/^[0-9a-f-]{36}$/i.test(id)) return json(res, 400, 'Invalid delivery file ID.');
      files.push(await getFile(token, id, adminToken || undefined));
    }
    const auth = await getDriveAccessToken();
    const zip = new JSZip();
    const used = new Set<string>();
    for (const file of files) {
      const name = uniqueZipName(String(file.file_name || file.title || `delivery-${file.drive_file_id}.bin`), used);
      // Open each Drive stream when JSZip needs it instead of buffering every video.
      zip.file(name, Readable.from((async function* () {
        const response = await fetchOriginal(String(file.drive_file_id), auth);
        if (!response.ok || !response.body) throw new Error('A source file could not be read from Google Drive.');
        const reader = response.body.getReader();
        try {
          while (true) { const chunk = await reader.read(); if (chunk.done) break; yield Buffer.from(chunk.value); }
        } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
      })()));
    }
    res.status(200).setHeader('content-type', 'application/zip').setHeader('content-disposition', 'attachment; filename="ramyachobi-originals.zip"').setHeader('cache-control', 'private, no-store, max-age=0');
    await pipeline(zip.generateNodeStream({ type: 'nodebuffer', compression: 'STORE', streamFiles: true }), res);
  } catch (error: any) {
    if (!res.headersSent && !res.destroyed) return json(res, 502, error?.message || 'Original ZIP creation failed.');
    res.end();
  }
}
