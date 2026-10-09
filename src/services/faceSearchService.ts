import type { DrivePhoto, FaceMatchScore } from '../types';
import { descriptorDistance } from './faceMatchMath';
type FaceApi = typeof import('@vladmandic/face-api');
let modelPromise: Promise<FaceApi> | undefined;
// Session memory only: never persist reference images or biometric descriptors.
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
export interface FaceSearchReport {
  total: number; analyzed: number; failed: number; withoutFaces: number; faces: number; matched: number;
}
export async function searchFaceInAlbum(
  referenceFaceDataUrl: string, albumPhotos: DrivePhoto[],
  onProgress?: (progressPercent: number, statusText: string) => void,
  onReport?: (report: FaceSearchReport) => void,
): Promise<FaceMatchScore[]> {
  if (searchBusy) throw new Error('A face search is already running. Please wait.');
  if (!albumPhotos.length) throw new Error('This album has no photos to search.');
  searchBusy = true;
  try {
    onProgress?.(0, 'Loading face recognition models…');
    const api = await models();
    const refFaces = await detect(api, await loadImage(referenceFaceDataUrl));
    if (!refFaces.length) throw new Error('No clear face detected. Upload a sharp, front-facing portrait.');
    if (refFaces.length !== 1) throw new Error('More than one face detected. Crop the photo to the person you want to search.');
    const box = refFaces[0].detection.box;
    if (Math.min(box.width, box.height) < 60) throw new Error('The face is too small. Upload a closer portrait.');
    const ref = refFaces[0].descriptor;
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
