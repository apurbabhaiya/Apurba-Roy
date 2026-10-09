import { createHash, timingSafeEqual } from 'node:crypto';

export const MODEL_VERSION = 'face-api-1.7.15-ssd-1600-v1';
export class FaceHttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

function config() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new FaceHttpError(503, 'Face indexing server configuration is missing.');
  return { url, key };
}
export async function faceDb<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const { url, key } = config();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init, headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json', ...init.headers },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new FaceHttpError(503, 'Face index database is unavailable.');
  return response.status === 204 ? undefined as T : response.json();
}
export const faceRpc = <T = any>(name: string, body: unknown) => faceDb<T>(`rpc/${name}`, { method: 'POST', body: JSON.stringify(body) });

export async function authorizeFaceGallery(req: any, galleryId: unknown, admin = false, pin?: unknown) {
  if (!uuid(galleryId)) throw new FaceHttpError(400, 'Invalid album.');
  const header = req.headers?.authorization;
  if (typeof header !== 'string' || !header.startsWith('Bearer ') || header.length > 8192) throw new FaceHttpError(401, 'Sign in to this gallery first.');
  const { url, key } = config();
  const response = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, authorization: header }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new FaceHttpError(401, 'Your gallery session has expired. Reopen the client link.');
  const user = await response.json();
  if (!uuid(user.id)) throw new FaceHttpError(401, 'Invalid gallery session.');
  const [gallery] = await faceDb<any[]>(`galleries?id=eq.${galleryId}&select=id,created_by,status,selection_deadline,pin_enabled,pin_hash&limit=1`);
  if (!gallery) throw new FaceHttpError(404, 'Album is unavailable.');
  const owner = !user.is_anonymous && gallery.created_by === user.id;
  if (admin && !owner) throw new FaceHttpError(403, 'Only this album’s owner can manage its face index.');
  if (!owner) {
    const [access] = await faceDb<any[]>(`gallery_access?gallery_id=eq.${galleryId}&user_id=eq.${user.id}&select=gallery_id&limit=1`);
    if (!access || !['active', 'selection_in_progress', 'submitted', 'approved'].includes(gallery.status) ||
      (gallery.selection_deadline && Date.parse(gallery.selection_deadline) + 86400000 < Date.now())) {
      throw new FaceHttpError(403, 'This gallery session is not authorized or has expired.');
    }
    if (gallery.pin_enabled) {
      const computed = createHash('sha256').update(`rcfoto_salt_${typeof pin === 'string' ? pin.trim() : ''}`).digest('hex');
      const expected = String(gallery.pin_hash || '').toLowerCase();
      if (expected.length !== computed.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(computed))) throw new FaceHttpError(403, 'Enter this gallery’s PIN to use face search.');
    }
  }
  return { galleryId, userId: user.id, owner };
}
export function faceJson(res: any, status: number, data: unknown) {
  return res.status(status).setHeader('content-type', 'application/json').setHeader('cache-control', 'private, no-store').end(JSON.stringify(data));
}
export function faceError(res: any, error: unknown) {
  return faceJson(res, error instanceof FaceHttpError ? error.status : 503, { error: error instanceof FaceHttpError ? error.message : 'Face search is temporarily unavailable. Please retry.' });
}
export function bodyOf(req: any) {
  try { return typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}; }
  catch { throw new FaceHttpError(400, 'Invalid request.'); }
}
