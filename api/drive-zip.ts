type VercelRequest = any;
type VercelResponse = any;

type ZipFile = { id: string; name?: string };
type CentralEntry = { name: Buffer; crc: number; size: number; offset: number };

function u16(n: number) { const b = Buffer.alloc(2); b.writeUInt16LE(n & 0xffff); return b; }
function u32(n: number) { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); return b; }
function safeName(value: string, used: Set<string>): string {
  const base = (value || 'photo.jpg').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 240) || 'photo.jpg';
  let name = base; let i = 2;
  while (used.has(name)) name = `${base.replace(/(\.[^.]*)?$/, `_${i++}$1`)}`;
  used.add(name); return name;
}

let crcTable: number[] | null = null;
function crc32Chunk(data: Uint8Array, crc = 0xffffffff): number {
  if (!crcTable) { crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1); return c >>> 0; }); }
  for (const byte of data) crc = (crcTable[ (crc ^ byte) & 0xff ] ^ (crc >>> 8)) >>> 0;
  return crc >>> 0;
}
function json(res: VercelResponse, status: number, message: string) { res.status(status).setHeader('content-type', 'application/json').end(JSON.stringify({ error: message })); }

async function fetchOriginal(fileId: string, token?: string): Promise<Response> {
  const auth = token || process.env.GOOGLE_DRIVE_ACCESS_TOKEN || '';
  if (auth) return fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${auth}` } });
  let response = await fetch(`https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`, { redirect: 'follow' });
  if ((response.headers.get('content-type') || '').includes('text/html')) {
    const html = await response.text();
    const confirm = html.match(/confirm=([0-9A-Za-z_-]+)/)?.[1];
    if (!confirm) throw new Error('Google Drive did not expose the original binary. Check that the file is shared for download.');
    const cookie = response.headers.get('set-cookie') || '';
    response = await fetch(`https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=${confirm}`, { headers: cookie ? { cookie } : undefined, redirect: 'follow' });
  }
  return response;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return json(res, 405, 'Only POST is supported.');
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const files: ZipFile[] = Array.isArray(body.files) ? body.files : [];
  if (!files.length || files.length > 20000) return json(res, 400, 'No files supplied or file count is too large.');
  const used = new Set<string>();
  const token = String(req.headers['x-google-drive-token'] || '');
  const entries: CentralEntry[] = [];
  let offset = 0;
  const write = async (value: Buffer) => { if (!res.write(value)) await new Promise<void>((resolve) => res.once('drain', resolve)); offset += value.length; };

  try {
    res.status(200).setHeader('content-type', 'application/zip').setHeader('content-disposition', 'attachment; filename="ramyachobi-originals.zip"').setHeader('cache-control', 'private, no-store, max-age=0');
    for (const file of files) {
      if (!file?.id || !/^[A-Za-z0-9_-]{10,}$/.test(file.id)) throw new Error('Invalid Drive file ID in ZIP request.');
      const name = safeName(file.name || `${file.id}.jpg`, used);
      const nameBuf = Buffer.from(name, 'utf8');
      const localOffset = offset;
      await write(Buffer.concat([u32(0x04034b50), u16(20), u16(0x08), u16(0), u16(0), u16(0), u32(0), u32(0), u32(0), u16(nameBuf.length), u16(0), nameBuf]));
      const upstream = await fetchOriginal(file.id, token);
      if (!upstream.ok || !upstream.body) throw new Error(`Original file unavailable: ${name}`);
      const reader = upstream.body.getReader(); let crc = 0xffffffff; let size = 0;
      while (true) { const next = await reader.read(); if (next.done) break; const chunk = Buffer.from(next.value); crc = crc32Chunk(chunk, crc); size += chunk.length; await write(chunk); }
      crc = (crc ^ 0xffffffff) >>> 0;
      await write(Buffer.concat([u32(0x08074b50), u32(crc), u32(size), u32(size)]));
      entries.push({ name: nameBuf, crc, size, offset: localOffset });
    }
    const centralOffset = offset;
    for (const entry of entries) await write(Buffer.concat([u32(0x02014b50), u16(20), u16(20), u16(0x08), u16(0), u16(0), u16(0), u32(entry.crc), u32(entry.size), u32(entry.size), u16(entry.name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(entry.offset), entry.name]));
    const centralSize = offset - centralOffset;
    await write(Buffer.concat([u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length), u32(centralSize), u32(centralOffset), u16(0)]));
    res.end();
  } catch (error: any) {
    if (!res.headersSent) return json(res, 502, error?.message || 'Original ZIP creation failed.');
    res.destroy(error);
  }
}
