import assert from 'node:assert/strict';
import { attachmentHeader, safeFileName, uniqueZipName } from './fileName';

assert.equal(safeFileName('MCN05624.ARW'), 'MCN05624.ARW');
assert.equal(safeFileName('full.mp4'), 'full.mp4');
assert.equal(safeFileName('ছবি.jpg'), 'ছবি.jpg');
assert.equal(safeFileName('bad\r\n/name.jpg'), 'bad___name.jpg');
assert.equal(safeFileName('..'), 'ramyachobi-file');
const header = attachmentHeader('ছবি.jpg');
assert.match(header, /filename\*=UTF-8''/);
assert.ok(!/[^\x20-\x7e]/.test(header));
const used = new Set<string>();
assert.equal(uniqueZipName('photo.jpg', used), 'photo.jpg');
assert.equal(uniqueZipName('photo.jpg', used), 'photo_2.jpg');
assert.equal(uniqueZipName('photo.jpg', used), 'photo_3.jpg');
console.log('PASS: original names, Unicode headers, unsafe characters, duplicate ZIP names');
