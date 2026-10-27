import assert from 'node:assert/strict';
import test from 'node:test';
import { Writable } from 'node:stream';
import JSZip from 'jszip';
import handler from '../../api/delivery-zip';
import { encryptDriveSecret } from '../../api/_lib/driveAuth';
class Result extends Writable {
  code=0; headers:Record<string,string>={}; chunks:Buffer[]=[]; headersSent=false;
  status(code:number){this.code=code;return this;}
  setHeader(name:string,value:string){this.headers[name]=value;return this;}
  _write(chunk:Buffer,_encoding:string,done:()=>void){this.headersSent=true;this.chunks.push(Buffer.from(chunk));done();}
}
test('ZIP streams only individually authorized originals, deduplicates IDs and forwards admin preview securely', async()=>{
  const vars=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','GOOGLE_TOKEN_ENCRYPTION_KEY','GOOGLE_OAUTH_CLIENT_ID','GOOGLE_OAUTH_CLIENT_SECRET'];
  const prior=Object.fromEntries(vars.map(k=>[k,process.env[k]]));const savedFetch=globalThis.fetch;
  process.env.SUPABASE_URL='https://test.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='test-only';process.env.GOOGLE_TOKEN_ENCRYPTION_KEY=Buffer.alloc(32,1).toString('base64');process.env.GOOGLE_OAUTH_CLIENT_ID='test';process.env.GOOGLE_OAUTH_CLIENT_SECRET='test';
  const encrypted=encryptDriveSecret('fake-refresh');
  const ids=['11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222'];
  let allow=true, rpcCalls=0,driveCalls=0;
  globalThis.fetch=async(input,init)=>{
    const url=String(input);
    if(url.includes('rpc/get_delivery_media_by_token')){rpcCalls++;const body=JSON.parse(String(init?.body));assert.equal(body.p_mode,'ORIGINAL');assert.equal(body.p_admin_token,'test-admin');return Response.json(allow?{drive_file_id:body.p_file_id,file_name:'same.mp4'}:null);}
    if(url.includes('delivery_drive_connections'))return Response.json([{encrypted_refresh_token:encrypted}]);
    if(url.includes('oauth2.googleapis.com'))return Response.json({access_token:'fake-access'});
    if(url.includes('googleapis.com/drive')){driveCalls++;return new Response('private original '+driveCalls);}
    throw Error('Unexpected request');
  };
  try{
    const result=new Result();await handler({method:'POST',headers:{'x-admin-token':'test-admin'},body:{token:'private-token-test',files:[ids[0],ids[1],ids[0]]}},result);
    assert.equal(result.code,200);assert.equal(rpcCalls,2);assert.equal(driveCalls,2);assert.match(result.headers['cache-control'],/no-store/);
    const zip=await JSZip.loadAsync(Buffer.concat(result.chunks));assert.equal(Object.keys(zip.files).length,2);for(const file of Object.values(zip.files))assert.match(await file.async('string'),/private original/);
    allow=false;driveCalls=0;const denied=new Result();await handler({method:'POST',headers:{'x-admin-token':'test-admin'},body:{token:'private-token-test',files:[ids[0]]}},denied);assert.equal(denied.code,502);assert.equal(driveCalls,0);
    const invalid=new Result();await handler({method:'POST',headers:{},body:{token:'private-token-test',files:['bad']}},invalid);assert.equal(invalid.code,400);
  }finally{globalThis.fetch=savedFetch;for(const key of vars){if(prior[key]===undefined)delete process.env[key];else process.env[key]=prior[key];}}
});
