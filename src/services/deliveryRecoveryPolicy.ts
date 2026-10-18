import { supabase } from './supabase';
export type RecoveryPolicy = {
 enabled: boolean; reopen_fee: number | null; recovery_fee: number | null;
 recovery_after: string | null; reopen_hours: number; payment_method: string;
 payment_number: string; whatsapp_number: string; expires_at?: string | null;
};
export const emptyRecoveryPolicy: RecoveryPolicy = { enabled:false,reopen_fee:null,recovery_fee:null,recovery_after:null,reopen_hours:48,payment_method:'BKASH',payment_number:'',whatsapp_number:'' };
export async function getRecoveryPolicy(portalId:string, clientToken?:string, adminToken?:string) {
 const {data,error}=await (supabase as any).rpc('get_delivery_recovery_policy',{p_portal_id:portalId,p_client_token:clientToken||null,p_admin_token:adminToken||null});
 if(error)throw error; return data as RecoveryPolicy|null;
}
export async function saveRecoveryPolicy(portalId:string,token:string,policy:RecoveryPolicy) {
 const {error}=await (supabase as any).rpc('delivery_admin_save_recovery_policy',{p_token:token,p_portal_id:portalId,p_policy:policy}); if(error)throw error;
}
export function recoveryPhone(value:string) {
 const digits=value.replace(/[\s()+-]/g,''); const phone=/^01[3-9]\d{8}$/.test(digits)?`88${digits}`:digits;
 return /^[1-9]\d{6,14}$/.test(phone)?phone:'';
}
export const recoveryDate=(value?:string|null)=>value?new Intl.DateTimeFormat('bn-BD',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Dhaka'}).format(new Date(value)):null;
