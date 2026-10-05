import { CustomerGalleryPhoto } from '../types';
import { downloadOriginalZip } from './originalDownloadService';

export interface ArchiveProgress { current: number; total: number; percent: number; currentFileName: string; statusText: string; }
export interface ArchiveResult { success: boolean; downloadUrl: string; fileName: string; sizeFormatted: string; totalPhotos: number; error?: string; }

/**
 * Original selection archive. The browser sends Drive IDs to the server ZIP
 * endpoint. The server streams each original binary and never substitutes a
 * thumbnail, preview, placeholder or re-encoded image.
 */
export async function archiveSelectedPhotos(
  _projectId: string,
  _galleryName: string,
  selectedPhotos: CustomerGalleryPhoto[],
  onProgress?: (progress: ArchiveProgress) => void
): Promise<ArchiveResult> {
  try {
    const total = selectedPhotos.length;
    onProgress?.({ current: 0, total, percent: 0, currentFileName: '', statusText: 'Preparing original ZIP...' });
    await downloadOriginalZip(selectedPhotos, undefined, (progress) => {
      onProgress?.({ current: total, total, percent: progress.percent || 0, currentFileName: '', statusText: progress.status });
    });
    onProgress?.({ current: total, total, percent: 100, currentFileName: 'ramyachobi-originals.zip', statusText: 'Original ZIP ready.' });
    return { success: true, downloadUrl: '', fileName: 'ramyachobi-originals.zip', sizeFormatted: 'streamed', totalPhotos: total };
  } catch (error: any) {
    return { success: false, downloadUrl: '', fileName: '', sizeFormatted: '', totalPhotos: selectedPhotos.length, error: error?.message || 'Original ZIP failed.' };
  }
}
