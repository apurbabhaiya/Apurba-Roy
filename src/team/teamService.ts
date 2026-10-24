import {supabase} from '../services/supabase';
export type TeamWork={id:string;post_id:string|null;title:string;media_url:string;media_type:'photo'|'video'};
export type TeamMember={id:string;name:string;role:string;bio:string;photo_url:string;tags:string[];sort_order:number;is_visible:boolean;deleted_at:string|null;works:TeamWork[]};
export type TeamPost={id:string;title:string;is_published:boolean};
const db=supabase as any;
export async function publicTeam():Promise<TeamMember[]>{const r=await db.rpc('website_public_team');if(r.error)throw r.error;return r.data||[]}
export async function adminTeam(token:string,action:string,payload:unknown={}):Promise<{members:TeamMember[];posts:TeamPost[]}>{const r=await db.rpc('website_admin_team',{p_token:token,p_action:action,p_payload:payload});if(r.error)throw r.error;return r.data}
