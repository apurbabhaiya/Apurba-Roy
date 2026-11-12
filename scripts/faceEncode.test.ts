import assert from 'node:assert/strict';
import handler from '../api/_lib/faceEncode';

process.env.FACE_SERVICE_URL = 'https://encoder.example';
process.env.FACE_SERVICE_KEY = 's'.repeat(32);
process.env.VITE_SUPABASE_URL = 'https://auth.example';
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'test-publishable';
let calls: string[] = [];
let mode = 'ok';
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input: any, options: any) => {
  const url = String(input); calls.push(url);
  if (url.includes('/auth/v1/user')) return new Response(JSON.stringify(mode === 'anonymous' ? { id: 'user', is_anonymous: true } : { id: 'user', is_anonymous: false }), { status: 200, headers: { 'content-type': 'application/json' } });
  assert.equal(options.headers.Authorization, `Bearer ${process.env.FACE_SERVICE_KEY}`);
  assert.equal(options.headers['x-face-user'], 'user');
  if (mode === 'busy') return new Response('{}', { status: 429 });
  const vector = Array(512).fill(0); vector[0] = 1;
  return new Response(JSON.stringify({ embeddings: mode === 'malformed' ? [[1]] : [vector] }), { status: 200 });
};
async function request(method = 'POST', body: any = { image: 'aGVsbG8=', reference: true }, headers: any = { authorization: 'Bearer test-jwt' }) {
  const res: any = { code: 0, body: null, setHeader() {}, status(code: number) { this.code = code; return this; }, json(body: any) { this.body = body; return this; } };
  await handler({ method, body, headers }, res);
  return res;
}
try {
  assert.equal((await request('GET')).code, 405);
  assert.equal((await request('POST', undefined, {})).code, 401);
  assert.equal(calls.length, 0);
  mode = 'anonymous'; assert.equal((await request()).code, 401);
  mode = 'ok'; assert.equal((await request('POST', { image: 'https://private.example' })).code, 400);
  assert.equal((await request()).code, 200);
  mode = 'busy'; assert.equal((await request()).code, 429);
  mode = 'malformed'; assert.equal((await request()).code, 502);
  delete process.env.FACE_SERVICE_URL;
  assert.equal((await request()).code, 503);
  console.log('Face API authorization, payload, upstream and configuration checks passed');
} finally { globalThis.fetch = originalFetch; }
