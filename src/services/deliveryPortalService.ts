import { supabase } from './supabase';

const db = supabase as any;

export type DeliveryPreviewItem = {
  type: 'image' | 'video';
  url: string;
  title?: string;
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
