import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import driveAdmin from '../api/drive-admin';

process.env.APP_URL = 'https://example.test';
const config = JSON.parse(await readFile('vercel.json', 'utf8'));
const names = ['drive-list', 'drive-oauth-start', 'drive-oauth-callback', 'drive-status'];
async function call(route: unknown, method: string) {
  let code = 0, text = '', headers: Record<string, string> = {};
  const res: any = { status(value: number) { code = value; return this; }, setHeader(name: string, value: string) { headers[name] = value; return this; },
    end(data?: string) { text = data || ''; return this; }, send(data: string) { text = data; return this; } };
  await driveAdmin({ query: { route }, method, body: {} }, res);
  return { code, text, headers };
}
for (const name of names) {
  assert.equal(config.rewrites.find((r: any) => r.source === `/api/${name}`).destination, `/api/drive-admin?route=${name}`);
  assert.equal((await call(name, 'DELETE')).code, 405, `legacy method gate retained for ${name}`);
}
for (const name of ['drive-list', 'drive-oauth-start', 'drive-status']) {
  assert.equal((await call(name, 'POST')).code, 401, `legacy admin authorization retained for ${name}`);
}
const cancelled = await call('drive-oauth-callback', 'GET');
assert.equal(cancelled.code, 302);
assert.ok(cancelled.headers.location.startsWith('https://example.test/delivery-admin?drive=error'));
assert.equal((await call(['drive-status', 'drive-list'], 'POST')).code, 404);
assert.equal((await call('__proto__', 'POST')).code, 404);
assert.ok((await readdir('api')).filter(p => p.endsWith('.ts')).length <= 12);
console.log('Legacy Drive URLs, method/auth gates, callback redirect and Hobby function count passed.');
