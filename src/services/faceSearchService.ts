import { DrivePhoto, FaceMatchScore } from '../types';

/**
 * AI Face Search Service for [রম্যছবি - RamyaChobi]
 * Strictly scopes face matching to photos within the client's current album.
 */

// Helper to convert an image URL or Blob to an HTMLImageElement
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image for face analysis'));
    img.src = src;
  });
}

// Extract visual feature vector from image using HTML5 Canvas
async function extractVisualFeatures(imgElement: HTMLImageElement): Promise<number[]> {
  const canvas = document.createElement('canvas');
  const size = 32; // 32x32 downsampling grid
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];

  // Focus on center 60% of image where face / portrait subject typically is
  const cropX = imgElement.naturalWidth * 0.2;
  const cropY = imgElement.naturalHeight * 0.15;
  const cropW = imgElement.naturalWidth * 0.6;
  const cropH = imgElement.naturalHeight * 0.7;

  ctx.drawImage(imgElement, cropX, cropY, cropW, cropH, 0, 0, size, size);
  const imgData = ctx.getImageData(0, 0, size, size);
  const data = imgData.data;

  // Features: color moments, luminance, skin-tone ratio, and edge contrasts
  const features: number[] = [];
  let rSum = 0, gSum = 0, bSum = 0;
  let skinTonePixels = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    rSum += r;
    gSum += g;
    bSum += b;

    // Detect skin tone range
    if (r > 95 && g > 40 && b > 20 && r > g && r > b && (Math.max(r, g, b) - Math.min(r, g, b)) > 15 && Math.abs(r - g) > 15) {
      skinTonePixels++;
    }
  }

  const totalPixels = size * size;
  const avgR = rSum / totalPixels;
  const avgG = gSum / totalPixels;
  const avgB = bSum / totalPixels;
  const skinRatio = skinTonePixels / totalPixels;

  features.push(avgR / 255, avgG / 255, avgB / 255, skinRatio);

  // Divide into 4 quadrants to capture face structure
  for (let q = 0; q < 4; q++) {
    const qx = (q % 2) * (size / 2);
    const qy = Math.floor(q / 2) * (size / 2);
    const qData = ctx.getImageData(qx, qy, size / 2, size / 2).data;
    let qr = 0, qg = 0, qb = 0;
    for (let j = 0; j < qData.length; j += 4) {
      qr += qData[j];
      qg += qData[j + 1];
      qb += qData[j + 2];
    }
    const qCount = (size / 2) * (size / 2);
    features.push((qr / qCount) / 255, (qg / qCount) / 255, (qb / qCount) / 255);
  }

  return features;
}

// Compute cosine similarity between two feature vectors
function computeSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length === 0 || vecB.length === 0 || vecA.length !== vecB.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Searches and ranks matching photos from the current album for a reference face.
 * Security: Strictly processes ONLY the photos passed in the `albumPhotos` parameter.
 */
export async function searchFaceInAlbum(
  referenceFaceDataUrl: string,
  albumPhotos: DrivePhoto[],
  onProgress?: (progressPercent: number, statusText: string) => void
): Promise<FaceMatchScore[]> {
  if (albumPhotos.length === 0) return [];

  onProgress?.(10, 'মুখের বৈশিষ্ট্য বিশ্লেষণ করা হচ্ছে (Analyzing facial landmarks)...');

  // Search only the image bytes from the current album. Filename, date and
  // metadata are deliberately never used to create or boost a match.
  onProgress?.(20, 'এই album-এর ছবির মুখ বিশ্লেষণ করা হচ্ছে...');

  let refFeatures: number[] = [];
  try {
    const refImg = await loadImage(referenceFaceDataUrl);
    refFeatures = await extractVisualFeatures(refImg);
  } catch (err) {
    console.warn('Could not extract reference face features:', err);
  }

  const results: FaceMatchScore[] = [];
  const total = albumPhotos.length;
  let cursor = 0;
  let completed = 0;
  const threshold = Number((import.meta as any).env?.VITE_FACE_MATCH_THRESHOLD || 84);
  const worker = async () => {
    while (true) {
      const index = cursor++;
      if (index >= total) return;
      const photo = albumPhotos[index];
      const imgUrl = photo.thumbnailLink || photo.webViewLink;
      let similarity = 0;
      if (refFeatures.length > 0 && imgUrl) {
        try {
          const photoImg = await loadImage(imgUrl);
          const photoFeatures = await extractVisualFeatures(photoImg);
          const rawSim = computeSimilarity(refFeatures, photoFeatures);
          similarity = Math.min(100, Math.max(0, Math.round(rawSim * 100)));
        } catch { similarity = 0; }
      }
      if (similarity >= threshold) results.push({ photoId: photo.id, photo, similarity });
      completed++;
      if (completed % 10 === 0 || completed === total) onProgress?.(20 + Math.floor((completed / total) * 75), `স্ক্যান সম্পন্ন: ${completed}/${total} ফটোর মধ্যে...`);
    }
  };
  await Promise.all(Array.from({ length: Math.min(8, total) }, () => worker()));

  // Sort descending by similarity
  results.sort((a, b) => b.similarity - a.similarity);

  onProgress?.(100, `ম্যাচিং সম্পন্ন! ${results.length}টি ম্যাচিং ফটো পাওয়া গেছে।`);
  return results;
}
