import { supabase } from './supabase';
import { ensureAnonymousSupabaseAuth } from './supabaseAuth';
export type RecoveryPolicy = {
 monthly_recovery_fee?: number | null; recovery_start_days?: number; recovery_periods?: number; delivery_age_days?: number; server_now?: string; payment_accounts?: Record<string,string>; bank_details?: string;
 enabled: boolean; reopen_fee: number | null; recovery_fee: number | null;
 recovery_after: string | null; reopen_hours: number; payment_method: string;
 payment_number: string; whatsapp_number: string; expires_at?: string | null;
};
export const emptyRecoveryPolicy: RecoveryPolicy = { monthly_recovery_fee:5000,recovery_start_days:30,payment_accounts:{BKASH:'01776044951'},bank_details:'',enabled:true,reopen_fee:null,recovery_fee:null,recovery_after:null,reopen_hours:48,payment_method:'BKASH',payment_number:'01776044951',whatsapp_number:'8801776044951' };
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

export async function submitRecoveryPayment(input:{portalId:string;clientToken?:string;method:string;payerPhone:string;transactionId:string;amount:number;screenshot:File}){
 const user=await ensureAnonymousSupabaseAuth();if(!user)throw Error('সেশন তৈরি হয়নি। পেজ রিফ্রেশ করুন।');
 const form=new FormData();form.append('portal_id',input.portalId);form.append('client_token',input.clientToken||'');form.append('payment_method',input.method);form.append('payer_phone',input.payerPhone);form.append('transaction_id',input.transactionId);form.append('amount',String(input.amount));form.append('screenshot',input.screenshot);
 const {data,error}=await supabase.functions.invoke('delivery-recovery-submit',{body:form});
 if(error){const response=(error as any).context;if(response instanceof Response){const body=await response.json().catch(()=>({}));throw Error(body.error||'পেমেন্ট জমা হয়নি।');}throw error;}if(data?.error)throw Error(data.error);return data;
}
