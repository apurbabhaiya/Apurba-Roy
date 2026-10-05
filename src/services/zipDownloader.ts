import { Album, ClientSelectionSubmission, DrivePhoto } from '../types';
import { downloadOriginalPhoto, downloadOriginalZip } from './originalDownloadService';

/**
 * Downloads selected photos from Google Drive or image URLs and bundles them into a zip file.
 * Also includes an index manifest with photo filenames and client selection metadata.
 */
export async function downloadPhotosAsZip(
  photos: DrivePhoto[],
  options: {
    albumTitle: string;
    clientName?: string;
    accessToken?: string | null;
    zipFilename?: string;
    notes?: string;
    onProgress?: (completed: number, total: number, currentFileName: string) => void;
  }
): Promise<void> {
  // Server endpoint streams original bytes. No client-side thumbnail fallback,
  // fake placeholder, or preview re-encoding is allowed in an original ZIP.
  await downloadOriginalZip(photos, options.accessToken, (p) => {
    const total = photos.length;
    options.onProgress?.(p.percent ? Math.round((p.percent / 100) * total) : 0, total, p.status);
  });
}

/**
 * Helper to download all selected photos for a specific submission
 */
export async function downloadSubmissionAsZip(
  submission: ClientSelectionSubmission,
  album: Album,
  accessToken?: string | null,
  onProgress?: (completed: number, total: number, currentFileName: string) => void
): Promise<void> {
  const allPhotos: DrivePhoto[] = album.cachedPhotos || [];
  
  // Resolve each selected photo ID
  const selectedPhotos: DrivePhoto[] = submission.selectedPhotoIds.map((id) => {
    const found = allPhotos.find((p) => p.id === id);
    if (found) return found;
    return {
      id,
      name: `Photo_${id}.jpg`,
      mimeType: 'image/jpeg',
      webViewLink: `https://drive.google.com/uc?id=${id}`,
    };
  });

  const safeAlbum = album.title.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeClient = submission.clientName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const zipFilename = `${safeAlbum}_${safeClient}_Selected_Photos.zip`;

  await downloadPhotosAsZip(selectedPhotos, {
    albumTitle: album.title,
    clientName: submission.clientName,
    notes: submission.clientNotes,
    accessToken,
    zipFilename,
    onProgress,
  });
}

/**
 * Copy file names list or CSV to clipboard for direct Lightroom / Capture One filter
 */
export function exportFilenamesForLightroom(photos: DrivePhoto[]): string {
  // Returns filenames separated by commas or newlines, standard for Adobe Lightroom Library filter
  return photos.map((p) => p.name.replace(/\.[^/.]+$/, '')).join(', ');
}

function escapeCSV(str: string): string {
  if (!str) return '""';
  const escaped = String(str).replace(/"/g, '""');
  return `"${escaped}"`;
}

function triggerFileDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Export client selection as a structured JSON file formatted for Adobe Lightroom ingestion & workflow automation
 */
export function exportSelectionToJSON(
  submission: ClientSelectionSubmission,
  album?: Album | null
): void {
  const allPhotos: DrivePhoto[] = album?.cachedPhotos || [];
  const selectedPhotos = submission.selectedPhotoIds.map((id, index) => {
    const found = allPhotos.find((p) => p.id === id);
    const filename = found ? found.name : `Photo_${id}.jpg`;
    const baseName = filename.replace(/\.[^/.]+$/, '');
    return {
      sequenceNumber: index + 1,
      photoId: id,
      filename,
      baseName,
      mimeType: found?.mimeType || 'image/jpeg',
      rating: 5,
      colorLabel: 'Green',
      flag: 'Pick',
      webUrl: found?.webViewLink || '',
    };
  });

  const exportData = {
    exportFormat: 'Adobe_Lightroom_Ingestion_Manifest_v1',
    exportedAt: new Date().toISOString(),
    album: {
      id: album?.id || submission.albumId,
      title: album?.title || 'Wedding Album',
      coupleNames: album?.coupleNames || '',
      weddingDate: album?.weddingDate || '',
      driveFolderId: album?.driveFolderId || '',
      driveFolderName: album?.driveFolderName || '',
    },
    clientSubmission: {
      id: submission.id,
      clientName: submission.clientName,
      clientEmail: submission.clientEmail || '',
      submittedAt: submission.submittedAt,
      status: submission.status || 'completed',
      clientNotes: submission.clientNotes || '',
      totalSelected: selectedPhotos.length,
    },
    lightroomFilterString: selectedPhotos.map((p) => p.baseName).join(', '),
    photos: selectedPhotos,
  };

  const safeClient = (submission.clientName || 'Client').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeAlbum = (album?.title || 'Album').replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `${safeAlbum}_${safeClient}_Lightroom_Selection.json`;

  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  triggerFileDownload(blob, fileName);
}

/**
 * Export client selection as a CSV file compatible with Lightroom metadata ingestion, spreadsheet catalogs, and Capture One
 */
export function exportSelectionToCSV(
  submission: ClientSelectionSubmission,
  album?: Album | null
): void {
  const allPhotos: DrivePhoto[] = album?.cachedPhotos || [];
  const headers = [
    'Sequence',
    'Filename',
    'BaseName',
    'PhotoID',
    'Flag',
    'Rating',
    'ColorLabel',
    'ClientName',
    'ClientEmail',
    'AlbumTitle',
    'WeddingDate',
    'SubmittedAt',
    'Status',
    'ClientNotes',
  ];

  const rows = submission.selectedPhotoIds.map((id, index) => {
    const found = allPhotos.find((p) => p.id === id);
    const filename = found ? found.name : `Photo_${id}.jpg`;
    const baseName = filename.replace(/\.[^/.]+$/, '');
    return [
      String(index + 1),
      escapeCSV(filename),
      escapeCSV(baseName),
      escapeCSV(id),
      'Pick',
      '5',
      'Green',
      escapeCSV(submission.clientName || ''),
      escapeCSV(submission.clientEmail || ''),
      escapeCSV(album?.title || ''),
      escapeCSV(album?.weddingDate || ''),
      escapeCSV(submission.submittedAt || ''),
      escapeCSV(submission.status || 'completed'),
      escapeCSV(submission.clientNotes || ''),
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\r\n');
  const safeClient = (submission.clientName || 'Client').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeAlbum = (album?.title || 'Album').replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `${safeAlbum}_${safeClient}_Lightroom_Selection.csv`;

  const blob = new Blob([csvContent], {
    type: 'text/csv;charset=utf-8;',
  });
  triggerFileDownload(blob, fileName);
}

/**
 * Triggers an immediate direct browser download for an individual photo
 */
export async function downloadSinglePhoto(
  photo: DrivePhoto,
  accessToken?: string | null
): Promise<boolean> {
  try {
    await downloadOriginalPhoto(photo, accessToken);
    return true;
  } catch (err) {
    console.error('Error downloading individual photo:', err);
    return false;
  }
}
