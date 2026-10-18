import { getDriveAccessToken } from './driveAuth.js';
import { attachmentHeader } from './fileName.js';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export default async function handler(req:any,res:any) {
 res.setHeader('cache-control','private, no-store, max-age=0');
 res.setHeader('x-content-type-options','nosniff');
 if(req.method!=='GET') return res.status(405).end();
 const albumId=String(req.query.albumId||''),fileId=String(req.query.fileId||'');
 const mode=String(req.query.mode||'PREVIEW').toUpperCase();
 if(!uuid.test(albumId)||!uuid.test(fileId)||!['PREVIEW','ORIGINAL','PLAY'].includes(mode))return res.status(400).end();
 const original=mode==='ORIGINAL';
 const protectedMedia=original||mode==='PLAY';
 try {
  const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY;
  if(!url||!key)throw Error('Missing configuration');
  const permission=await fetch(`${url}/rest/v1/rpc/${protectedMedia?'public_delivery_original':'public_delivery_photo'}`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'content-type':'application/json'},body:JSON.stringify({p_album_id:albumId,p_file_id:fileId})});
  if(!permission.ok)return res.status(protectedMedia?403:404).end();
  const file=await permission.json();
  if(!file?.drive_file_id)return res.status(protectedMedia?403:404).end();
  if(mode==='PLAY'&&file.file_type!=='VIDEO')return res.status(403).end();
  const auth=await getDriveAccessToken();
  const target=protectedMedia?`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.drive_file_id)}?alt=media&supportsAllDrives=true`:`https://drive.google.com/thumbnail?id=${encodeURIComponent(file.drive_file_id)}&sz=w1600`;
  const upstream=await fetch(target,{headers:{Authorization:`Bearer ${auth}`,...(protectedMedia&&req.headers?.range?{Range:String(req.headers.range)}:{})}});
  const type=upstream.headers.get('content-type')||'';
  if(!upstream.ok||(!protectedMedia&&!type.startsWith('image/'))||!upstream.body)return res.status(502).end();
  res.setHeader('content-type',type);
  res.setHeader('content-disposition',original?attachmentHeader(String(file.file_name||'ramyachobi-photo')):'inline');
  for(const name of ['content-length','content-range','accept-ranges']){const value=upstream.headers.get(name);if(value)res.setHeader(name,value);}
  res.status(upstream.status===206?206:200);
  const reader=upstream.body.getReader();
  while(true){const next=await reader.read();if(next.done)break;if(!res.write(Buffer.from(next.value)))await new Promise<void>(resolve=>res.once('drain',resolve));}
  res.end();
 } catch {if(!res.headersSent)return res.status(502).end();res.end();}
}
