import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
function key(){const legacy=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(legacy)return legacy;try{const keys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}');return keys.default||keys.service_role||keys.serviceRole||Object.values(keys)[0]||'';}catch{return '';}}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 const url=Deno.env.get('SUPABASE_URL')||'',secret=key();if(!url||!secret)return reply({error:'Server configuration incomplete'},503);
 const admin=createClient(url,String(secret),{auth:{persistSession:false,autoRefreshToken:false}});let uploaded='';
 try{
  const form=await req.formData();const id=String(form.get('portal_id')||''),token=String(form.get('client_token')||''),method=String(form.get('payment_method')||'').toUpperCase(),payer=String(form.get('payer_phone')||'').trim(),tx=String(form.get('transaction_id')||'').trim(),amount=Number(form.get('amount')),file=form.get('screenshot');
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)||token.length>128)return reply({error:'Invalid delivery'},400);
  if(!['BKASH','NAGAD','ROCKET','DBBL'].includes(method)||!/^\+?[0-9]{7,15}$/.test(payer)||tx.length<3||tx.length>100||!Number.isFinite(amount)||amount<=0)return reply({error:'সঠিক পেমেন্ট মাধ্যম, নম্বর, Transaction ID ও টাকার পরিমাণ দিন।'},400);
  if(!(file instanceof File)||file.size<1||file.size>5*1024*1024)return reply({error:'৫ MB-এর মধ্যে পেমেন্ট স্ক্রিনশট দিন।'},400);
  const types:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};const ext=types[file.type];if(!ext)return reply({error:'JPEG, PNG অথবা WebP ছবি দিন।'},400);
  const bytes=new Uint8Array(await file.slice(0,12).arrayBuffer());const valid=ext==='jpg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:ext==='png'?[137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n):String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';if(!valid)return reply({error:'স্ক্রিনশট ফাইলটি সঠিক ছবি নয়।'},400);
  const {data:policy,error:policyError}=await admin.rpc('get_delivery_recovery_policy',{p_portal_id:id,p_client_token:token||null,p_admin_token:null});
  if(policyError||!policy)return reply({error:'This delivery is unavailable'},404);
  if(!policy.recovery_after||Date.parse(policy.recovery_after)>Date.now()||Number(policy.recovery_fee)!==amount)return reply({error:'চার্জ বা সময় বদলেছে। পেজ রিফ্রেশ করে পরিমাণ নিশ্চিত করুন।'},400);
  uploaded=`${id}/${crypto.randomUUID()}.${ext}`;const {error:uploadError}=await admin.storage.from('delivery-payment-proofs').upload(uploaded,file,{contentType:file.type,cacheControl:'3600',upsert:false});if(uploadError)throw new Error('স্ক্রিনশট আপলোড হয়নি। আবার চেষ্টা করুন।');
  const {data,error}=await admin.rpc('submit_delivery_recovery_payment',{p_portal_id:id,p_client_token:token||null,p_method:method,p_payer_phone:payer,p_transaction_id:tx,p_amount:amount,p_proof_path:uploaded});
  if(error)throw new Error(error.message);return reply(data||{success:true});
 }catch(error){if(uploaded)await admin.storage.from('delivery-payment-proofs').remove([uploaded]);return reply({error:error instanceof Error?error.message:'পেমেন্ট জমা হয়নি।'},400);}
});
