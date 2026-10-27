import type { DeliveryFinalFile, DeliveryPortalData } from '../services/deliveryPortalService';

export type DeliveryView = 'main' | 'photos' | 'videos' | 'recovery';
export function deliveryView(segment?: string): DeliveryView {
  return segment === 'photos' || segment === 'videos' || segment === 'recovery' ? segment : 'main';
}
export function deliveryPath(token: string, view: DeliveryView = 'main', adminPreview = false) {
  return `/delivery/${encodeURIComponent(token)}${view === 'main' ? '' : `/${view}`}${adminPreview ? '?preview=admin' : ''}`;
}
export function effectiveDeliveryExpiry(data: Pick<DeliveryPortalData, 'access_expires_at' | 'free_access_expires_at' | 'download_window_ends_at' | 'storage_retention_until'>) {
  const valid = (value?: string | null) => value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;
  const access = [valid(data.access_expires_at), valid(data.free_access_expires_at)].filter((value): value is number => value !== null);
  const limits = [access.length ? Math.max(...access) : null, valid(data.download_window_ends_at), valid(data.storage_retention_until)].filter((value): value is number => value !== null);
  return limits.length ? new Date(Math.min(...limits)).toISOString() : null;
}
export function deliveryFileAllowed(file: DeliveryFinalFile, data: DeliveryPortalData, now: number) {
  const expiry = effectiveDeliveryExpiry(data);
  if (data.download_status !== 'ENABLED' || data.gallery_status === 'UNAVAILABLE' || data.is_published === false || (expiry && Date.parse(expiry) <= now)) return false;
  return file.file_type === 'PHOTO' ? data.photo_download_permission === true
    : file.file_type === 'VIDEO' ? data.video_download_permission === true
    : file.file_type === 'DOCUMENT' ? data.document_download_permission === true : false;
}
export type DeliveryPreview = { key: string; title: string; kind: 'PHOTO' | 'VIDEO'; source?: string; file?: DeliveryFinalFile };
export function deliveryPreviews(data: DeliveryPortalData, kind: 'PHOTO' | 'VIDEO'): DeliveryPreview[] {
  const files = (data.delivery_files || []).filter(file => file.file_type === kind);
  if (files.length) return files.map(file => ({ key: file.id, title: file.title || file.file_name || (kind === 'PHOTO' ? 'Photo' : 'Video'), kind, file }));
  return (data.preview_items || []).filter(item => item.type === (kind === 'PHOTO' ? 'image' : 'video')).map((item, index) => ({ key: `legacy-${kind}-${index}`, title: item.title || `${kind === 'PHOTO' ? 'Photo' : 'Video'} ${index + 1}`, kind, source: item.url }));
}

// ZIP32 and browser memory are unsuitable for multi-GB video deliveries.
export function needsNativeBulkDownload(files: DeliveryFinalFile[]) {
  return files.some(file => file.file_type === 'VIDEO' || !Number.isFinite(Number(file.file_size_bytes)) || Number(file.file_size_bytes) <= 0)
    || files.reduce((total, file) => total + Number(file.file_size_bytes || 0), 0) > 100 * 1024 * 1024;
}
