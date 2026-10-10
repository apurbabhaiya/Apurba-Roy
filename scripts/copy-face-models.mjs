import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('public/face-models', { recursive: true });
for (const name of ['ssd_mobilenetv1_model', 'face_landmark_68_model', 'face_recognition_model']) {
  for (const suffix of ['-weights_manifest.json', '.bin']) {
    await copyFile(`node_modules/@vladmandic/face-api/model/${name}${suffix}`, `public/face-models/${name}${suffix}`);
  }
}

await copyFile('node_modules/@vladmandic/face-api/LICENSE', 'public/face-models/LICENSE');
