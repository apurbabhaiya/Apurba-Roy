import { supabase } from './supabase';

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
  const { data, error } = await supabase.from('client_reviews').select('*').eq('status', 'approved').order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as ClientReview[];
}

export async function submitClientReview(input: Omit<ClientReview, 'id' | 'created_at'>): Promise<void> {
  const { error } = await supabase.from('client_reviews').insert({ ...input, status: 'pending' });
  if (error) throw error;
}
