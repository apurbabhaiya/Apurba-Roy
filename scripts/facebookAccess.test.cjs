const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildSync } = require('esbuild');
const vm = require('node:vm');
const fs = require('node:fs');

function fixture(enabled = true) {
  let clientOptions, oauthRequest;
  const source = fs.readFileSync('src/services/facebookAccess.ts', 'utf8')
    .replace(/import \{ createClient \} from '@supabase\/supabase-js';/, 'const createClient = globalThis.mockCreateClient;')
    .replace(/import \{ SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY \} from '.\/supabase';/, "const SUPABASE_URL = 'https://test.supabase.co'; const SUPABASE_PUBLISHABLE_KEY = 'publishable-test';");
  const result = buildSync({ stdin: { contents: source, loader: 'ts' }, format: 'cjs', write: false });
  const context = { module: { exports: {} }, URL, window: { location: { origin: 'https://apurba-roy-three.vercel.app', pathname: '/facebook-login' } },
    fetch: async () => ({ ok: true, json: async () => ({ external: { facebook: enabled } }) }),
    mockCreateClient: (_url, _key, options) => { clientOptions = options; return { auth: { signInWithOAuth: async request => { oauthRequest = request; return { error: null }; } } }; },
  };
  vm.runInNewContext(result.outputFiles[0].text, context);
  return { api: context.module.exports, options: () => clientOptions, request: () => oauthRequest };
}

test('return URLs cannot escape the gallery or origin', () => {
  const { api } = fixture();
  for (const path of ['https://evil.example', '//evil.example', '/\\evil.example', '/delivery-admin', '/client-gallery/../../delivery-admin', '/client-gallery\n/evil', '/client-galleryish']) assert.equal(api.galleryDestination(path), '/client-gallery');
  assert.equal(api.galleryDestination('/client-gallery/album?tab=photos'), '/client-gallery/album?tab=photos');
});
test('Facebook session has isolated storage and callback processing', () => {
  const { options } = fixture();
  assert.equal(options().auth.storageKey, 'ramyachobi-facebook-client-v1');
  assert.equal(options().auth.detectSessionInUrl, true);
});
test('disabled provider produces a useful error without starting OAuth', async () => {
  const f = fixture(false);
  await assert.rejects(f.api.facebookLogin('/face-search'), /Facebook Login এখনো চালু হয়নি/);
  assert.equal(f.request(), undefined);
});
test('OAuth returns to the exact requested gallery without Page permissions', async () => {
  const f = fixture();
  await f.api.facebookLogin('/client-gallery/album?tab=photos');
  const request = f.request();
  assert.equal(request.provider, 'facebook');
  assert.equal(request.options.scopes, 'email');
  const callback = new URL(request.options.redirectTo);
  assert.equal(callback.origin, 'https://apurba-roy-three.vercel.app');
  assert.equal(callback.pathname, '/facebook-login');
  assert.equal(callback.searchParams.get('next'), '/client-gallery/album?tab=photos');
});
