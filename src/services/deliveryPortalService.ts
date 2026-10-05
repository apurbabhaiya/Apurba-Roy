import { supabase } from './supabase';

const db = supabase as any;

export type DeliveryPreviewItem = {
  type: 'image' | 'video';
  url: string;
  title?: string;
};

export type DeliveryFinalFile = {
  id: string;
  file_name?: string | null;
  file_type: 'PHOTO' | 'VIDEO' | 'FOLDER';
  mime_type?: string | null;
  title?: string | null;
  sort_order?: number;
};

export type DeliveryAdminFile = DeliveryFinalFile & {
  portal_id: string;
  source_url: string;
  drive_file_id?: string | null;
  drive_folder_id?: string | null;
  is_visible: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

export type DeliveryPortalData = {
  id: string;
  client_name: string;
  event_name?: string | null;
  event_date?: string | null;
  package_name?: string | null;
  package_price: number | string;
  advance_paid: number | string;
  verified_total_paid: number | string;
  remaining_due: number | string;
  payment_status: string;
  delivery_status: string;
  gallery_status: string;
  download_status: string;
  final_delivery_at?: string | null;
  free_access_expires_at?: string | null;
  access_expires_at?: string | null;
  storage_retention_until?: string | null;
  access_fee_per_day: number | string;
  bkash_number?: string | null;
  hero_image_url?: string | null;
  preview_items?: DeliveryPreviewItem[];
  delivery_files?: DeliveryFinalFile[];
};

export type DeliveryAdminPortal = DeliveryPortalData & {
  booking_id?: string | null;
  gallery_id?: string | null;
  secure_token: string;
  client_phone?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  delivery_files?: DeliveryAdminFile[];
};

export type DeliveryPaymentSubmission = {
  id: string;
  portal_id: string;
  payment_type: 'PACKAGE' | 'ACCESS';
  payer_phone: string;
  transaction_id: string;
  amount: number | string;
  selected_days?: number | null;
  status: 'SUBMITTED' | 'VERIFIED' | 'REJECTED';
  submitted_at: string;
  verified_at?: string | null;
  booking_payment_id?: string | null;
  client_name?: string | null;
  event_name?: string | null;
};

export type DeliveryBookingSummary = {
  id: string;
  reference_no: string;
  client_name: string;
  phone: string;
  package_name?: string | null;
  package_total: number | string;
  advance_paid: number | string;
  additional_paid: number | string;
  has_portal: boolean;
  event_name?: string | null;
  event_date?: string | null;
};

export type DeliveryAuditLog = {
  id: string;
  portal_id?: string | null;
  submission_id?: string | null;
  action: string;
  details?: Record<string, unknown> | null;
  created_at: string;
};

export type DeliveryAdminDashboard = {
  portals: DeliveryAdminPortal[];
  submissions: DeliveryPaymentSubmission[];
  bookings: DeliveryBookingSummary[];
  audit_logs: DeliveryAuditLog[];
};

export async function getDeliveryPortal(token: string): Promise<DeliveryPortalData | null> {
  const { data, error } = await db.rpc('get_delivery_portal_by_token', { p_token: token });
  if (error) throw error;
  return (data || null) as DeliveryPortalData | null;
}

export async function submitDeliveryPayment(input: {
  token: string;
  paymentType: 'PACKAGE' | 'ACCESS';
  payerPhone: string;
  transactionId: string;
  amount: number;
  selectedDays?: number | null;
}) {
  const { data, error } = await db.rpc('submit_delivery_payment', {
    p_token: input.token,
    p_payment_type: input.paymentType,
    p_payer_phone: input.payerPhone,
    p_transaction_id: input.transactionId,
    p_amount: input.amount,
    p_selected_days: input.selectedDays ?? null,
  });
  if (error) throw error;
  return data;
}

export async function deliveryAdminLogin(accessCode: string) {
  const { data, error } = await db.rpc('booking_admin_login', { p_code: accessCode });
  if (error) throw error;
  return data as { token: string; expires_at: string };
}

export async function deliveryAdminLogout(token: string) {
  const { error } = await db.rpc('booking_admin_logout', { p_token: token });
  if (error) throw error;
}

export async function getDeliveryAdminDashboard(token: string): Promise<DeliveryAdminDashboard> {
  const { data, error } = await db.rpc('delivery_admin_dashboard', { p_token: token });
  if (error) throw error;
  return {
    portals: data?.portals || [],
    submissions: data?.submissions || [],
    bookings: data?.bookings || [],
    audit_logs: data?.audit_logs || [],
  } as DeliveryAdminDashboard;
}

export async function createDeliveryPortalFromBooking(input: {
  token: string;
  bookingId: string;
  bkashNumber?: string | null;
  storageRetentionUntil?: string | null;
}) {
  const { data, error } = await db.rpc('delivery_admin_create_from_booking', {
    p_token: input.token,
    p_booking_id: input.bookingId,
    p_bkash_number: input.bkashNumber || null,
    p_storage_retention_until: input.storageRetentionUntil || null,
  });
  if (error) throw error;
  return data as { id: string; secure_token: string; client_name: string };
}

export async function reviewDeliveryPayment(input: {
  token: string;
  submissionId: string;
  decision: 'VERIFY' | 'REJECT';
}) {
  const { data, error } = await db.rpc('delivery_admin_review_payment', {
    p_token: input.token,
    p_submission_id: input.submissionId,
    p_decision: input.decision,
  });
  if (error) throw error;
  return data;
}

export async function activateFinalDelivery(input: { token: string; portalId: string }) {
  const { data, error } = await db.rpc('delivery_admin_activate_final_delivery', {
    p_token: input.token,
    p_portal_id: input.portalId,
  });
  if (error) throw error;
  return data;
}

export async function updateDeliverySettings(input: {
  token: string;
  portalId: string;
  bkashNumber?: string | null;
  storageRetentionUntil?: string | null;
}) {
  const { data, error } = await db.rpc('delivery_admin_update_settings', {
    p_token: input.token,
    p_portal_id: input.portalId,
    p_bkash_number: input.bkashNumber || null,
    p_storage_retention_until: input.storageRetentionUntil || null,
  });
  if (error) throw error;
  return data;
}


export async function listDeliveryFiles(input: { token: string; portalId: string }): Promise<DeliveryAdminFile[]> {
  const { data, error } = await db.rpc('delivery_admin_list_files', {
    p_token: input.token,
    p_portal_id: input.portalId,
  });
  if (error) throw error;
  return (data || []) as DeliveryAdminFile[];
}

export async function upsertDeliveryFile(input: {
  token: string;
  portalId: string;
  fileId?: string | null;
  sourceUrl: string;
  fileType: 'PHOTO' | 'VIDEO' | 'FOLDER';
  title?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  sortOrder?: number;
  isVisible?: boolean;
}) {
  const { data, error } = await db.rpc('delivery_admin_upsert_file', {
    p_token: input.token,
    p_portal_id: input.portalId,
    p_file_id: input.fileId || null,
    p_source_url: input.sourceUrl,
    p_file_type: input.fileType,
    p_title: input.title || null,
    p_file_name: input.fileName || null,
    p_mime_type: input.mimeType || null,
    p_sort_order: input.sortOrder || 0,
    p_is_visible: input.isVisible ?? true,
  });
  if (error) throw error;
  return data as DeliveryAdminFile;
}

export async function deleteDeliveryFile(input: { token: string; fileId: string }) {
  const { data, error } = await db.rpc('delivery_admin_delete_file', {
    p_token: input.token,
    p_file_id: input.fileId,
  });
  if (error) throw error;
  return data;
}


export async function syncDeliveryFolder(input: { adminToken: string; portalId: string; folderUrl: string }) {
  const response = await fetch('/api/delivery-folder-sync', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || 'Folder import failed.');
  return data as { success: boolean; imported: number };
}
