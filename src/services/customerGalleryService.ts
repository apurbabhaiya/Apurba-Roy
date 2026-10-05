import { supabase } from './supabase';
import { ensureAnonymousSupabaseAuth } from './supabaseAuth';
import {
  CustomerGallery,
  CustomerGalleryPhoto,
  CustomerPhotoSelection,
  CustomerGalleryStatus,
  SelectionHistoryEntry,
  SelectionHistoryAction,
} from '../types';

const LOCAL_STORAGE_GALLERIES_KEY = 'rcfoto_customer_galleries_v1';
const HISTORY_PREFIX = 'rcfoto_history_';

const INITIAL_SEED_GALLERIES: CustomerGallery[] = [];

const isUuid = (value?: string | null): boolean =>
  !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const newUuid = (): string => {
  const webCrypto = globalThis.crypto;
  if (webCrypto?.randomUUID) {
    return webCrypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (webCrypto?.getRandomValues) {
    webCrypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const currentUser = async () => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user || null;
};

const mapPhoto = (row: any): CustomerGalleryPhoto => ({
  id: row.drive_file_id || row.id,
  driveFileId: row.drive_file_id || row.id,
  name: row.file_name || 'Photo',
  thumbnailUrl: row.thumbnail_url || '',
  previewUrl: row.preview_url || row.thumbnail_url || '',
  originalUrl: row.original_url || undefined,
  mimeType: row.mime_type || undefined,
  size: row.size_text || undefined,
  width: row.width || undefined,
  height: row.height || undefined,
  createdTime: row.drive_created_time || row.created_at || undefined,
  folderId: row.folder_id || undefined,
});

const mapSelection = (row: any): CustomerPhotoSelection => ({
  photoId: row.drive_file_id || row.photo_id,
  driveFileId: row.drive_file_id || row.photo_id,
  fileName: row.file_name || '',
  thumbnailUrl: row.thumbnail_url || undefined,
  selectedAt: row.selected_at || row.created_at || new Date().toISOString(),
  selectionOrder: row.selection_order || 0,
});

const mapGallery = (
  row: any,
  photos: CustomerGalleryPhoto[] = [],
  selections: CustomerPhotoSelection[] = []
): CustomerGallery => ({
  id: row.id,
  ownerUid: row.created_by || undefined,
  customerName: row.client_name || 'Client',
  eventName: row.event_name || row.title || 'Event',
  galleryName: row.gallery_name || row.title || 'Gallery',
  customerPhone: row.client_phone || undefined,
  customerEmail: row.client_email || undefined,
  driveFolderId: row.drive_folder_id || '',
  driveFolderName: row.drive_folder_name || '',
  secureToken: row.secure_token || row.id,
  pinEnabled: !!row.pin_enabled,
  pinHash: row.pin_hash || undefined,
  maxSelections: row.selection_limit ?? 100,
  selectionDeadline: row.selection_deadline || '',
  allowDownloads: row.allow_downloads !== false,
  allowEditing: row.allow_editing !== false,
  status: (row.status || 'active') as CustomerGalleryStatus,
  totalPhotos: row.total_photos ?? photos.length,
  selectedCount: row.selected_count ?? selections.length,
  createdAt: row.created_at || new Date().toISOString(),
  updatedAt: row.updated_at || new Date().toISOString(),
  submittedAt: row.submitted_at || undefined,
  photos,
  selectedPhotoIds: Array.from(new Set(selections.map((s) => s.photoId))),
  selections,
  coverPhotoUrl: row.cover_photo_url || undefined,
  notesForCustomer: row.notes_for_customer || undefined,
  includeSubfolders: row.include_subfolders !== false,
  lastActivity: getRelativeTimeFormatted(row.updated_at),
  driveAccount: row.drive_account || undefined,
  collectedFolderId: row.collected_folder_id || undefined,
  askCustomerName: !!row.ask_customer_name,
  askCustomerPhone: !!row.ask_customer_phone,
  requireSocialFollow: !!row.require_social_follow,
  watermarkEnabled: !!row.watermark_enabled,
  watermarkText: row.watermark_text || 'Ramyachobi',
  watermarkLogoUrl: row.watermark_logo_url || undefined,
  allowOriginalDownloads: !!row.allow_original_downloads,
  zipRequested: !!row.zip_requested,
  zipRequestedAt: row.zip_requested_at || undefined,
  zipRequestStatus: row.zip_request_status || undefined,
  zipRequestNotes: row.zip_request_notes || undefined,
  zipRequestEmail: row.zip_request_email || undefined,
  zipRequestPhone: row.zip_request_phone || undefined,
  zipRequestedCount: row.zip_requested_count ?? undefined,
  zipDownloadUrl: row.zip_download_url || undefined,
  zipFulfilledAt: row.zip_fulfilled_at || undefined,
  zipAdminNotes: row.zip_admin_notes || undefined,
});

async function findGalleryRow(identifier: string): Promise<any | null> {
  const clean = identifier.trim();

  if (isUuid(clean)) {
    const { data, error } = await supabase
      .from('galleries')
      .select('*')
      .eq('id', clean)
      .maybeSingle();
    if (!error && data) return data;
  }

  const byToken = await supabase
    .from('galleries')
    .select('*')
    .eq('secure_token', clean)
    .maybeSingle();
  if (!byToken.error && byToken.data) return byToken.data;

  const byLegacy = await supabase
    .from('galleries')
    .select('*')
    .eq('legacy_id', clean)
    .maybeSingle();
  if (!byLegacy.error && byLegacy.data) return byLegacy.data;

  return null;
}

async function fetchSelectionsForGallery(galleryId: string): Promise<any[]> {
  const user = await currentUser();
  let q = supabase
    .from('selections')
    .select('*')
    .eq('gallery_id', galleryId)
    .eq('selected', true)
    .order('selection_order', { ascending: true });

  if (user?.is_anonymous) {
    q = q.eq('user_id', user.id);
  }

  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

async function updateGallerySelectionState(
  projectId: string,
  count: number,
  status: 'active' | 'selection_in_progress' | 'submitted',
  notes?: string
): Promise<void> {
  const user = await currentUser();
  if (!user) return;

  if (user.is_anonymous) {
    const { error } = await supabase.rpc('client_set_gallery_state', {
      p_gallery_id: projectId,
      p_selected_count: count,
      p_status: status,
      p_client_notes: notes ?? undefined,
    });
    if (error) throw error;
    return;
  }

  const payload: any = {
    selected_count: Math.max(count, 0),
    status,
    updated_at: new Date().toISOString(),
    submitted_at: status === 'submitted' ? new Date().toISOString() : null,
  };
  if (notes !== undefined) payload.client_notes = notes;

  const { error } = await supabase.from('galleries').update(payload).eq('id', projectId);
  if (error) throw error;
}

export function generateSecureToken(length = 15): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => chars[byte % chars.length]).join('');
  }
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function generateDriveThumbnailUrl(driveFileId: string, rawThumbnail?: string): string {
  if (rawThumbnail && rawThumbnail.startsWith('http')) {
    return rawThumbnail;
  }
  return `https://drive.google.com/thumbnail?id=${driveFileId}&sz=w800`;
}

export function generateDrivePreviewUrl(driveFileId: string, rawThumbnail?: string): string {
  if (rawThumbnail && rawThumbnail.startsWith('http')) {
    return rawThumbnail;
  }
  return `https://drive.google.com/thumbnail?id=${driveFileId}&sz=w2048`;
}

export function generateDriveDownloadUrl(driveFileId: string, webContentLink?: string): string {
  if (webContentLink && webContentLink.startsWith('http')) return webContentLink;
  return `https://drive.google.com/uc?export=download&id=${driveFileId}`;
}

export async function hashPin(pin: string): Promise<string> {
  const normalized = pin.trim();
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(`rcfoto_salt_${normalized}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
    hash |= 0;
  }
  return 'simple_' + Math.abs(hash).toString(16);
}

export async function verifyPin(inputPin: string, storedHash?: string): Promise<boolean> {
  if (!storedHash) return true;
  const computed = await hashPin(inputPin);
  return computed.toLowerCase() === storedHash.toLowerCase();
}

export function getLocalCustomerGalleries(): CustomerGallery[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_GALLERIES_KEY);
    if (!raw) return INITIAL_SEED_GALLERIES;
    return JSON.parse(raw);
  } catch {
    return INITIAL_SEED_GALLERIES;
  }
}

export function saveLocalCustomerGalleries(galleries: CustomerGallery[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_GALLERIES_KEY, JSON.stringify(galleries));
  } catch {}
}

export async function getCustomerGalleries(ownerUid?: string): Promise<CustomerGallery[]> {
  try {
    let q = supabase.from('galleries').select('*').order('updated_at', { ascending: false });
    if (ownerUid && isUuid(ownerUid)) q = q.eq('created_by', ownerUid);
    const { data, error } = await q;
    if (error) throw error;
    const list = (data || []).map((row) => mapGallery(row));
    saveLocalCustomerGalleries(list);
    return list;
  } catch (err) {
    console.warn('Supabase gallery list fallback:', err);
    return getLocalCustomerGalleries();
  }
}

export async function saveCustomerGallery(gallery: CustomerGallery): Promise<void> {
  const user = await currentUser();
  if (!user || user.is_anonymous) {
    throw new Error('Admin sign-in is required to save a gallery.');
  }

  const nowIso = new Date().toISOString();
  const legacyId = isUuid(gallery.id) ? undefined : gallery.id;
  if (!isUuid(gallery.id)) {
    gallery.id = newUuid();
  }

  const row = {
    id: gallery.id,
    legacy_id: legacyId || null,
    secure_token: gallery.secureToken || generateSecureToken(),
    title: gallery.galleryName || gallery.eventName || 'Client Gallery',
    client_name: gallery.customerName,
    client_email: gallery.customerEmail || null,
    client_phone: gallery.customerPhone || null,
    event_name: gallery.eventName || null,
    gallery_name: gallery.galleryName || null,
    drive_folder_id: gallery.driveFolderId || null,
    drive_folder_name: gallery.driveFolderName || null,
    pin_enabled: !!gallery.pinEnabled,
    pin_hash: gallery.pinHash || null,
    selection_limit: gallery.maxSelections || 100,
    selection_deadline: gallery.selectionDeadline || null,
    allow_downloads: gallery.allowDownloads !== false,
    allow_editing: gallery.allowEditing !== false,
    status: gallery.status || 'active',
    total_photos: gallery.photos?.length ?? gallery.totalPhotos ?? 0,
    selected_count: gallery.selectedCount || 0,
    cover_photo_url: gallery.coverPhotoUrl || null,
    notes_for_customer: gallery.notesForCustomer || null,
    include_subfolders: gallery.includeSubfolders !== false,
    drive_account: gallery.driveAccount || null,
    collected_folder_id: gallery.collectedFolderId || null,
    ask_customer_name: !!gallery.askCustomerName,
    ask_customer_phone: !!gallery.askCustomerPhone,
    require_social_follow: !!gallery.requireSocialFollow,
    watermark_enabled: !!gallery.watermarkEnabled,
    watermark_text: gallery.watermarkText || 'Ramyachobi',
    watermark_logo_url: gallery.watermarkLogoUrl || null,
    allow_original_downloads: !!gallery.allowOriginalDownloads,
    zip_requested: !!gallery.zipRequested,
    zip_requested_at: gallery.zipRequestedAt || null,
    zip_request_status: gallery.zipRequestStatus || null,
    zip_request_notes: gallery.zipRequestNotes || null,
    zip_request_email: gallery.zipRequestEmail || null,
    zip_request_phone: gallery.zipRequestPhone || null,
    zip_requested_count: gallery.zipRequestedCount ?? null,
    zip_download_url: gallery.zipDownloadUrl || null,
    zip_fulfilled_at: gallery.zipFulfilledAt || null,
    zip_admin_notes: gallery.zipAdminNotes || null,
    submitted_at: gallery.submittedAt || null,
    created_by: user.id,
    updated_at: nowIso,
  };

  const { error: galleryError } = await supabase.from('galleries').upsert(row, { onConflict: 'id' });
  if (galleryError) throw galleryError;

  const photos = gallery.photos || [];
  const { data: existingPhotoRows, error: existingPhotoError } = await supabase
    .from('photos')
    .select('id,drive_file_id')
    .eq('gallery_id', gallery.id);
  if (existingPhotoError) throw existingPhotoError;

  if (photos.length) {
    const photoRows = photos.map((photo, index) => ({
      gallery_id: gallery.id,
      drive_file_id: photo.driveFileId || photo.id,
      file_name: photo.name,
      thumbnail_url: photo.thumbnailUrl || null,
      preview_url: photo.previewUrl || null,
      mime_type: photo.mimeType || null,
      width: photo.width || null,
      height: photo.height || null,
      sort_order: index,
      size_text: photo.size || null,
      drive_created_time: photo.createdTime || null,
      folder_id: photo.folderId || null,
    }));

    const { error: photoError } = await supabase
      .from('photos')
      .upsert(photoRows, { onConflict: 'gallery_id,drive_file_id' });
    if (photoError) throw photoError;

    const liveDriveIds = new Set(photoRows.map((row) => row.drive_file_id));
    const staleIds = (existingPhotoRows || [])
      .filter((row: any) => !liveDriveIds.has(row.drive_file_id))
      .map((row: any) => row.id);

    if (staleIds.length) {
      const { error: staleDeleteError } = await supabase
        .from('photos')
        .delete()
        .in('id', staleIds);
      if (staleDeleteError) throw staleDeleteError;
    }
  } else if ((existingPhotoRows || []).length) {
    const { error: clearPhotosError } = await supabase
      .from('photos')
      .delete()
      .eq('gallery_id', gallery.id);
    if (clearPhotosError) throw clearPhotosError;
  }

  const updatedGallery: CustomerGallery = {
    ...gallery,
    secureToken: row.secure_token,
    totalPhotos: photos.length || gallery.totalPhotos || 0,
    updatedAt: nowIso,
  };

  const locals = getLocalCustomerGalleries().filter(
    (g) => g.id !== updatedGallery.id && (!legacyId || g.id !== legacyId)
  );
  saveLocalCustomerGalleries([updatedGallery, ...locals]);
}

export async function getCustomerGalleryByToken(identifier: string): Promise<CustomerGallery | null> {
  if (!identifier?.trim()) return null;

  try {
    let user = await currentUser();
    if (!user) {
      user = await ensureAnonymousSupabaseAuth();
    }
    if (!user) return null;

    let galleryRow: any | null = null;

    if (user.is_anonymous) {
      const { data: galleryId, error: claimError } = await supabase.rpc('claim_gallery_access', {
        p_identifier: identifier.trim(),
      });
      if (claimError || !galleryId) {
        console.warn('Gallery access claim failed:', claimError?.message);
        return null;
      }

      const { data, error } = await supabase
        .from('galleries')
        .select('*')
        .eq('id', galleryId)
        .single();
      if (error) throw error;
      galleryRow = data;
    } else {
      galleryRow = await findGalleryRow(identifier);
    }

    if (!galleryRow) return null;

    const [{ data: photoRows, error: photoError }, selectionRows] = await Promise.all([
      supabase
        .from('photos')
        .select('*')
        .eq('gallery_id', galleryRow.id)
        .order('sort_order', { ascending: true }),
      fetchSelectionsForGallery(galleryRow.id),
    ]);

    if (photoError) throw photoError;

    const photos = (photoRows || []).map(mapPhoto);
    const selections = selectionRows.map(mapSelection);
    const gallery = mapGallery(galleryRow, photos, selections);
    gallery.totalPhotos = photos.length;
    gallery.selectedCount = gallery.selectedPhotoIds?.length || 0;
    return gallery;
  } catch (err) {
    console.warn('Supabase gallery fetch fallback:', err);
    const locals = getLocalCustomerGalleries();
    return (
      locals.find((g) => g.id === identifier || g.secureToken === identifier) || null
    );
  }
}

export function subscribeToProjectSelections(
  projectId: string,
  callback: (selectedIds: string[]) => void
): () => void {
  let active = true;

  const emit = async () => {
    if (!active) return;
    try {
      const rows = await fetchSelectionsForGallery(projectId);
      callback(Array.from(new Set(rows.map((r) => r.drive_file_id || r.photo_id))));
    } catch (err) {
      console.warn('Selection realtime refresh notice:', err);
    }
  };

  void emit();

  const channel = supabase
    .channel(`gallery-selections-${projectId}-${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'selections', filter: `gallery_id=eq.${projectId}` },
      () => void emit()
    )
    .subscribe();

  return () => {
    active = false;
    void supabase.removeChannel(channel);
  };
}

export async function batchUpdateProjectSelections(
  projectId: string,
  changes: Map<string, boolean>,
  allPhotos: CustomerGalleryPhoto[],
  currentTotalSelected: number
): Promise<void> {
  if (changes.size === 0) return;

  const user = await currentUser();
  if (!user) throw new Error('Client session is not available.');

  const { data: photoRows, error: photoLookupError } = await supabase
    .from('photos')
    .select('id,drive_file_id')
    .eq('gallery_id', projectId);
  if (photoLookupError) throw photoLookupError;

  const photoIdMap = new Map<string, string>();
  (photoRows || []).forEach((row: any) => {
    if (row.drive_file_id) photoIdMap.set(row.drive_file_id, row.id);
  });

  const inserts: any[] = [];
  const deletes: string[] = [];
  let order = Math.max(currentTotalSelected - changes.size, 0);

  changes.forEach((selected, clientPhotoId) => {
    const dbPhotoId = photoIdMap.get(clientPhotoId);
    if (!dbPhotoId) return;

    if (selected) {
      const photo = allPhotos.find(
        (p) => p.id === clientPhotoId || p.driveFileId === clientPhotoId
      );
      inserts.push({
        gallery_id: projectId,
        photo_id: dbPhotoId,
        session_token: user.id,
        user_id: user.id,
        drive_file_id: photo?.driveFileId || clientPhotoId,
        file_name: photo?.name || clientPhotoId,
        thumbnail_url: photo?.thumbnailUrl || null,
        selected: true,
        selected_at: new Date().toISOString(),
        selection_order: ++order,
        updated_at: new Date().toISOString(),
      });
    } else {
      deletes.push(clientPhotoId);
    }
  });

  if (inserts.length) {
    const { error } = await supabase
      .from('selections')
      .upsert(inserts, { onConflict: 'photo_id,session_token' });
    if (error) throw error;
  }

  for (const driveFileId of deletes) {
    let q = supabase
      .from('selections')
      .delete()
      .eq('gallery_id', projectId)
      .eq('drive_file_id', driveFileId);

    if (user.is_anonymous) q = q.eq('user_id', user.id);
    else q = q.eq('session_token', user.id);

    const { error } = await q;
    if (error) throw error;
  }

  const status =
    currentTotalSelected > 0 ? 'selection_in_progress' : 'active';
  await updateGallerySelectionState(projectId, currentTotalSelected, status);
}

export async function clearAllProjectSelections(
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await currentUser();
    if (!user) throw new Error('Client session is not available.');

    let q = supabase.from('selections').delete().eq('gallery_id', projectId);
    if (user.is_anonymous) q = q.eq('user_id', user.id);

    const { error } = await q;
    if (error) throw error;

    await updateGallerySelectionState(projectId, 0, 'active');

    const locals = getLocalCustomerGalleries();
    const idx = locals.findIndex((g) => g.id === projectId);
    if (idx >= 0) {
      locals[idx].selectedPhotoIds = [];
      locals[idx].selections = [];
      locals[idx].selectedCount = 0;
      locals[idx].status = 'active';
      locals[idx].submittedAt = undefined;
      locals[idx].updatedAt = new Date().toISOString();
      saveLocalCustomerGalleries(locals);
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Could not clear selections' };
  }
}

export async function editCurrentSelection(projectId: string): Promise<boolean> {
  try {
    const rows = await fetchSelectionsForGallery(projectId);
    await updateGallerySelectionState(projectId, rows.length, rows.length ? 'selection_in_progress' : 'active');
    return true;
  } catch (err) {
    console.warn('Could not reopen selection:', err);
    return false;
  }
}

export async function submitProjectSelection(
  projectId: string,
  selectedPhotoIds: string[],
  customerNotes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await updateGallerySelectionState(
      projectId,
      selectedPhotoIds.length,
      'submitted',
      customerNotes || ''
    );
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Selection submission failed' };
  }
}

export async function updateCustomerSelections(
  token: string,
  selectedPhotoIds: string[],
  submitted = false,
  customerNotes?: string
): Promise<{ success: boolean; gallery?: CustomerGallery; error?: string }> {
  try {
    const gallery = await getCustomerGalleryByToken(token);
    if (!gallery) return { success: false, error: 'Gallery not found' };

    const current = new Set(gallery.selectedPhotoIds || []);
    const desired = new Set(selectedPhotoIds);
    const changes = new Map<string, boolean>();

    current.forEach((id) => {
      if (!desired.has(id)) changes.set(id, false);
    });
    desired.forEach((id) => {
      if (!current.has(id)) changes.set(id, true);
    });

    await batchUpdateProjectSelections(
      gallery.id,
      changes,
      gallery.photos || [],
      selectedPhotoIds.length
    );

    if (submitted) {
      const result = await submitProjectSelection(
        gallery.id,
        selectedPhotoIds,
        customerNotes
      );
      if (!result.success) return result;
    }

    const refreshed = await getCustomerGalleryByToken(gallery.id);
    return { success: true, gallery: refreshed || gallery };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Update failed' };
  }
}

export async function deleteCustomerGallery(galleryId: string): Promise<void> {
  const { error } = await supabase.from('galleries').delete().eq('id', galleryId);
  if (error) throw error;
  saveLocalCustomerGalleries(getLocalCustomerGalleries().filter((g) => g.id !== galleryId));
}

export async function updateCustomerGalleryStatus(
  galleryId: string,
  status: CustomerGalleryStatus
): Promise<void> {
  const { error } = await supabase
    .from('galleries')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', galleryId);
  if (error) throw error;

  const locals = getLocalCustomerGalleries();
  const idx = locals.findIndex((g) => g.id === galleryId);
  if (idx >= 0) {
    locals[idx].status = status;
    locals[idx].updatedAt = new Date().toISOString();
    saveLocalCustomerGalleries(locals);
  }
}

export async function resetCustomerSelections(galleryId: string): Promise<void> {
  const result = await clearAllProjectSelections(galleryId);
  if (!result.success) throw new Error(result.error);
}

export function subscribeToCustomerGalleries(
  callback: (galleries: CustomerGallery[]) => void
): () => void {
  let active = true;
  const emit = async () => {
    if (!active) return;
    try {
      callback(await getCustomerGalleries());
    } catch {}
  };

  void emit();

  const channel = supabase
    .channel(`admin-galleries-${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'galleries' }, () => void emit())
    .subscribe();

  return () => {
    active = false;
    void supabase.removeChannel(channel);
  };
}

export function subscribeToGalleryUpdates(
  galleryId: string,
  callback: (gallery: CustomerGallery) => void
): () => void {
  let active = true;

  const emit = async () => {
    if (!active) return;
    const row = await findGalleryRow(galleryId);
    if (row) callback(mapGallery(row));
  };

  void emit();

  const channel = supabase
    .channel(`gallery-row-${galleryId}-${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'galleries', filter: `id=eq.${galleryId}` },
      () => void emit()
    )
    .subscribe();

  return () => {
    active = false;
    void supabase.removeChannel(channel);
  };
}

export function getRelativeTimeFormatted(dateStr?: string): string {
  if (!dateStr) return 'Never';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffSecs = Math.floor((now.getTime() - d.getTime()) / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffSecs < 60) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins === 1 ? '' : 's'} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 30) return `${diffDays} days ago`;
    return d.toLocaleDateString();
  } catch {
    return dateStr;
  }
}

export function exportSelectedFilenamesToTxt(gallery: CustomerGallery): void {
  const filenames = (gallery.selectedPhotoIds || [])
    .map((pid, idx) => {
      const match = gallery.photos?.find((p) => p.id === pid || p.driveFileId === pid);
      return match?.name || `Photo_${idx + 1}`;
    })
    .join('\n');

  const blob = new Blob([filenames], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${gallery.customerName.replace(/[^a-zA-Z0-9]/g, '_')}_selected_filenames.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportSelectedPhotosToCsv(gallery: CustomerGallery): void {
  const headers = 'selection_order,file_name,file_id\n';
  const rows = (gallery.selectedPhotoIds || [])
    .map((pid, idx) => {
      const match = gallery.photos?.find((p) => p.id === pid || p.driveFileId === pid);
      return `${idx + 1},"${(match?.name || `Photo_${idx + 1}`).replace(/"/g, '""')}","${match?.driveFileId || pid}"`;
    })
    .join('\n');

  const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${gallery.customerName.replace(/[^a-zA-Z0-9]/g, '_')}_selections.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function copySelectedFilenamesToClipboard(gallery: CustomerGallery): Promise<boolean> {
  try {
    const text = (gallery.selectedPhotoIds || [])
      .map((pid) => {
        const match = gallery.photos?.find((p) => p.id === pid || p.driveFileId === pid);
        return match?.name || pid;
      })
      .join('\n');
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export async function requestProjectZip(
  projectId: string,
  requestData: {
    clientEmail?: string;
    clientPhone?: string;
    notes?: string;
    selectedCount: number;
    selectedPhotoIds: string[];
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await currentUser();
    if (!user) throw new Error('Client session is not available.');

    if (user.is_anonymous) {
      const { error } = await supabase.rpc('client_request_zip', {
        p_gallery_id: projectId,
        p_email: requestData.clientEmail || '',
        p_phone: requestData.clientPhone || '',
        p_notes: requestData.notes || '',
        p_selected_count: requestData.selectedCount,
      });
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('galleries')
        .update({
          zip_requested: true,
          zip_requested_at: new Date().toISOString(),
          zip_request_status: 'pending',
          zip_request_notes: requestData.notes || '',
          zip_request_email: requestData.clientEmail || '',
          zip_request_phone: requestData.clientPhone || '',
          zip_requested_count: requestData.selectedCount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId);
      if (error) throw error;
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'ZIP request failed' };
  }
}

export async function fulfillProjectZip(
  projectId: string,
  zipDownloadUrl: string,
  adminNotes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('galleries')
      .update({
        zip_download_url: zipDownloadUrl,
        zip_request_status: 'ready',
        zip_fulfilled_at: new Date().toISOString(),
        zip_admin_notes: adminNotes || '',
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'ZIP fulfillment failed' };
  }
}

export async function recordSelectionHistoryEntry(
  projectId: string,
  entry: Omit<SelectionHistoryEntry, 'id' | 'projectId'>
): Promise<SelectionHistoryEntry> {
  const user = await currentUser();
  const id = newUuid();
  const nowIso = entry.timestamp || new Date().toISOString();
  const historyData: SelectionHistoryEntry = {
    ...entry,
    id,
    projectId,
    timestamp: nowIso,
  };

  try {
    const { error } = await supabase.from('selection_history').insert({
      id,
      gallery_id: projectId,
      user_id: user?.id || null,
      session_id: isUuid(entry.sessionId) ? entry.sessionId : null,
      action: entry.action,
      description: entry.description,
      selected_photo_ids: entry.selectedPhotoIds || [],
      selected_count: entry.selectedCount || 0,
      affected_photo_id: entry.affectedPhotoId || null,
      affected_photo_name: entry.affectedPhotoName || null,
      client_name: entry.clientName || null,
      created_at: nowIso,
    });
    if (error) throw error;
  } catch (err) {
    console.warn('Selection history cloud write fallback:', err);
  }

  try {
    const key = `${HISTORY_PREFIX}${projectId}`;
    const raw = localStorage.getItem(key);
    const list: SelectionHistoryEntry[] = raw ? JSON.parse(raw) : [];
    localStorage.setItem(key, JSON.stringify([historyData, ...list].slice(0, 50)));
  } catch {}

  return historyData;
}

export function subscribeToSelectionHistory(
  projectId: string,
  callback: (entries: SelectionHistoryEntry[]) => void
): () => void {
  let active = true;

  try {
    const raw = localStorage.getItem(`${HISTORY_PREFIX}${projectId}`);
    if (raw) callback(JSON.parse(raw));
  } catch {}

  const emit = async () => {
    if (!active) return;
    try {
      const { data, error } = await supabase
        .from('selection_history')
        .select('*')
        .eq('gallery_id', projectId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;

      const list: SelectionHistoryEntry[] = (data || []).map((row: any) => ({
        id: row.id,
        projectId,
        action: (row.action || 'select') as SelectionHistoryAction,
        description: row.description || '',
        selectedPhotoIds: row.selected_photo_ids || [],
        selectedCount: row.selected_count || 0,
        affectedPhotoId: row.affected_photo_id || undefined,
        affectedPhotoName: row.affected_photo_name || undefined,
        timestamp: row.created_at,
        sessionId: row.session_id || undefined,
        clientName: row.client_name || undefined,
      }));
      callback(list);
      try {
        localStorage.setItem(`${HISTORY_PREFIX}${projectId}`, JSON.stringify(list));
      } catch {}
    } catch (err) {
      console.warn('History realtime refresh notice:', err);
    }
  };

  void emit();

  const channel = supabase
    .channel(`gallery-history-${projectId}-${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'selection_history', filter: `gallery_id=eq.${projectId}` },
      () => void emit()
    )
    .subscribe();

  return () => {
    active = false;
    void supabase.removeChannel(channel);
  };
}

export async function restoreSelectionSnapshot(
  projectId: string,
  targetPhotoIds: string[],
  galleryPhotos: CustomerGalleryPhoto[],
  actionReason: string = 'Restored snapshot'
): Promise<boolean> {
  try {
    const rows = await fetchSelectionsForGallery(projectId);
    const currentIds = new Set(rows.map((r) => r.drive_file_id || r.photo_id));
    const target = new Set(targetPhotoIds);
    const changes = new Map<string, boolean>();

    currentIds.forEach((id) => {
      if (!target.has(id)) changes.set(id, false);
    });
    target.forEach((id) => {
      if (!currentIds.has(id)) changes.set(id, true);
    });

    await batchUpdateProjectSelections(projectId, changes, galleryPhotos, targetPhotoIds.length);
    await recordSelectionHistoryEntry(projectId, {
      action: 'restore_snapshot',
      description: actionReason,
      selectedPhotoIds: targetPhotoIds,
      selectedCount: targetPhotoIds.length,
      timestamp: new Date().toISOString(),
    });

    return true;
  } catch (err) {
    console.warn('Restore selection snapshot failed:', err);
    return false;
  }
}
