import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { descriptorDistance } from '../src/services/faceMatchMath';
const reference = new Float32Array(128);
assert.equal(descriptorDistance(reference, reference), 0);
const near = reference.slice(); near[0] = 0.4;
assert.ok(descriptorDistance(reference, near) < 0.5);
const far = reference.slice(); far[0] = 0.6;
assert.ok(descriptorDistance(reference, far) > 0.5);
assert.equal(descriptorDistance(reference, new Float32Array(127)), Infinity);
const invalid = reference.slice(); invalid[12] = NaN;
assert.equal(descriptorDistance(reference, invalid), Infinity);
for (const name of ['ssd_mobilenetv1_model', 'face_landmark_68_model', 'face_recognition_model']) {
  const manifest = JSON.parse(await readFile(`public/face-models/${name}-weights_manifest.json`, 'utf8'));
  for (const group of manifest) for (const path of group.paths) {
    assert.ok((await stat(`public/face-models/${path}`)).size > 0);
  }
}
console.log('Descriptor validation, comparison boundaries and model asset manifests passed.');
