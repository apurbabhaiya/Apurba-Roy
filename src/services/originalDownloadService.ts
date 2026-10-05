import type { CustomerGalleryPhoto, DrivePhoto } from '../types';
import { generateDrivePreviewUrl } from './customerGalleryService';
import { getAccessToken } from './auth';

export type DownloadProgress = { loaded: number; total?: number; percent?: number; status: string };

function filenameFor(photo: CustomerGalleryPhoto | DrivePhoto): string {
  const name = photo.name || 'photo.jpg';
  return /\.[a-z0-9]{2,8}$/i.test(name) ? name : `${name}.jpg`;
}

export function previewUrlFor(photo: CustomerGalleryPhoto | DrivePhoto): string {
  const id = 'driveFileId' in photo ? photo.driveFileId : photo.id;
  const raw = 'thumbnailUrl' in photo ? (photo.thumbnailUrl || photo.previewUrl) : photo.thumbnailLink;
  return generateDrivePreviewUrl(id, raw);
}

async function readResponseBlob(response: Response, onProgress?: (progress: DownloadProgress) => void): Promise<Blob> {
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(detail || `Download failed (${response.status}).`);
  }
  if (!response.body) return response.blob();
  const total = Number(response.headers.get('content-length') || 0) || undefined;
  const reader = response.body.getReader();
  const chunks: BlobPart[] = [];
  let loaded = 0;
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    chunks.push(new Uint8Array(next.value).buffer as ArrayBuffer);
    loaded += next.value.byteLength;
    onProgress?.({ loaded, total, percent: total ? Math.round((loaded / total) * 100) : undefined, status: total ? `Downloading ${Math.round((loaded / total) * 100)}%` : `Downloading ${(loaded / 1048576).toFixed(1)} MB` });
  }
  return new Blob(chunks, { type: response.headers.get('content-type') || 'application/octet-stream' });
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export async function downloadPreviewPhoto(photo: CustomerGalleryPhoto | DrivePhoto, onProgress?: (progress: DownloadProgress) => void): Promise<void> {
  const url = previewUrlFor(photo);
  try {
    const response = await fetch(url, { mode: 'cors' });
    const blob = await readResponseBlob(response, onProgress);
    saveBlob(blob, `${filenameFor(photo).replace(/\.[^.]+$/, '')}-preview.jpg`);
  } catch {
    // Drive thumbnail endpoints may render in an <img> but reject CORS fetch.
    // The fallback remains the preview URL and can never become an original.
    const link = document.createElement('a'); link.href = url; link.download = `${filenameFor(photo).replace(/\.[^.]+$/, '')}-preview.jpg`; link.target = '_blank'; document.body.appendChild(link); link.click(); link.remove();
  }
}

export async function downloadOriginalPhoto(photo: CustomerGalleryPhoto | DrivePhoto, accessToken?: string | null, onProgress?: (progress: DownloadProgress) => void): Promise<void> {
  const id = 'driveFileId' in photo ? photo.driveFileId : photo.id;
  if (!id) throw new Error('This photo has no Google Drive file ID.');
  const token = accessToken || getAccessToken();
  const url = `/api/drive-original?fileId=${encodeURIComponent(id)}&filename=${encodeURIComponent(filenameFor(photo))}`;
  const response = await fetch(url, { headers: token ? { 'x-google-drive-token': token } : undefined, cache: 'no-store' });
  const blob = await readResponseBlob(response, onProgress);
  // A successful original endpoint must return a binary file. Never replace it with a preview.
  if (blob.size < 1) throw new Error('Original file was empty. Download stopped.');
  saveBlob(blob, filenameFor(photo));
}

export async function downloadOriginalZip(photos: Array<CustomerGalleryPhoto | DrivePhoto>, accessToken?: string | null, onProgress?: (progress: DownloadProgress) => void): Promise<void> {
  const files = photos.map((photo) => ({ id: 'driveFileId' in photo ? photo.driveFileId : photo.id, name: filenameFor(photo) }));
  if (!files.length) throw new Error('No photos selected.');
  const token = accessToken || getAccessToken();
  const response = await fetch('/api/drive-zip', { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { 'x-google-drive-token': token } : {}) }, body: JSON.stringify({ files }), cache: 'no-store' });
  const blob = await readResponseBlob(response, onProgress);
  if (blob.size < 22) throw new Error('Original ZIP was empty. Download stopped.');
  saveBlob(blob, 'ramyachobi-originals.zip');
}
