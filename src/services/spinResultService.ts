import { supabase } from './supabase';

const db = supabase as any;

export type SpinSubmission = {
  id: string;
  customer_name: string;
  phone: string;
  address: string;
  spin_result: string;
  campaign_link: string;
  status: 'pending' | 'verified' | 'redeemed' | 'rejected';
  admin_note: string;
  created_at: string;
  updated_at: string;
};

export const spinPrizes = [
  '15 MIN FREE PHOTOSHOOT',
  'GIFT 1',
  '20% OFF',
  'GIFT 2',
  '10% OFF',
  '5% OFF',
  'GIFT 3',
  '25% OFF',
  '2% OFF',
  '8% OFF',
  'CHOCOLATE',
] as const;

export async function submitSpinResult(input: {
  customerName: string;
  phone: string;
  address: string;
  spinResult: string;
  campaignLink?: string;
}) {
  const { data, error } = await db.rpc('submit_spin_result', {
    p_customer_name: input.customerName,
    p_phone: input.phone,
    p_address: input.address,
    p_spin_result: input.spinResult,
    p_campaign_link: input.campaignLink || '',
  });
  if (error) throw error;
  return data as { id: string; status: 'pending' };
}

export async function getSpinResultAdminSnapshot(adminToken: string): Promise<SpinSubmission[]> {
  const { data, error } = await db.rpc('spin_result_admin_snapshot', { p_token: adminToken });
  if (error) throw error;
  return (data || []) as SpinSubmission[];
}

export async function updateSpinResultAdmin(
  adminToken: string,
  id: string,
  status: SpinSubmission['status'],
  adminNote: string
) {
  const { error } = await db.rpc('spin_result_admin_update', {
    p_token: adminToken,
    p_id: id,
    p_status: status,
    p_admin_note: adminNote,
  });
  if (error) throw error;
}
