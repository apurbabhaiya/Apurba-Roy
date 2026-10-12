import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { getDriveAccessToken, supabaseServiceRequest } from './_lib/driveAuth.js';

export const config = { api: { bodyParser: false } };

type VercelRequest = any;
type VercelResponse = any;

function json(res: VercelResponse, status: number, body: unknown) {
  return res.status(status).setHeader('content-type', 'application/json; charset=utf-8').setHeader('cache-control', 'no-store').end(JSON.stringify(body));
}

function supabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
  if (!url || !key) throw new Error('Protected delivery server configuration is missing.');
  return { url: url.replace(/\/$/, ''), key };
}

async function rpc(name: string, body: Record<string, unknown>) {
  const { url, key } = supabaseConfig();
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error((await response.text()).slice(0, 400) || `Supabase RPC ${name} failed.`);
  return response.json();
}

function readRawBody(req: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer | string) => {
      const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += value.length;
      if (size > 1_000_000) { reject(new Error('Request body is too large.')); req.destroy(); return; }
      chunks.push(value);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function graphVersion() {
  return process.env.META_GRAPH_VERSION || 'v26.0';
}

function metaConfig() {
  const appId = process.env.META_APP_ID || '';
  const appSecret = process.env.META_APP_SECRET || '';
  const redirectUri = process.env.META_REDIRECT_URI || '';
  if (!appId || !appSecret || !redirectUri) throw new Error('Meta App ID, App Secret, and OAuth redirect URI must be configured in Vercel.');
  return { appId, appSecret, redirectUri };
}

function encryptionKey() {
  const value = process.env.META_TOKEN_ENCRYPTION_KEY || '';
  const key = /^[a-f0-9]{64}$/i.test(value) ? Buffer.from(value, 'hex') : Buffer.from(value, 'base64');
  if (key.length !== 32) throw new Error('META_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes.');
  return key;
}

function encryptPageToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64url')).join('.');
}

function decryptPageToken(value: string) {
  const [iv, tag, encrypted] = value.split('.').map((part) => Buffer.from(part, 'base64url'));
  if (!iv || !tag || !encrypted) throw new Error('Stored Facebook Page token is invalid.');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

async function metaFetch(path: string, init?: RequestInit) {
  const response = await fetch(`https://graph.facebook.com/${graphVersion()}/${path}`, init);
  const data: any = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) throw new Error(data?.error?.message || `Meta Graph API request failed (HTTP ${response.status}).`);
  return data;
}

async function verifyAdminToken(token: string) {
  if (!token) throw new Error('Admin session is required.');
  await rpc('delivery_admin_dashboard', { p_token: token });
}

function safeEqualText(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function startMetaOAuth(req: any, body: any, res: VercelResponse) {
  await verifyAdminToken(String(body.adminToken || '').trim());
  const { appId, redirectUri } = metaConfig();
  const state = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const saved = await supabaseServiceRequest('messenger_settings?on_conflict=id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ id: 1, oauth_state_hash: createHash('sha256').update(state).digest('hex'), oauth_state_expires_at: expiresAt, updated_at: new Date().toISOString() }),
  });
  if (!saved.ok) throw new Error('Could not start Facebook connection. Apply the AI Inbox connection migration first.');
  const url = new URL(`https://www.facebook.com/${graphVersion()}/dialog/oauth`);
  url.searchParams.set('client_id', appId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'pages_show_list,pages_messaging,pages_manage_metadata');
  return json(res, 200, { url: url.toString() });
}

async function handleMetaOAuthCallback(req: any, res: VercelResponse) {
  const query = req.query || {};
  const code = String(query.code || '');
  const state = String(query.state || '');
  if (query.error) return json(res, 400, { error: 'Facebook permission was not granted. Return to AI Inbox and try again.' });
  if (!code || !state) return json(res, 400, { error: 'Facebook callback is missing code or state.' });
  const stateHash = createHash('sha256').update(state).digest('hex');
  const savedState = await supabaseServiceRequest('messenger_settings?select=oauth_state_hash,oauth_state_expires_at&id=eq.1&limit=1');
  if (!savedState.ok) throw new Error('AI Inbox database is not ready for Facebook OAuth.');
  const settings = (await savedState.json())[0];
  if (!settings?.oauth_state_hash || !safeEqualText(stateHash, String(settings.oauth_state_hash)) || Date.parse(settings.oauth_state_expires_at || '') < Date.now()) {
    return json(res, 400, { error: 'Facebook login expired or state check failed. Start again from AI Inbox.' });
  }
  const { appId, appSecret, redirectUri } = metaConfig();
  const tokenUrl = new URL(`https://graph.facebook.com/${graphVersion()}/oauth/access_token`);
  tokenUrl.searchParams.set('client_id', appId);
  tokenUrl.searchParams.set('client_secret', appSecret);
  tokenUrl.searchParams.set('redirect_uri', redirectUri);
  tokenUrl.searchParams.set('code', code);
  const tokenResponse = await fetch(tokenUrl);
  const tokenData: any = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !tokenData.access_token) throw new Error(tokenData?.error?.message || 'Could not exchange Facebook login code.');
  const pages = await metaFetch(`me/accounts?fields=id,name,access_token,tasks&limit=100&access_token=${encodeURIComponent(tokenData.access_token)}`);
  const eligible = (pages.data || []).filter((page: any) => page?.id && page?.access_token && (page.tasks || []).some((task: string) => task === 'MESSAGING'));
  const page = eligible.find((candidate: any) => String(candidate.name || '').trim().toLowerCase() === 'ramyachobi') || (eligible.length === 1 ? eligible[0] : null);
  if (!page) throw new Error(eligible.length ? 'আপনার Facebook login-এ RamyaChobi Page খুঁজে পাইনি। একাধিক Page থাকলে Meta-তে RamyaChobi-র permission দিন।' : 'আপনার Facebook account-এ messaging permission-সহ কোনো Page পাওয়া যায়নি।');
  await metaFetch(`${encodeURIComponent(page.id)}/subscribed_apps?subscribed_fields=messages,messaging_postbacks&access_token=${encodeURIComponent(page.access_token)}`, { method: 'POST' });
  const saved = await supabaseServiceRequest('messenger_settings?on_conflict=id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ id: 1, page_id: String(page.id), page_name: String(page.name || 'RamyaChobi'), page_access_token_enc: encryptPageToken(String(page.access_token)), is_connected: true, oauth_state_hash: null, oauth_state_expires_at: null, updated_at: new Date().toISOString() }),
  });
  if (!saved.ok) throw new Error('Facebook connected but Page credentials could not be saved securely.');
  res.status(302).setHeader('location', '/delivery-admin/ai-inbox?connected=1').setHeader('cache-control', 'no-store').end();
}

async function handleMetaWebhookGet(req: any, res: VercelResponse) {
  const query = req.query || {};
  const mode = String(query['hub.mode'] || '');
  const token = String(query['hub.verify_token'] || '');
  const challenge = String(query['hub.challenge'] || '');
  const expected = process.env.META_WEBHOOK_VERIFY_TOKEN || '';
  if (mode === 'subscribe' && expected && safeEqualText(token, expected)) {
    return res.status(200).setHeader('content-type', 'text/plain; charset=utf-8').setHeader('cache-control', 'no-store').end(challenge);
  }
  return res.status(403).end('Webhook verification failed.');
}

async function handleMetaWebhookPost(rawBody: Buffer, signature: string, res: VercelResponse) {
  const appSecret = process.env.META_APP_SECRET || '';
  if (!appSecret || !signature.startsWith('sha256=')) return res.status(401).end('Invalid signature.');
  const expected = `sha256=${createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
  if (!safeEqualText(signature, expected)) return res.status(401).end('Invalid signature.');
  const payload: any = JSON.parse(rawBody.toString('utf8'));
  if (payload.object !== 'page') return res.status(404).end('Unsupported webhook object.');
  for (const entry of payload.entry || []) {
    const pageId = String(entry.id || '');
    for (const event of entry.messaging || []) {
      const text = String(event.message?.text || '').trim();
      const senderId = String(event.sender?.id || '');
      const messageId = String(event.message?.mid || '');
      if (!pageId || !senderId || !messageId || !text || event.message?.is_echo) continue;
      const settingsRes = await supabaseServiceRequest(`messenger_settings?select=id,page_id,is_connected&id=eq.1&limit=1`);
      if (!settingsRes.ok) throw new Error('Could not verify connected Page for webhook.');
      const settings = (await settingsRes.json())[0];
      if (!settings?.is_connected || String(settings.page_id) !== pageId) continue;
      const externalId = `${pageId}:${senderId}`;
      const existing = await supabaseServiceRequest(`messenger_threads?select=id,unread_count&external_id=eq.${encodeURIComponent(externalId)}&limit=1`);
      if (!existing.ok) throw new Error('Could not read Messenger thread.');
      const priorThread = (await existing.json())[0];
      const savedThread = await supabaseServiceRequest('messenger_threads?on_conflict=external_id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify({ platform: 'facebook', external_id: externalId, customer_name: 'Facebook customer', last_message: text.slice(0, 2000), last_message_at: new Date(Number(event.timestamp) || Date.now()).toISOString(), unread_count: Math.min(9999, Number(priorThread?.unread_count || 0) + 1), updated_at: new Date().toISOString() }),
      });
      if (!savedThread.ok) throw new Error('Could not save Messenger thread.');
      const thread = (await savedThread.json())[0];
      if (!thread?.id) continue;
      const savedMessage = await supabaseServiceRequest('messenger_messages?on_conflict=external_id', {
        method: 'POST',
        headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
        body: JSON.stringify({ thread_id: thread.id, external_id: messageId, direction: 'inbound', message_text: text.slice(0, 4000), sent_by: 'customer' }),
      });
      if (!savedMessage.ok) throw new Error('Could not save Messenger message.');
    }
  }
  return res.status(200).end('EVENT_RECEIVED');
}

function callbackHtml(message: string) {
  const escaped = message.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char] || char));
  return `<!doctype html><html><meta name="viewport" content="width=device-width"><title>Facebook connection</title><body style="font:16px system-ui;max-width:560px;margin:48px auto;padding:0 20px;color:#292719"><h2>Facebook Page connection</h2><p>${escaped}</p><a href="/delivery-admin/ai-inbox">Return to AI Inbox</a></body></html>`;
}

function extractDriveId(sourceUrl: string, kind: 'file' | 'folder') {
  let parsed: URL;
  try { parsed = new URL(sourceUrl.trim()); } catch { return null; }
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'drive.google.com') return null;
  const pattern = kind === 'folder' ? /\/folders\/([A-Za-z0-9_-]+)/i : /\/file\/d\/([A-Za-z0-9_-]+)/i;
  return parsed.pathname.match(pattern)?.[1] || parsed.searchParams.get('id');
}

async function driveMetadata(id: string) {
  const token = await getDriveAccessToken();
  const fields = 'id,name,mimeType,size,fileExtension,thumbnailLink,modifiedTime,trashed,parents';
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=${encodeURIComponent(fields)}&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    if (response.status === 404) throw new Error('Google Drive file was not found or is not shared with the connected account.');
    if (response.status === 403) throw new Error('The connected account cannot access this private Drive item. Share it with that account; do not make it public.');
    throw new Error(`Google Drive metadata request failed (HTTP ${response.status}).`);
  }
  const data = await response.json();
  if (data.trashed) throw new Error('This Google Drive item is in the trash.');
  return data;
}

function classifyFile(mime: string, fileName: string): 'PHOTO' | 'VIDEO' | 'DOCUMENT' {
  const name = fileName.toLowerCase();
  const imageExt = ['.jpg','.jpeg','.png','.webp','.gif','.heic','.heif','.tif','.tiff','.bmp','.raw','.arw','.cr2','.cr3','.nef','.dng','.raf','.orf','.rw2','.pef','.srw','.3fr','.iiq'];
  const videoExt = ['.mp4','.mov','.m4v','.avi','.mkv','.webm','.wmv','.flv','.mpeg','.mpg','.3gp'];
  if (mime.startsWith('image/') || (mime === 'application/octet-stream' && imageExt.some(x => name.endsWith(x)))) return 'PHOTO';
  if (mime.startsWith('video/') || mime === 'application/vnd.google-apps.video' || (mime === 'application/octet-stream' && videoExt.some(x => name.endsWith(x)))) return 'VIDEO';
  return 'DOCUMENT';
}

async function handleMessengerRequest(body: any, res: VercelResponse) {
  const action = String(body.action || 'load');
  if (action === 'load') {
    const [settingsRes, faqsRes, threadsRes] = await Promise.all([
      supabaseServiceRequest('messenger_settings?select=id,page_id,page_name,is_connected,ai_enabled,auto_reply_enabled&id=eq.1&limit=1'),
      supabaseServiceRequest('messenger_faqs?select=id,question,answer,keywords,is_active,created_at&order=created_at.desc'),
      supabaseServiceRequest('messenger_threads?select=id,platform,customer_name,last_message,last_message_at,unread_count,status&order=last_message_at.desc.nullslast&limit=50'),
    ]);
    if (!settingsRes.ok || !faqsRes.ok || !threadsRes.ok) throw new Error('AI Inbox database is not ready. Apply the AI Inbox migration and retry.');
    const [settings, faqs, threads] = await Promise.all([settingsRes.json(), faqsRes.json(), threadsRes.json()]);
    return json(res, 200, { settings: settings[0] || { id: 1, is_connected: false, ai_enabled: false, auto_reply_enabled: false }, faqs, threads });
  }
  if (action === 'settings') {
    const currentRes = await supabaseServiceRequest('messenger_settings?select=id,is_connected&id=eq.1&limit=1');
    if (!currentRes.ok) throw new Error('AI Inbox database is not ready. Apply the AI Inbox migration and retry.');
    const current = (await currentRes.json())[0] || { id: 1, is_connected: false };
    const saved = await supabaseServiceRequest('messenger_settings?on_conflict=id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ id: 1, ai_enabled: Boolean(body.ai_enabled), auto_reply_enabled: Boolean(body.auto_reply_enabled) && Boolean(current.is_connected), updated_at: new Date().toISOString() }),
    });
    if (!saved.ok) throw new Error('Could not save AI Inbox settings.');
    return json(res, 200, { ok: true });
  }
  if (action === 'save_faq') {
    const question = String(body.question || '').trim();
    const answer = String(body.answer || '').trim();
    if (question.length < 3 || question.length > 1000 || !answer || answer.length > 4000) return json(res, 400, { error: 'প্রশ্ন ৩–১০০০ অক্ষর এবং উত্তর ১–৪০০০ অক্ষর দিন।' });
    const record = { question, answer, keywords: Array.isArray(body.keywords) ? body.keywords.map((v: unknown) => String(v).slice(0, 80)).slice(0, 20) : [], is_active: true };
    const saved = await supabaseServiceRequest('messenger_faqs', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(record) });
    if (!saved.ok) throw new Error('FAQ save failed.');
    return json(res, 200, { faq: (await saved.json())[0] });
  }
  if (action === 'delete_faq') {
    const id = String(body.id || '');
    if (!/^[0-9a-f-]{36}$/i.test(id)) return json(res, 400, { error: 'FAQ ID is invalid.' });
    const deleted = await supabaseServiceRequest(`messenger_faqs?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!deleted.ok) throw new Error('FAQ delete failed.');
    return json(res, 200, { ok: true });
  }
  return json(res, 400, { error: 'Unknown AI Inbox action.' });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const query = req.query || {};
  const url = new URL(req.url || '/', 'https://vercel.local');
  const isWebhook = query.meta_webhook === '1' || url.searchParams.get('meta_webhook') === '1';
  const isCallback = query.meta_oauth_callback === '1' || url.searchParams.get('meta_oauth_callback') === '1';
  if (isWebhook && req.method === 'GET') return handleMetaWebhookGet(req, res);
  if (isCallback && req.method === 'GET') {
    try { return await handleMetaOAuthCallback(req, res); }
    catch (error: any) {
      console.error('[meta-oauth-callback]', String(error?.message || 'OAuth callback failed').slice(0, 180));
      return res.status(502).setHeader('content-type', 'text/html; charset=utf-8').setHeader('cache-control', 'no-store').end(callbackHtml(error?.message || 'Facebook connection failed.'));
    }
  }
  if (isWebhook && req.method === 'POST') {
    try {
      const rawBody = await readRawBody(req);
      return await handleMetaWebhookPost(rawBody, String(req.headers['x-hub-signature-256'] || ''), res);
    } catch (error: any) {
      console.error('[meta-webhook]', String(error?.message || 'Webhook failed').slice(0, 180));
      return res.status(500).end('Webhook processing failed.');
    }
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'Only POST is supported.' });
  try {
    const rawBody = await readRawBody(req);
    const body = rawBody.length ? JSON.parse(rawBody.toString('utf8')) : {};
    if (body.feature === 'ai-inbox' && body.action === 'connect_facebook') {
      return await startMetaOAuth(req, body, res);
    }
    const adminToken = String(body.adminToken || '').trim();
    if (body.feature === 'ai-inbox') {
      if (!adminToken) return json(res, 401, { error: 'Admin session is required.' });
      await rpc('delivery_admin_dashboard', { p_token: adminToken });
      return await handleMessengerRequest(body, res);
    }
    const portalId = String(body.portalId || '').trim();
    const sourceUrl = String(body.sourceUrl || '').trim();
    const requestedType = String(body.fileType || 'PHOTO').toUpperCase();
    const title = String(body.title || '').trim();
    const fileNameInput = String(body.fileName || '').trim();
    const sortOrder = Math.max(0, Number(body.sortOrder || 0));
    const existingFileId = body.fileId ? String(body.fileId) : null;
    if (!adminToken || !portalId || !sourceUrl) return json(res, 400, { error: 'Admin token, delivery ID and private Drive link are required.' });
    if (!/^[0-9a-f-]{36}$/i.test(portalId) || (existingFileId && !/^[0-9a-f-]{36}$/i.test(existingFileId))) return json(res, 400, { error: 'Invalid delivery or file ID.' });
    if (!['PHOTO','VIDEO','DOCUMENT','FOLDER'].includes(requestedType)) return json(res, 400, { error: 'Choose a photo, video, document or folder.' });
    await rpc('delivery_admin_list_files', { p_token: adminToken, p_portal_id: portalId });
    const fileType = requestedType as 'PHOTO' | 'VIDEO' | 'DOCUMENT' | 'FOLDER';
    const driveId = extractDriveId(sourceUrl, fileType === 'FOLDER' ? 'folder' : 'file');
    if (!driveId) return json(res, 400, { error: 'This is not a valid private Google Drive file or folder link.' });
    const metadata = await driveMetadata(driveId);
    if (fileType === 'FOLDER') {
      if (metadata.mimeType !== 'application/vnd.google-apps.folder') return json(res, 400, { error: 'This Drive item is not a folder.' });
      return json(res, 200, { verified: true, fileType, driveId, metadata: { id: metadata.id, name: metadata.name, mimeType: metadata.mimeType } });
    }
    const detected = classifyFile(String(metadata.mimeType || ''), String(metadata.name || ''));
    if (fileType !== detected) return json(res, 400, { error: `This Drive item is a ${detected.toLowerCase()}, not a ${fileType.toLowerCase()}.` });
    if (body.persist === false) return json(res, 200, { verified: true, fileType, driveId, metadata: { id: metadata.id, name: metadata.name, mimeType: metadata.mimeType, size: metadata.size || null } });
    const saved: any = await rpc('delivery_admin_upsert_file', {
      p_token: adminToken, p_portal_id: portalId, p_file_id: existingFileId,
      p_source_url: sourceUrl, p_file_type: fileType, p_title: title || metadata.name || null,
      p_file_name: fileNameInput || metadata.name || null, p_mime_type: metadata.mimeType || null,
      p_sort_order: sortOrder, p_is_visible: body.isVisible !== false,
    });
    if (saved?.id && metadata.size) {
      const update = await supabaseServiceRequest(`delivery_files?id=eq.${encodeURIComponent(String(saved.id))}&portal_id=eq.${encodeURIComponent(portalId)}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ file_size_bytes: Number(metadata.size) }),
      });
      if (!update.ok) throw new Error('File was added but its file size could not be saved.');
    }
    return json(res, 200, { verified: true, saved: true, fileType, driveId, metadata: { id: metadata.id, name: metadata.name, mimeType: metadata.mimeType, size: metadata.size || null }, file: saved });
  } catch (error: any) {
    const status = /admin session/i.test(String(error?.message || '')) ? 401 : 502;
    console.error('[delivery-validate]', String(error?.message || 'Drive validation failed').slice(0, 180));
    return json(res, status, { error: error?.message || 'Google Drive link validation failed.' });
  }
}
