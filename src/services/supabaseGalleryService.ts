import { supabase } from './supabase';
import { ensureAnonymousSupabaseAuth } from './supabaseAuth';
import type {
  CustomerGallery,
  CustomerGalleryPhoto,
  CustomerGalleryStatus,
  CustomerPhotoSelection,
} from '../types';

type GalleryRow = Record<string, any>;
type PhotoRow = Record<string, any>;
type SelectionRow = Record<string, any>;

const mapPhoto = (row: PhotoRow): CustomerGalleryPhoto => ({
  id: row.drive_file_id || row.id,
  driveFileId: row.drive_file_id || row.id,
  name: row.file_name || 'Photo',
  thumbnailUrl: row.thumbnail_url || '',
  previewUrl: row.preview_url || row.thumbnail_url || '',
  mimeType: row.mime_type || undefined,
  size: row.size_text || undefined,
  width: row.width || undefined,
  height: row.height || undefined,
  createdTime: row.drive_created_time || row.created_at || undefined,
  folderId: row.folder_id || undefined,
});

const mapSelection = (row: SelectionRow): CustomerPhotoSelection => ({
  photoId: row.drive_file_id || row.photo_id,
  driveFileId: row.drive_file_id || row.photo_id,
  fileName: row.file_name || '',
  thumbnailUrl: row.thumbnail_url || undefined,
  selectedAt: row.selected_at || row.created_at || new Date().toISOString(),
  selectionOrder: row.selection_order || 0,
});

const mapGallery = (
  row: GalleryRow,
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
  secureToken: row.secure_token,
  pinEnabled: Boolean(row.pin_enabled),
  pinHash: row.pin_hash || undefined,
  maxSelections: row.selection_limit ?? 100,
  selectionDeadline: row.selection_deadline || '',
  allowDownloads: row.allow_downloads ?? true,
  allowEditing: row.allow_editing ?? true,
  status: row.status as CustomerGalleryStatus,
  totalPhotos: row.total_photos ?? photos.length,
  selectedCount: row.selected_count ?? selections.length,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  submittedAt: row.submitted_at || undefined,
  photos,
  selections,
  selectedPhotoIds: selections.map((s) => s.photoId),
  coverPhotoUrl: row.cover_photo_url || undefined,
  notesForCustomer: row.notes_for_customer || undefined,
  includeSubfolders: row.include_subfolders ?? true,
  driveAccount: row.drive_account || undefined,
  collectedFolderId: row.collected_folder_id || undefined,
  askCustomerName: row.ask_customer_name ?? false,
  askCustomerPhone: row.ask_customer_phone ?? false,
  zipRequested: row.zip_requested ?? false,
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

export async function getSupabaseGalleryByToken(
  secureToken: string
): Promise<CustomerGallery | null> {
  const user = await ensureAnonymousSupabaseAuth();
  if (!user) throw new Error('Could not create a client session.');

  const { data: claimedId, error: claimError } = await supabase.rpc(
    'claim_gallery_access',
    { p_identifier: secureToken }
  );
  if (claimError) return null;

  const galleryId = claimedId as string;

  const [{ data: gallery, error: galleryError }, { data: photos, error: photoError }] =
    await Promise.all([
      supabase.from('galleries').select('*').eq('id', galleryId).single(),
      supabase
        .from('photos')
        .select('*')
        .eq('gallery_id', galleryId)
        .order('sort_order', { ascending: true }),
    ]);

  if (galleryError) throw galleryError;
  if (photoError) throw photoError;

  const { data: selectionRows, error: selectionError } = await supabase
    .from('selections')
    .select('*')
    .eq('gallery_id', galleryId)
    .eq('user_id', user.id)
    .eq('selected', true)
    .order('selection_order', { ascending: true });

  if (selectionError) throw selectionError;

  return mapGallery(
    gallery,
    (photos || []).map(mapPhoto),
    (selectionRows || []).map(mapSelection)
  );
}

export async function getSupabaseGalleries(): Promise<CustomerGallery[]> {
  const { data, error } = await supabase
    .from('galleries')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data || []).map((row) => mapGallery(row));
}
