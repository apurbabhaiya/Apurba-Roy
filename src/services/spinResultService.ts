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
  'POINTS 500',
  'POINTS 1000',
  'POINTS 2000',
  'POINTS 3000',
  '5% OFF',
  '1 FREE EDIT',
  '1 FREE PRINT',
  'TRY AGAIN',
] as const;

export type SpinGameConfig = {
  smartphoneGoal: number;
  smartphoneLabel: string;
  pointRewards: number[];
  bookingPoints: number;
  adsterraUrl: string;
};

export type SpinWalletSnapshot = {
  phone: string;
  pointsBalance: number;
  updatedAt: string | null;
  ledger: Array<{ points_delta: number; balance_after: number; source_type: string; note: string; created_at: string }>;
};

export type SmartphoneClaim = {
  id: string;
  customer_name: string;
  phone_normalized: string;
  address: string;
  status: 'pending' | 'verified' | 'redeemed' | 'rejected';
  admin_note: string;
  created_at: string;
  updated_at: string;
};

export const defaultSpinGameConfig: SpinGameConfig = {
  smartphoneGoal: 10000000,
  smartphoneLabel: 'স্মার্টফোন',
  pointRewards: [500, 1000, 2000, 3000],
  bookingPoints: 0,
  adsterraUrl: 'https://www.profitableratecpmnetwork.com/sejiqs7gh?key=3ced38f7fd6c41fd721c0ffa30fe4cf7',
};

export const getSpinGamePublicConfig = async (): Promise<SpinGameConfig> => {
  const { data, error } = await db.rpc('spin_game_public_config');
  if (error) throw error;
  return { ...defaultSpinGameConfig, ...(data || {}) } as SpinGameConfig;
};

export const getSpinGameAdminConfig = async (adminToken: string): Promise<SpinGameConfig> => {
  const { data, error } = await db.rpc('spin_game_admin_config', { p_token: adminToken });
  if (error) throw error;
  return { ...defaultSpinGameConfig, ...(data || {}) } as SpinGameConfig;
};

export const saveSpinGameAdminConfig = async (adminToken: string, config: SpinGameConfig): Promise<SpinGameConfig> => {
  const { data, error } = await db.rpc('spin_game_admin_update', {
    p_token: adminToken,
    p_smartphone_goal: config.smartphoneGoal,
    p_smartphone_label: config.smartphoneLabel,
    p_point_rewards: config.pointRewards,
    p_booking_points: config.bookingPoints,
    p_adsterra_url: config.adsterraUrl,
  });
  if (error) throw error;
  return { ...defaultSpinGameConfig, ...(data || {}) } as SpinGameConfig;
};

export const getSpinWalletAdmin = async (adminToken: string, phone: string): Promise<SpinWalletSnapshot> => {
  const { data, error } = await db.rpc('spin_points_admin_wallet', { p_token: adminToken, p_phone: phone });
  if (error) throw error;
  return data as SpinWalletSnapshot;
};

export const getSmartphoneClaimsAdmin = async (adminToken: string): Promise<SmartphoneClaim[]> => {
  const { data, error } = await db.rpc('spin_points_admin_claims', { p_token: adminToken });
  if (error) throw error;
  return (data || []) as SmartphoneClaim[];
};

export const updateSmartphoneClaimAdmin = async (
  adminToken: string, id: string, status: SmartphoneClaim['status'], adminNote: string
) => {
  const { error } = await db.rpc('spin_points_admin_update_claim', {
    p_token: adminToken, p_id: id, p_status: status, p_admin_note: adminNote,
  });
  if (error) throw error;
};

export const claimSmartphone = async (input: { customerName: string; phone: string; address: string }) => {
  const { data, error } = await db.rpc('spin_points_claim_smartphone', {
    p_customer_name: input.customerName, p_phone: input.phone, p_address: input.address,
  });
  if (error) throw error;
  return data as { id: string; status: 'pending' };
};

export async function createSpinDraw(phone: string): Promise<{ id: string; prize: string; pointsAwarded: number; pointsBalance: number }> {
  const { data, error } = await db.rpc('spin_result_draw_start', { p_phone: phone });
  if (error) throw error;
  return data as { id: string; prize: string };
}

export async function submitSpinResult(input: {
  customerName: string;
  phone: string;
  address: string;
  spinDrawId: string;
  campaignLink?: string;
}) {
  const { data, error } = await db.rpc('submit_spin_result', {
    p_customer_name: input.customerName,
    p_phone: input.phone,
    p_address: input.address,
    p_spin_draw_id: input.spinDrawId,
    p_campaign_link: input.campaignLink || '',
  });
  if (error) throw error;
  return data as { id: string; status: 'pending'; spin_result: string };
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
