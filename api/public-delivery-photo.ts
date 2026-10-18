import { getDriveAccessToken } from './_lib/driveAuth.js';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export default async function handler(req:any,res:any) {
 res.setHeader('cache-control','private, no-store, max-age=0');
 res.setHeader('x-content-type-options','nosniff');
 if(req.method!=='GET') return res.status(405).end();
 const albumId=String(req.query.albumId||''),fileId=String(req.query.fileId||'');
 if(!uuid.test(albumId)||!uuid.test(fileId))return res.status(400).end();
 try {
  const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY;
  if(!url||!key)throw Error('Missing configuration');
  const permission=await fetch(`${url}/rest/v1/rpc/public_delivery_photo`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'content-type':'application/json'},body:JSON.stringify({p_album_id:albumId,p_file_id:fileId})});
  if(!permission.ok)return res.status(404).end();
  const file=await permission.json();
  if(!file?.drive_file_id)return res.status(404).end();
  const auth=await getDriveAccessToken();
  const upstream=await fetch(`https://drive.google.com/thumbnail?id=${encodeURIComponent(file.drive_file_id)}&sz=w1600`,{headers:{Authorization:`Bearer ${auth}`}});
  const type=upstream.headers.get('content-type')||'';
  if(!upstream.ok||!type.startsWith('image/'))return res.status(502).end();
  res.setHeader('content-type',type);res.setHeader('content-disposition','inline');
  res.status(200).end(Buffer.from(await upstream.arrayBuffer()));
 } catch {return res.status(502).end();}
}
