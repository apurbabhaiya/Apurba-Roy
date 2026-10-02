import { supabase, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './supabase';

const db = supabase as any;
const ADMIN_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/portfolio-admin`;

export type PortfolioMedia = {
  id: string;
  post_id: string;
  image_url: string;
  storage_path: string;
  caption?: string | null;
  alt_text?: string | null;
  sort_order: number;
  is_cover: boolean;
  created_at: string;
};

export type PortfolioPost = {
  id: string;
  title: string;
  slug: string;
  story?: string | null;
  event_type: string;
  is_featured: boolean;
  is_published: boolean;
  cover_image_url?: string | null;
  cover_storage_path?: string | null;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
  portfolio_media?: PortfolioMedia[];
};

export async function getPublicPortfolioPosts(featuredOnly = false): Promise<PortfolioPost[]> {
  let query = db
    .from('portfolio_posts')
    .select('*, portfolio_media(*)')
    .eq('is_published', true)
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (featuredOnly) query = query.eq('is_featured', true);

  const { data, error } = await query;
  if (error) throw error;

  return ((data || []) as PortfolioPost[]).map((post) => ({
    ...post,
    portfolio_media: [...(post.portfolio_media || [])].sort(
      (a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)
    ),
  }));
}

async function parseAdminResponse(response: Response) {
  const text = await response.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text || 'Unexpected response' };
  }

  if (!response.ok) {
    throw new Error(data?.error || data?.message || `Request failed (${response.status})`);
  }

  return data;
}

export async function portfolioAdminRequest(
  adminToken: string,
  payload: Record<string, unknown>
) {
  const response = await fetch(ADMIN_FUNCTION_URL, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      'Content-Type': 'application/json',
      'x-admin-token': adminToken,
    },
    body: JSON.stringify(payload),
  });

  return parseAdminResponse(response);
}

export async function uploadPortfolioImages(input: {
  adminToken: string;
  postId: string;
  files: File[];
  makeCover?: boolean;
}) {
  const form = new FormData();
  form.append('action', 'upload');
  form.append('post_id', input.postId);
  form.append('make_cover', input.makeCover ? 'true' : 'false');
  input.files.forEach((file) => form.append('files', file));

  const response = await fetch(ADMIN_FUNCTION_URL, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      'x-admin-token': input.adminToken,
    },
    body: form,
  });

  return parseAdminResponse(response);
}
