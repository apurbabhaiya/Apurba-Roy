import { createClient } from '@supabase/supabase-js';

export const config = { maxDuration: 60 };

export default async function handler(req: any, res: any) {
  res.setHeader('cache-control', 'private, no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Only POST is supported.' });
  const endpoint = process.env.FACE_SERVICE_URL;
  const secret = process.env.FACE_SERVICE_KEY;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!endpoint || !secret || !url || !key) return res.status(503).json({ error: 'InsightFace service is not configured. Contact the studio.' });
  const token = String(req.headers.authorization || '').replace(/^Bearer /, '');
  if (!token) return res.status(401).json({ error: 'Sign in before using face search.' });
  try {
    const auth = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await auth.auth.getUser(token);
    if (error || !data.user || data.user.is_anonymous) return res.status(401).json({ error: 'Sign in before using face search.' });
    const { image, reference } = req.body || {};
    if (typeof image !== 'string' || image.length > 2_666_672 || !/^[A-Za-z0-9+/]+={0,2}$/.test(image) || (reference !== undefined && typeof reference !== 'boolean')) {
      return res.status(400).json({ error: 'A valid image under 2 MB is required.' });
    }
    const target = new URL('/encode', endpoint);
    if (target.protocol !== 'https:' && target.hostname !== 'localhost' && target.hostname !== '127.0.0.1') throw new Error('Insecure face endpoint');
    const upstream = await fetch(target, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(50_000),
      headers: { Authorization: `Bearer ${secret}`, 'content-type': 'application/json', 'x-face-user': data.user.id },
      body: JSON.stringify({ image, reference: reference === true }),
    });
    if (!upstream.ok) {
      const message = upstream.status === 422 ? 'Use a clear photo containing exactly one face.' : upstream.status === 429 ? 'Face service is busy. Try again shortly.' : 'InsightFace could not process this image.';
      return res.status([400, 422, 429].includes(upstream.status) ? upstream.status : 502).json({ error: message });
    }
    const result = await upstream.json();
    if (!Array.isArray(result.embeddings) || result.embeddings.length > 100 || result.embeddings.some((v: unknown) => !Array.isArray(v) || v.length !== 512 || v.some(n => typeof n !== 'number' || !Number.isFinite(n)))) throw new Error('Invalid encoder response');
    return res.status(200).json({ embeddings: result.embeddings });
  } catch {
    return res.status(502).json({ error: 'InsightFace service is unavailable. Try again later.' });
  }
}
