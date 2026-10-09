import { createRequire } from 'node:module';
import path from 'node:path';
import sharp from 'sharp';

const require = createRequire(import.meta.url);
export const FACE_MODEL_VERSION = 'face-api-1.7.15-ssd-1600-v1';
type FaceApi = typeof import('@vladmandic/face-api');
let loading: Promise<FaceApi> | undefined;
let inferenceTail: Promise<unknown> = Promise.resolve();

async function models(): Promise<FaceApi> {
  if (!loading) loading = (async () => {
    // This build uses Node WASM, not the browser TF bundle or native tfjs-node.
    const api = require('@vladmandic/face-api/dist/face-api.node-wasm.js') as FaceApi;
    const wasm = require('@tensorflow/tfjs-backend-wasm');
    wasm.setWasmPaths(path.dirname(require.resolve('@tensorflow/tfjs-backend-wasm/dist/tfjs-backend-wasm.wasm')) + '/');
    wasm.setThreadsCount(1);
    const tf = api.tf as unknown as typeof import('@tensorflow/tfjs');
    await tf.setBackend('wasm');
    await tf.ready();
    const modelPath = path.join(path.dirname(require.resolve('@vladmandic/face-api/package.json')), 'model');
    await Promise.all([
      api.nets.ssdMobilenetv1.loadFromDisk(modelPath),
      api.nets.faceLandmark68Net.loadFromDisk(modelPath),
      api.nets.faceRecognitionNet.loadFromDisk(modelPath),
    ]);
    return api;
  })().catch(error => { loading = undefined; throw error; });
  return loading;
}

export async function describeFaces(bytes: Buffer): Promise<number[][]> {
  // Fluid Compute can reuse an instance concurrently. Serialize tensor inference.
  const work = inferenceTail.then(async () => {
    const api = await models();
    const { data, info } = await sharp(bytes, { limitInputPixels: 40_000_000 })
      .rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
    const tensor = api.tf.tensor3d(new Uint8Array(data), [info.height, info.width, 3]);
    try {
      const faces = await api.detectAllFaces(tensor, new api.SsdMobilenetv1Options({ minConfidence: 0.5, maxResults: 100 }))
        .withFaceLandmarks().withFaceDescriptors();
      return faces.map(face => Array.from(face.descriptor));
    } finally { tensor.dispose(); }
  });
  inferenceTail = work.catch(() => undefined);
  return work;
}

function allowedPreview(url: URL) {
  return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
    (url.hostname === 'drive.google.com' || url.hostname.endsWith('.googleusercontent.com'));
}

async function boundedImage(url: URL): Promise<Buffer> {
  const signal = AbortSignal.timeout(20000);
  for (let redirects = 0; redirects < 5; redirects++) {
    if (!allowedPreview(url)) throw new Error('PREVIEW_ACCESS');
    const response = await fetch(url, { redirect: 'manual', signal });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw new Error('PREVIEW_ACCESS');
      url = new URL(location, url);
      continue;
    }
    if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error('PREVIEW_ACCESS');
    if (Number(response.headers.get('content-length')) > 12_000_000) throw new Error('IMAGE_TOO_LARGE');
    const reader = response.body?.getReader();
    if (!reader) throw new Error('PREVIEW_ACCESS');
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.length;
        if (length > 12_000_000) throw new Error('IMAGE_TOO_LARGE');
        chunks.push(value);
      }
      return Buffer.concat(chunks);
    } finally { await reader.cancel().catch(() => undefined); }
  }
  throw new Error('PREVIEW_ACCESS');
}

export async function readAlbumPreview(photo: { drive_file_id: string; thumbnail_url?: string }): Promise<Buffer> {
  if (!/^[A-Za-z0-9_-]{10,256}$/.test(photo.drive_file_id)) throw new Error('PREVIEW_ACCESS');
  // Only Drive previews belonging to a DB-verified album photo. Delivery OAuth stays separate.
  try {
    return await boundedImage(new URL(`https://drive.google.com/thumbnail?id=${encodeURIComponent(photo.drive_file_id)}&sz=w1600`));
  } catch {
    if (!photo.thumbnail_url) throw new Error('PREVIEW_ACCESS');
    let url: URL;
    try { url = new URL(photo.thumbnail_url); } catch { throw new Error('PREVIEW_ACCESS'); }
    if (!allowedPreview(url) || !url.hostname.endsWith('.googleusercontent.com')) throw new Error('PREVIEW_ACCESS');
    url.pathname = url.pathname.replace(/=s\d+(?:-[a-z]+)*$/, '=s1600');
    return boundedImage(url);
  }
}
