import { DrivePhoto, FaceMatchScore } from '../types';
import { supabase } from './supabase';
import { facebookAuth } from './facebookAccess';
import { cosineSimilarity } from './faceSimilarity';

// Session-memory cache only. No selfies, photos or biometric data persisted to disk.
const cache = new Map<string, { expires: number; vectors: number[][] }>();
const TTL = 15 * 60_000;

async function imageBase64(src: string): Promise<string> {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => { image.src = ''; reject(new Error('Photo loading timed out.')); }, 20_000);
    image.onload = () => { clearTimeout(timeout); resolve(); };
    image.onerror = () => { clearTimeout(timeout); reject(new Error('Album photo could not be read. Check Drive preview access.')); };
    image.src = src;
  });
  const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Image processing is unavailable.');
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const encoded = canvas.toDataURL('image/jpeg', .85).split(',')[1];
  if (!encoded || encoded.length > 2_666_672) throw new Error('Image is too large. Choose a smaller photo.');
  return encoded;
}

async function encode(image: string, token: string, reference: boolean): Promise<number[][]> {
  const response = await fetch('/api/face-encode', {
    method: 'POST', signal: AbortSignal.timeout(60_000),
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ image, reference }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'InsightFace request failed.');
  if (!Array.isArray(data.embeddings) || (reference && data.embeddings.length !== 1)) throw new Error('Invalid face response.');
  for (const vector of data.embeddings) cosineSimilarity(vector, vector);
  return data.embeddings;
}

export async function searchFaceInAlbum(
  referenceFaceDataUrl: string,
  albumPhotos: DrivePhoto[],
  onProgress?: (progressPercent: number, statusText: string) => void
): Promise<FaceMatchScore[]> {
  if (!albumPhotos.length) return [];
  const { data: facebook } = await facebookAuth.auth.getSession();
  const { data: studio } = await supabase.auth.getSession();
  const session = facebook.session || studio.session;
  if (!session || session.user.is_anonymous) throw new Error('Face Search ব্যবহার করতে লগইন করুন।');
  const token = session.access_token;
  const threshold = Number(import.meta.env.VITE_FACE_COSINE_THRESHOLD || .5);
  if (!Number.isFinite(threshold) || threshold <= 0 || threshold >= 1) throw new Error('Invalid face threshold configuration.');
  onProgress?.(0, 'InsightFace দিয়ে সেলফির মুখ শনাক্ত হচ্ছে...');
  const [reference] = await encode(await imageBase64(referenceFaceDataUrl), token, true);
  const results: FaceMatchScore[] = [];
  const photos = Array.from(new Map(albumPhotos.map(p => [p.id, p])).values());
  for (const [index, photo] of photos.entries()) {
    // Only process bytes already visible to this caller. Never send arbitrary URLs
    // or Drive IDs to a privileged backend for fetching private album content.
    const source = photo.thumbnailLink || photo.webViewLink;
    if (!source) throw new Error(`Photo preview missing: ${photo.name}`);
    const cacheKey = `${session.user.id}:${photo.id}:${source}`;
    const saved = cache.get(cacheKey);
    let vectors = saved && saved.expires > Date.now() ? saved.vectors : undefined;
    if (!vectors) {
      vectors = await encode(await imageBase64(source), token, false);
      for (const [key, value] of cache) if (value.expires <= Date.now()) cache.delete(key);
      if (cache.size >= 2000) cache.delete(cache.keys().next().value!);
      cache.set(cacheKey, { vectors, expires: Date.now() + TTL });
    }
    const score = vectors.length ? Math.max(...vectors.map(v => cosineSimilarity(reference, v))) : -1;
    if (score >= threshold) results.push({ photoId: photo.id, photo, similarity: Math.round(score * 100) });
    onProgress?.(Math.round(((index + 1) / photos.length) * 100), `মুখ বিশ্লেষণ সম্পন্ন: ${index + 1}/${photos.length}`);
  }
  results.sort((a, b) => b.similarity - a.similarity);
  onProgress?.(100, `${results.length}টি সম্ভাব্য মিলে যাওয়া ছবি পাওয়া গেছে।`);
  return results;
}
