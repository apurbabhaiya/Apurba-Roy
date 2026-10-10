import assert from 'node:assert/strict';
import faceSearch from '../api/face-search';
import { authorizeFaceGallery, MODEL_VERSION } from '../api/_lib/faceIndex';

process.env.SUPABASE_URL = 'https://test.supabase.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-server-key';
const galleryId = 'e74cecd4-0cf6-438a-8170-50fed0d3eb1a';
const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
let owner = false, claimed = true, active = true, pending = 0, pin = false;
let rateAllowed = true;
let pages = 0;
const descriptor = Array.from({ length: 128 }, () => 0.1);
const coverage = () => ({ total: 1501, ready: 1501, pending, unindexed: 0, failed: 0, noFace: 0 });
globalThis.fetch = async (input, init) => {
  const url = String(input);
  const json = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } });
  assert.equal((init?.headers as any)?.apikey, 'test-server-key');
  if (url.includes('/auth/v1/user')) return json({ id: userId, is_anonymous: !owner });
  if (url.includes('/galleries?')) return json([{ id: galleryId, created_by: owner ? userId : 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', status: active ? 'active' : 'disabled', pin_enabled: pin, pin_hash: '' }]);
  if (url.includes('/gallery_access?')) return json(claimed ? [{ gallery_id: galleryId }] : []);
  if (url.includes('/rpc/face_index_rate_limit')) return json(rateAllowed);
  if (url.includes('/rpc/face_index_status')) return json(coverage());
  if (url.includes('/face_photo_index?')) {
    assert.ok(url.includes(`gallery_id=eq.${galleryId}`));
    assert.ok(url.includes(`model_version=eq.${MODEL_VERSION}`));
    pages++;
    const offset = Number(new URL(url).searchParams.get('offset'));
    return json(Array.from({ length: Math.min(100, Math.max(0, 1501 - offset)) }, (_, i) => ({
      photos: { drive_file_id: `photo-${offset + i}` },
      descriptors: [offset + i === 1500 ? descriptor : descriptor.map(x => x + 0.2)],
    })));
  }
  throw new Error(`Unexpected test request: ${new URL(url).pathname}`);
};
const request = (body: unknown) => ({ method: 'POST', headers: { authorization: 'Bearer test-session' }, body });
async function call(body: unknown, headers = request(body).headers) {
  let status = 0, response: any;
  const res: any = { status(code: number) { status = code; return this; }, setHeader() { return this; }, end(data: string) { response = JSON.parse(data); } };
  await faceSearch({ ...request(body), headers }, res);
  return { status, response };
}
assert.equal((await call({ galleryId, descriptor }, {} as any)).status, 401);
claimed = false;
assert.equal((await call({ galleryId, descriptor })).status, 403);
claimed = true; active = false;
assert.equal((await call({ galleryId, descriptor })).status, 403);
active = true; pin = true;
assert.equal((await call({ galleryId, descriptor })).status, 403);
pin = false;
await assert.rejects(authorizeFaceGallery(request({}), galleryId, true), (e: any) => e.status === 403);
assert.equal((await call({ galleryId, descriptor: [NaN] })).status, 400);
pending = 1;
assert.equal((await call({ galleryId, descriptor })).status, 409);
assert.equal(pages, 0, 'unfinished index must not return a false no-match');
pending = 0; rateAllowed = false;
assert.equal((await call({ galleryId, descriptor })).status, 429);
rateAllowed = true;
const result = await call({ galleryId, descriptor });
assert.equal(result.status, 200);
assert.equal(pages, 16, 'search must include photos beyond Supabase’s default 1000-row page');
assert.deepEqual(result.response.matches, [{ photoId: 'photo-1500', similarity: 100 }]);
assert.equal('descriptors' in result.response, false);
assert.equal(JSON.stringify(result.response).includes('test-server-key'), false);
console.log('Face API authorization, PIN gate, partial-index gate, rate limit and 1501-photo pagination passed.');
