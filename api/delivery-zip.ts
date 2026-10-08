import JSZip from 'jszip';
import { getDriveAccessToken } from './_lib/driveAuth';

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

async function getFile(token: string, id: string) {
  const { url, key } = supabaseConfig();
  const response = await fetch(`${url}/rest/v1/rpc/get_delivery_media_by_token`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ p_token: token, p_file_id: id, p_mode: 'ORIGINAL' }),
  });
  if (!response.ok) throw new Error((await response.text()).slice(0, 300) || 'A delivery file is unavailable.');
  const data = await response.json();
  if (!data?.drive_file_id) throw new Error('Folders cannot be added to a ZIP.');
  return data;
}

async function fetchOriginal(fileId: string): Promise<Response> {
  const auth = await getDriveAccessToken();
  return fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${auth}` } });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return json(res, 405, 'Only POST is supported.');
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const token = String(body.token || '').trim();
    const ids = Array.isArray(body.files) ? body.files.map((id: unknown) => String(id)) : [];
    if (!token || token.length < 12 || ids.length < 1 || ids.length > 5000) return json(res, 400, 'Invalid delivery ZIP request.');
    const files = [];
    for (const id of ids) {
      if (!/^[0-9a-f-]{36}$/i.test(id)) return json(res, 400, 'Invalid delivery file ID.');
      files.push(await getFile(token, id));
    }
    const zip = new JSZip();
    const used = new Set<string>();
    for (const file of files) {
      const response = await fetchOriginal(String(file.drive_file_id));
      if (!response.ok) throw new Error(`Could not read ${file.file_name || file.title || 'file'} from Google Drive.`);
      let name = String(file.file_name || file.title || `delivery-${file.drive_file_id}.bin`).replace(/[\\/:*?"<>|\\u0000-\\u001f]/g, '_').slice(0, 220) || 'delivery-file';
      let base = name; let n = 2;
      while (used.has(name)) name = base.replace(/(\\.[^.]+)?$/, `_${n++}$1`);
      used.add(name);
      zip.file(name, Buffer.from(await response.arrayBuffer()));
    }
    const output = await zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' });
    res.status(200).setHeader('content-type', 'application/zip').setHeader('content-disposition', 'attachment; filename="ramyachobi-originals.zip"').setHeader('cache-control', 'private, no-store, max-age=0').end(output);
  } catch (error: any) {
    if (!res.headersSent) return json(res, 502, error?.message || 'Original ZIP creation failed.');
    res.end();
  }
}
