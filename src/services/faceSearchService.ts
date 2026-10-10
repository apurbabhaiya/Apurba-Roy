import type { DrivePhoto, FaceMatchScore } from '../types';
import { descriptorDistance } from './faceMatchMath';
import { faceRequest, getFaceIndexStatus, type FaceIndexStatus } from './faceIndexService';
type FaceApi = typeof import('@vladmandic/face-api');
let modelPromise: Promise<FaceApi> | undefined;
// Legacy small-album cache stays in session memory. Reference images are never persisted.
const faceCache = new Map<string, Float32Array[]>();
let searchBusy = false;
async function models(): Promise<FaceApi> {
  if (!modelPromise) modelPromise = (async () => {
    const api = await import('@vladmandic/face-api');
    const tf = api.tf as unknown as { setBackend(name: string): Promise<boolean>; ready(): Promise<void> };
    try { if (!await tf.setBackend('webgl')) throw new Error('WebGL unavailable'); await tf.ready(); }
    catch { await tf.setBackend('cpu'); await tf.ready(); }
    await Promise.all([
      api.nets.ssdMobilenetv1.loadFromUri('/face-models'),
      api.nets.faceLandmark68Net.loadFromUri('/face-models'),
      api.nets.faceRecognitionNet.loadFromUri('/face-models'),
    ]);
    return api;
  })().catch(() => { modelPromise = undefined; throw new Error('Face models could not load. Check your connection and retry.'); });
  return modelPromise;
}
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timer = setTimeout(() => { img.src = ''; reject(new Error('Image loading timed out.')); }, 20000);
    img.crossOrigin = 'anonymous';
    img.onload = () => { clearTimeout(timer); resolve(img); };
    img.onerror = () => { clearTimeout(timer); reject(new Error('Image could not load.')); };
    img.src = src;
  });
}
async function detect(api: FaceApi, image: HTMLImageElement) {
  return api.detectAllFaces(image, new api.SsdMobilenetv1Options({ minConfidence: 0.5, maxResults: 100 }))
    .withFaceLandmarks().withFaceDescriptors();
}
export interface ReferenceFaceChoice { index: number; preview: string; }
export class FaceSelectionRequired extends Error {
  constructor(public faces: ReferenceFaceChoice[]) {
    super('একাধিক মুখ পাওয়া গেছে। যে মুখটি খুঁজবেন সেটি নির্বাচন করুন।');
  }
}
function faceCrop(image: HTMLImageElement, box: { x: number; y: number; width: number; height: number }) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 96;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('ছবিটি বিশ্লেষণ করা যায়নি। অন্য ছবি দিন।');
  ctx.drawImage(image, box.x, box.y, box.width, box.height, 0, 0, 96, 96);
  return canvas;
}
function assertClearReference(image: HTMLImageElement, face: Awaited<ReturnType<typeof detect>>[number]) {
  const box = face.detection.box;
  if (Math.min(box.width, box.height) < 60 || face.detection.score < 0.8)
    throw new Error('মুখটি ছোট বা স্পষ্ট নয়। কাছ থেকে তোলা পরিষ্কার ছবি দিন।');
  const pixels = faceCrop(image, box).getContext('2d')!.getImageData(0, 0, 96, 96).data;
  const gray = Array.from({ length: 96 * 96 }, (_, i) =>
    0.299 * pixels[i * 4] + 0.587 * pixels[i * 4 + 1] + 0.114 * pixels[i * 4 + 2]);
  let sum = 0, squared = 0, count = 0;
  for (let y = 1; y < 95; y++) for (let x = 1; x < 95; x++) {
    const i = y * 96 + x;
    const lap = gray[i - 1] + gray[i + 1] + gray[i - 96] + gray[i + 96] - 4 * gray[i];
    sum += lap; squared += lap * lap; count++;
  }
  // Conservative screening only. This does not measure identity-match accuracy.
  if (squared / count - (sum / count) ** 2 < 20)
    throw new Error('মুখটি ঝাপসা। পরিষ্কার নতুন ছবি দিয়ে চেষ্টা করুন।');
}
export interface FaceSearchReport {
  total: number; analyzed: number; failed: number; withoutFaces: number; faces: number; matched: number;
}
export async function searchFaceInAlbum(
  referenceFaceDataUrl: string, albumPhotos: DrivePhoto[],
  onProgress?: (progressPercent: number, statusText: string) => void,
  onReport?: (report: FaceSearchReport) => void,
  context?: { galleryId: string; pin?: string; referenceFaceIndex?: number },
): Promise<FaceMatchScore[]> {
  if (searchBusy) throw new Error('A face search is already running. Please wait.');
  if (!albumPhotos.length) throw new Error('This album has no photos to search.');
  searchBusy = true;
  try {
    const indexed = !!context && /^[0-9a-f-]{36}$/i.test(context.galleryId);
    if (!indexed && albumPhotos.length > 50) throw new Error('This large album needs a server face index. Ask the photographer to open its customer gallery and start indexing.');
    if (indexed) {
      onProgress?.(0, 'Checking album face index…');
      const coverage = await getFaceIndexStatus(context!.galleryId, context!.pin);
      if (coverage.pending || coverage.unindexed) throw new Error(`Face index is not ready: ${coverage.ready + coverage.noFace}/${coverage.total} photos processed. The photographer can start or resume indexing in Admin.`);
    }
    onProgress?.(0, 'Loading face recognition models…');
    const api = await models();
    const refImage = await loadImage(referenceFaceDataUrl);
    const refFaces = await detect(api, refImage);
    if (!refFaces.length) throw new Error('No clear face detected. Upload a sharp, front-facing portrait.');
    const selectedIndex = context?.referenceFaceIndex;
    if (refFaces.length > 1 && selectedIndex === undefined) {
      throw new FaceSelectionRequired(refFaces.map((face, index) => ({ index,
        preview: faceCrop(refImage, face.detection.box).toDataURL('image/jpeg', 0.85) })));
    }
    const index = selectedIndex ?? 0;
    if (!Number.isInteger(index) || index < 0 || index >= refFaces.length)
      throw new Error('মুখের নির্বাচন সঠিক নয়। ছবিটি আবার দিন।');
    assertClearReference(refImage, refFaces[index]);
    const ref = refFaces[index].descriptor;
    if (indexed) {
      onProgress?.(60, 'Comparing your face with this album’s private index…');
      const response = await faceRequest<{ matches: { photoId: string; similarity: number }[]; coverage: FaceIndexStatus }>('face-search', {
        galleryId: context!.galleryId, pin: context!.pin, descriptor: Array.from(ref),
      });
      const byId = new Map(albumPhotos.map(photo => [photo.id, photo]));
      const matches = response.matches.filter(match => byId.has(match.photoId)).map(match => ({ ...match, photo: byId.get(match.photoId)! }));
      const { total, ready, noFace, failed } = response.coverage;
      onReport?.({ total, analyzed: ready + noFace, failed, withoutFaces: noFace, faces: 0, matched: matches.length });
      onProgress?.(100, `${matches.length} matching photos · indexed ${ready + noFace}/${total} · unreadable ${failed} · no face ${noFace}`);
      return matches;
    }
    // Conservative starting limit, not a calibrated accuracy guarantee.
    const maxDistance = 0.5;
    const photos = Array.from(new Map(albumPhotos.map(photo => [photo.id, photo])).values());
    const report: FaceSearchReport = { total: photos.length, analyzed: 0, failed: 0, withoutFaces: 0, faces: 0, matched: 0 };
    const results: FaceMatchScore[] = [];
    for (const photo of photos) {
      const cacheKey = `${photo.id}:${photo.thumbnailLink || ''}:${photo.size || ''}`;
      try {
        let descriptors = faceCache.get(cacheKey);
        if (!descriptors) {
          // A Drive webViewLink is HTML, not image bytes. Use readable same-origin preview.
          const image = await loadImage(`/api/drive-preview?fileId=${encodeURIComponent(photo.id)}&width=1600`);
          descriptors = (await detect(api, image)).map(face => face.descriptor);
          if (faceCache.size >= 2000) faceCache.delete(faceCache.keys().next().value!);
          faceCache.set(cacheKey, descriptors);
        }
        report.analyzed++;
        report.faces += descriptors.length;
        if (!descriptors.length) report.withoutFaces++;
        const distance = Math.min(...descriptors.map(d => descriptorDistance(ref, d)));
        if (distance <= maxDistance) results.push({ photoId: photo.id, photo, similarity: Math.round((1 - distance) * 100) });
      } catch { report.failed++; }
      report.matched = results.length;
      onProgress?.(Math.round(((report.analyzed + report.failed) / report.total) * 100),
        `Checked ${report.analyzed + report.failed}/${report.total} · unreadable ${report.failed} · no face ${report.withoutFaces}`);
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    }
    onReport?.({ ...report });
    if (!report.analyzed) throw new Error('No album images could be analyzed. Check Drive preview access; this is not a no-match result.');
    results.sort((a, b) => b.similarity - a.similarity);
    onProgress?.(100, `${results.length} matching photos · analyzed ${report.analyzed}/${report.total} · unreadable ${report.failed} · no face ${report.withoutFaces}`);
    return results;
  } finally { searchBusy = false; }
}
