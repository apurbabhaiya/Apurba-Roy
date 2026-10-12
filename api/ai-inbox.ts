type Request = { method?: string; body?: any };
type Response = { status(code: number): Response; json(body: unknown): void; setHeader(name: string, value: string): void };

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://izfmwvqveiphyuufvxoq.supabase.co';

function config() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!key) throw new Error('AI Inbox backend is not configured: SUPABASE_SERVICE_ROLE_KEY is missing.');
  return { key, url: SUPABASE_URL.replace(/\/$/, '') };
}

async function rest(path: string, init: RequestInit = {}) {
  const { key, url } = config();
  return fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

async function assertAdmin(token: string) {
  if (!token || token.length > 256) return false;
  const { key, url } = config();
  const response = await fetch(`${url}/rest/v1/rpc/delivery_admin_dashboard`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ p_token: token }),
  });
  return response.ok;
}

function reply(res: Response, status: number, body: unknown) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(status).json(body);
}

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') return reply(res, 405, { error: 'POST required.' });
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  try {
    if (!(await assertAdmin(String(body.adminToken || '')))) return reply(res, 401, { error: 'Admin session expired. Sign in again.' });
    const action = String(body.action || 'load');

    if (action === 'load') {
      const [settingsRes, faqsRes, threadsRes] = await Promise.all([
        rest('messenger_settings?select=id,page_id,page_name,is_connected,ai_enabled,auto_reply_enabled&id=eq.1&limit=1'),
        rest('messenger_faqs?select=id,question,answer,keywords,is_active,created_at&order=created_at.desc'),
        rest('messenger_threads?select=id,platform,customer_name,last_message,last_message_at,unread_count,status&order=last_message_at.desc.nullslast&limit=50'),
      ]);
      if (!settingsRes.ok || !faqsRes.ok || !threadsRes.ok) throw new Error('AI Inbox database is not ready. Apply the AI Inbox migration and retry.');
      const [settings, faqs, threads] = await Promise.all([settingsRes.json(), faqsRes.json(), threadsRes.json()]);
      return reply(res, 200, { settings: settings[0] || { id: 1, is_connected: false, ai_enabled: false, auto_reply_enabled: false }, faqs, threads });
    }

    if (action === 'settings') {
      const currentRes = await rest('messenger_settings?select=id,is_connected&id=eq.1&limit=1');
      if (!currentRes.ok) throw new Error('AI Inbox database is not ready. Apply the AI Inbox migration and retry.');
      const current = (await currentRes.json())[0] || { id: 1, is_connected: false };
      const next = {
        id: 1,
        ai_enabled: Boolean(body.ai_enabled),
        auto_reply_enabled: Boolean(body.auto_reply_enabled) && Boolean(current.is_connected),
        updated_at: new Date().toISOString(),
      };
      const saved = await rest('messenger_settings?on_conflict=id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(next),
      });
      if (!saved.ok) throw new Error('Could not save AI Inbox settings.');
      return reply(res, 200, { ok: true });
    }

    if (action === 'save_faq') {
      const question = String(body.question || '').trim();
      const answer = String(body.answer || '').trim();
      if (question.length < 3 || question.length > 1000 || !answer || answer.length > 4000) return reply(res, 400, { error: 'প্রশ্ন ৩–১০০০ অক্ষর এবং উত্তর ১–৪০০০ অক্ষর দিন।' });
      const record = { question, answer, keywords: Array.isArray(body.keywords) ? body.keywords.map((v: unknown) => String(v).slice(0, 80)).slice(0, 20) : [], is_active: true };
      const saved = await rest('messenger_faqs', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(record) });
      if (!saved.ok) throw new Error('FAQ save failed.');
      return reply(res, 200, { faq: (await saved.json())[0] });
    }

    if (action === 'delete_faq') {
      const id = String(body.id || '');
      if (!/^[0-9a-f-]{36}$/i.test(id)) return reply(res, 400, { error: 'FAQ ID is invalid.' });
      const deleted = await rest(`messenger_faqs?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!deleted.ok) throw new Error('FAQ delete failed.');
      return reply(res, 200, { ok: true });
    }

    return reply(res, 400, { error: 'Unknown AI Inbox action.' });
  } catch (error: any) {
    const message = String(error?.message || 'AI Inbox request failed.');
    return reply(res, /not configured|missing/.test(message) ? 503 : 500, { error: message });
  }
}
