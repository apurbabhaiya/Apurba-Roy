import { supabase } from './supabase';

const db = supabase as any;

export type WebsiteTeamMember = {
  id: string;
  name: string;
  role: string;
  phone: string;
  bio: string;
  photo_url: string;
  tags: string[];
  sort_order: number;
  is_visible: boolean;
  deleted_at?: string | null;
};

export type WebsiteTeamWork = {
  id: string;
  member_id: string;
  post_id: string | null;
  title: string;
  media_url: string;
  media_type: 'photo' | 'video';
};

export type WebsiteTeamPortfolioPost = {
  id: string;
  title: string;
  event_type: string;
  cover_image_url: string | null;
  is_published: boolean;
};

export async function getPublicTeamMembers(): Promise<WebsiteTeamMember[]> {
  const { data, error } = await db
    .from('website_team_members')
    .select('id,name,role,phone,bio,photo_url,tags,sort_order,is_visible')
    .eq('is_visible', true)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw error;
  return (data || []) as WebsiteTeamMember[];
}

export async function getPublicTeamWork(): Promise<WebsiteTeamWork[]> {
  const { data, error } = await db
    .from('website_team_work')
    .select('id,member_id,post_id,title,media_url,media_type');
  if (error) throw error;
  return (data || []) as WebsiteTeamWork[];
}

export async function getWebsiteTeamAdminSnapshot(adminToken: string) {
  const { data, error } = await db.rpc('website_team_admin_snapshot', {
    p_token: adminToken,
  });
  if (error) throw error;
  return data as {
    members: WebsiteTeamMember[];
    work: WebsiteTeamWork[];
    posts: WebsiteTeamPortfolioPost[];
  };
}

export async function saveWebsiteTeamMember(adminToken: string, member: Partial<WebsiteTeamMember>) {
  const { data, error } = await db.rpc('website_team_admin_save', {
    p_token: adminToken,
    p_member: member,
  });
  if (error) throw error;
  return data as WebsiteTeamMember;
}

export async function setWebsiteTeamWorkPosts(
  adminToken: string,
  memberId: string,
  postIds: string[]
) {
  const { data, error } = await db.rpc('website_team_admin_set_work', {
    p_token: adminToken,
    p_member_id: memberId,
    p_post_ids: postIds,
  });
  if (error) throw error;
  return Number(data || 0);
}
