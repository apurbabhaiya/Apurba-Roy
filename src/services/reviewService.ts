import { supabase } from './supabase';

// This legacy table is not present in the generated database type snapshot yet.
const reviewSupabase = supabase as any;

export type ClientReview = {
  id: string;
  client_name: string;
  review_text: string;
  rating: number;
  review_type: string;
  favorite_photo_name?: string | null;
  favorite_photo_url?: string | null;
  event_name?: string | null;
  facebook_review_url?: string | null;
  instagram_handle?: string | null;
  created_at: string;
};

export async function getApprovedClientReviews(): Promise<ClientReview[]> {
  const { data, error } = await reviewSupabase.from('client_reviews').select('*').eq('status', 'approved').order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as ClientReview[];
}

export async function submitClientReview(input: Omit<ClientReview, 'id' | 'created_at'>): Promise<void> {
  const { error } = await reviewSupabase.from('client_reviews').insert({ ...input, status: 'pending' });
  if (error) throw error;
}

export async function getPendingClientReviews(): Promise<ClientReview[]> {
  const { data, error } = await reviewSupabase.from('client_reviews').select('*').eq('status', 'pending').order('created_at', { ascending: false });
  if (error) throw error; return (data || []) as ClientReview[];
}
export async function updateClientReviewStatus(id: string, status: 'approved' | 'rejected' | 'pending'): Promise<void> {
  const { error } = await reviewSupabase.from('client_reviews').update({ status }).eq('id', id);
  if (error) throw error;
}
