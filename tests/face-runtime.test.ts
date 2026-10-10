import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { describeFaces } from '../api/_lib/faceRuntime';
import { descriptorDistance } from '../src/services/faceMatchMath';

const fixture = process.env.FACE_TEST_IMAGE;
if (!fixture) throw new Error('Set FACE_TEST_IMAGE to an authorized local reference portrait.');
const bytes = await readFile(fixture);
const started = Date.now();
const first = await describeFaces(bytes);
assert.equal(first.length, 1);
assert.equal(first[0].length, 128);
const second = await describeFaces(bytes);
assert.ok(descriptorDistance(first[0], second[0]) < 0.0001, 'repeat inference should match the identical fixture');
const blank = await sharp({ create: { width: 256, height: 256, channels: 3, background: '#fff' } }).png().toBuffer();
assert.deepEqual(await describeFaces(blank), []);
console.log(`Node WASM inference: identical portrait matches, blank has no face; ${Date.now() - started}ms total. This is not an identity accuracy evaluation.`);
