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
  google_drive_link?: string | null;
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
  nagad_number?: string | null;
  dbbl_number?: string | null;
  hero_image_url?: string | null;
  preview_items?: DeliveryPreviewItem[];
  delivery_files?: DeliveryFinalFile[];
  client_phone?: string | null;
  whatsapp_number?: string | null;
  total_paid?: number | string;
  free_access_days?: number;
  grace_period_days?: number;
  daily_late_fee?: number | string;
  late_days?: number;
  calculated_late_fee?: number | string;
  late_fee_paid?: number | string;
  late_fee_balance?: number | string;
  total_payable?: number | string;
  late_fee_status?: string | null;
  client_message?: string | null;
  client_note?: string | null;
  google_drive_access_enabled?: boolean;
  preview_enabled?: boolean;
  photo_download_permission?: boolean;
  video_download_permission?: boolean;
  drive_link_access_enabled?: boolean;
};

export type DeliveryAdminPortal = DeliveryPortalData & {
  booking_id?: string | null;
  gallery_id?: string | null;
  secure_token: string;
  client_phone?: string | null;
  whatsapp_number?: string | null;
  free_access_days?: number;
  grace_period_days?: number;
  daily_late_fee?: number | string;
  late_fee_enabled?: boolean;
  late_fee_waived?: boolean;
  late_fee_override?: number | string | null;
  late_fee_paid?: number | string;
  client_message?: string | null;
  client_note?: string | null;
  internal_admin_note?: string | null;
  total_paid?: number | string;
  late_fee?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
  delivery_files?: DeliveryAdminFile[];
  preview_enabled?: boolean;
  photo_download_permission?: boolean;
  video_download_permission?: boolean;
  drive_link_access_enabled?: boolean;
};

export type DeliveryPaymentSubmission = {
  id: string;
  portal_id: string;
  payment_type: 'PACKAGE' | 'ACCESS';
  payment_method: 'BKASH' | 'NAGAD' | 'DBBL';
  proof_storage_path?: string | null;
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

export type DeliveryPaymentLedger = {
  id: string;
  portal_id: string;
  payment_date: string;
  payment_method: 'CASH' | 'BKASH' | 'NAGAD' | 'BANK' | 'OTHER';
  amount: number | string;
  transaction_id?: string | null;
  note?: string | null;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  verified_at?: string | null;
  verified_by?: string | null;
  created_at?: string | null;
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
  payment_ledger: Record<string, DeliveryPaymentLedger[]>;
};

export async function getDeliveryPortal(token: string): Promise<DeliveryPortalData | null> {
  const { data, error } = await db.rpc('get_delivery_portal_by_token', { p_token: token });
  if (error) throw error;
  if (!data) return null;
  const { data: methods, error: methodsError } = await db.rpc('get_delivery_payment_methods', { p_token: token });
  if (methodsError) throw methodsError;
  return { ...data, ...(methods || {}) } as DeliveryPortalData;
}

export async function submitDeliveryPayment(input: {
  token: string;
  paymentType: 'PACKAGE' | 'ACCESS';
  paymentMethod: 'BKASH' | 'NAGAD' | 'DBBL';
  payerPhone: string;
  transactionId: string;
  amount: number;
  selectedDays?: number | null;
  screenshot: File;
}) {
  const form = new FormData();
  form.append('token', input.token);
  form.append('payment_type', input.paymentType);
  form.append('payment_method', input.paymentMethod);
  form.append('payer_phone', input.payerPhone);
  form.append('transaction_id', input.transactionId);
  form.append('amount', String(input.amount));
  form.append('selected_days', input.selectedDays == null ? '' : String(input.selectedDays));
  form.append('screenshot', input.screenshot);
  const { data, error } = await supabase.functions.invoke('delivery-payment-submit', { body: form });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
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
  const submissions = await listDeliveryPaymentSubmissions(token);
  return {
    portals: data?.portals || [],
    submissions: submissions || [],
    bookings: data?.bookings || [],
    audit_logs: data?.audit_logs || [],
    payment_ledger: data?.payment_ledger || {},
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

export async function updateDeliveryPaymentMethods(input: {
  token: string;
  portalId: string;
  bkashNumber: string;
  nagadNumber: string;
  dbblNumber: string;
}) {
  const { data, error } = await db.rpc('delivery_admin_update_payment_methods', {
    p_token: input.token,
    p_portal_id: input.portalId,
    p_bkash_number: input.bkashNumber,
    p_nagad_number: input.nagadNumber,
    p_dbbl_number: input.dbblNumber,
  });
  if (error) throw error;
  return data;
}

export async function setDeliveryAdvancePaid(input: { token: string; portalId: string; advancePaid: number }) {
  const { data, error } = await db.rpc('delivery_admin_set_advance_paid', {
    p_token: input.token,
    p_portal_id: input.portalId,
    p_advance_paid: input.advancePaid,
  });
  if (error) throw error;
  return data;
}

export async function listDeliveryPaymentSubmissions(token: string): Promise<DeliveryPaymentSubmission[]> {
  const { data, error } = await db.rpc('delivery_admin_list_payment_submissions', { p_token: token });
  if (error) throw error;
  return (data || []) as DeliveryPaymentSubmission[];
}

export async function getDeliveryPaymentProofUrl(token: string, submissionId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('delivery-payment-proof', {
    body: { submissionId },
    headers: { 'x-admin-token': token },
  });
  if (error) throw error;
  if (data?.error || !data?.url) throw new Error(data?.error || 'Could not open payment screenshot.');
  return String(data.url);
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
  let pageToken = '';
  let imported = 0;
  let skipped = 0;
  let folderName = '';

  for (let page = 0; page < 1000; page += 1) {
    const response = await fetch('/api/delivery-folder-sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...input, pageToken: pageToken || null }),
    });
    const rawResponse = await response.text();
    let data: any = {};
    try { data = rawResponse ? JSON.parse(rawResponse) : {}; }
    catch { data = { error: rawResponse.slice(0, 400) }; }
    if (!response.ok) throw new Error(data?.error || `Folder import failed (HTTP ${response.status}).`);

    imported += Number(data.imported || 0);
    skipped += Number(data.skipped || 0);
    folderName ||= String(data.folderName || '');
    pageToken = String(data.nextPageToken || '');
    if (!pageToken) return { success: true, imported, skipped, folderName };
  }

  throw new Error('Folder contains too many pages to import safely. Split the folder into smaller folders and retry.');
}



export async function setDeliveryPermissions(input: {
  token: string;
  portalId: string;
  previewEnabled: boolean;
  photoDownloadPermission: boolean;
  videoDownloadPermission: boolean;
  driveLinkAccessEnabled: boolean;
}) {
  const { data, error } = await db.rpc('delivery_admin_set_permissions', {
    p_token: input.token,
    p_portal_id: input.portalId,
    p_preview_enabled: input.previewEnabled,
    p_photo_download_permission: input.photoDownloadPermission,
    p_video_download_permission: input.videoDownloadPermission,
    p_drive_link_access_enabled: input.driveLinkAccessEnabled,
  });
  if (error) throw error;
  return data;
}

export async function updateDeliveryPortal(input: {
  token: string;
  portalId: string;
  clientName?: string | null;
  clientPhone?: string | null;
  whatsappNumber?: string | null;
  eventName?: string | null;
  packagePrice?: number | null;
  finalDeliveryAt?: string | null;
  accessExpiryAt?: string | null;
  freeAccessDays?: number | null;
  gracePeriodDays?: number | null;
  dailyLateFee?: number | null;
  lateFeeEnabled?: boolean | null;
  lateFeeWaived?: boolean | null;
  lateFeeOverride?: number | null;
  clientMessage?: string | null;
  clientNote?: string | null;
  internalAdminNote?: string | null;
}) {
  const { data, error } = await db.rpc('delivery_admin_update_portal', {
    p_token: input.token,
    p_portal_id: input.portalId,
    p_client_name: input.clientName ?? null,
    p_client_phone: input.clientPhone ?? null,
    p_whatsapp_number: input.whatsappNumber ?? null,
    p_event_name: input.eventName ?? null,
    p_package_price: input.packagePrice ?? null,
    p_final_delivery_at: input.finalDeliveryAt ?? null,
    p_access_expiry_at: input.accessExpiryAt ?? null,
    p_free_access_days: input.freeAccessDays ?? null,
    p_grace_period_days: input.gracePeriodDays ?? null,
    p_daily_late_fee: input.dailyLateFee ?? null,
    p_late_fee_enabled: input.lateFeeEnabled ?? null,
    p_late_fee_waived: input.lateFeeWaived ?? null,
    p_late_fee_override: input.lateFeeOverride ?? null,
    p_client_message: input.clientMessage ?? null,
    p_client_note: input.clientNote ?? null,
    p_internal_admin_note: input.internalAdminNote ?? null,
  });
  if (error) throw error;
  return data;
}

export async function listDeliveryPayments(input: { token: string; portalId: string }): Promise<DeliveryPaymentLedger[]> {
  const { data, error } = await db.rpc('delivery_admin_list_payments', {
    p_token: input.token,
    p_portal_id: input.portalId,
  });
  if (error) throw error;
  return (data || []) as DeliveryPaymentLedger[];
}

export async function addDeliveryPayment(input: {
  token: string;
  portalId: string;
  paymentDate?: string | null;
  paymentMethod: DeliveryPaymentLedger['payment_method'];
  amount: number;
  transactionId?: string | null;
  note?: string | null;
  status?: DeliveryPaymentLedger['status'];
}) {
  const { data, error } = await db.rpc('delivery_admin_add_payment', {
    p_token: input.token,
    p_portal_id: input.portalId,
    p_payment_date: input.paymentDate || new Date().toISOString(),
    p_payment_method: input.paymentMethod,
    p_amount: input.amount,
    p_transaction_id: input.transactionId || null,
    p_note: input.note || null,
    p_status: input.status || 'PENDING',
  });
  if (error) throw error;
  return data as DeliveryPaymentLedger;
}

export async function updateDeliveryPayment(input: {
  token: string;
  paymentId: string;
  paymentDate?: string | null;
  paymentMethod?: DeliveryPaymentLedger['payment_method'];
  amount?: number;
  transactionId?: string | null;
  note?: string | null;
  status?: DeliveryPaymentLedger['status'];
}) {
  const { data, error } = await db.rpc('delivery_admin_update_payment', {
    p_token: input.token,
    p_payment_id: input.paymentId,
    p_payment_date: input.paymentDate ?? null,
    p_payment_method: input.paymentMethod ?? null,
    p_amount: input.amount ?? null,
    p_transaction_id: input.transactionId ?? null,
    p_note: input.note ?? null,
    p_status: input.status ?? null,
  });
  if (error) throw error;
  return data as DeliveryPaymentLedger;
}

export async function deleteDeliveryPayment(input: { token: string; paymentId: string }) {
  const { data, error } = await db.rpc('delivery_admin_delete_payment', {
    p_token: input.token,
    p_payment_id: input.paymentId,
  });
  if (error) throw error;
  return data;
}

export async function restoreDeliveryAccess(input: { token: string; portalId: string; restoreDays?: number; waiveFee?: boolean }) {
  const { data, error } = await db.rpc('delivery_admin_restore_access', {
    p_token: input.token,
    p_portal_id: input.portalId,
    p_restore_days: input.restoreDays ?? 30,
    p_waive_fee: input.waiveFee ?? false,
  });
  if (error) throw error;
  return data;
}


export async function validateAndSaveDeliveryFile(input: {
  adminToken: string;
  portalId: string;
  sourceUrl: string;
  fileType: 'PHOTO' | 'VIDEO' | 'FOLDER';
  fileId?: string | null;
  fileName?: string | null;
  title?: string | null;
  sortOrder?: number;
  isVisible?: boolean;
  persist?: boolean;
}) {
  const response = await fetch('/api/delivery-validate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      adminToken: input.adminToken,
      portalId: input.portalId,
      sourceUrl: input.sourceUrl,
      fileType: input.fileType,
      fileId: input.fileId || null,
      fileName: input.fileName || null,
      title: input.title || null,
      sortOrder: input.sortOrder || 0,
      isVisible: input.isVisible ?? true,
      persist: input.persist !== false,
    }),
  });
  const rawResponse = await response.text();
  let data: any = {};
  try {
    data = rawResponse ? JSON.parse(rawResponse) : {};
  } catch {
    data = { error: rawResponse.slice(0, 400) };
  }
  if (!response.ok) {
    throw new Error(data?.error || `Google Drive link validation failed (HTTP ${response.status}).`);
  }
  return data as {
    verified: boolean;
    saved?: boolean;
    fileType: 'PHOTO' | 'VIDEO' | 'FOLDER';
    driveId: string;
    metadata: { id: string; name: string; mimeType: string; size?: string | null; modifiedTime?: string | null };
    file?: DeliveryAdminFile | null;
  };
}
