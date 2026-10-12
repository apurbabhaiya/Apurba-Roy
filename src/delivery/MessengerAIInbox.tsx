import React, { useCallback, useEffect, useState } from 'react';
import { Activity, ArrowLeft, Bot, Check, ChevronRight, CircleHelp, Facebook, Inbox, Loader2, MessageSquare, Plus, Send, Settings2, Sparkles, Trash2, Zap } from 'lucide-react';
import { deliveryAdminLogin } from '../services/deliveryPortalService';

const TOKEN_KEY = 'ramya_booking_admin_token_v1';
type Faq = { id: string; question: string; answer: string; keywords: string[]; is_active: boolean };
type Thread = { id: string; platform: string; customer_name: string | null; last_message: string | null; last_message_at: string | null; unread_count: number; status: string };
type Settings = { page_name?: string | null; is_connected: boolean; ai_enabled: boolean; auto_reply_enabled: boolean };

export default function MessengerAIInbox() {
  const [token, setToken] = useState(() => { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } });
  const [code, setCode] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'inbox' | 'agent' | 'automations' | 'knowledge' | 'settings'>('inbox');
  const [settings, setSettings] = useState<Settings>({ is_connected: false, ai_enabled: false, auto_reply_enabled: false });
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');

  const call = useCallback(async (action: string, extra: Record<string, unknown> = {}) => {
    const response = await fetch('/api/ai-inbox', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ adminToken: token, action, ...extra }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Request failed.');
    return data;
  }, [token]);

  const load = useCallback(async () => {
    if (!token) return;
    setBusy(true);
    try {
      const data = await call('load');
      setSettings(data.settings);
      setFaqs(data.faqs || []);
      setThreads(data.threads || []);
      setNotice('');
    } catch (e: any) {
      setNotice(e.message || 'ইনবক্স লোড করা যায়নি।');
      if (e.message?.includes('session expired')) { localStorage.removeItem(TOKEN_KEY); setToken(''); }
    } finally { setBusy(false); }
  }, [call, token]);

  useEffect(() => { void load(); }, [load]);

  async function signIn(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setNotice('');
    try {
      const result = await deliveryAdminLogin(code);
      const next = result?.token || '';
      if (!next) throw new Error('Admin session তৈরি করা যায়নি।');
      localStorage.setItem(TOKEN_KEY, next); setToken(next); setCode('');
    } catch (e: any) { setNotice(e.message || 'Admin sign-in failed.'); setBusy(false); }
  }

  async function saveSettings(next: Settings) {
    setSettings(next); setBusy(true); setNotice('');
    try { await call('settings', { ai_enabled: next.ai_enabled, auto_reply_enabled: next.auto_reply_enabled }); setNotice('সেটিংস সেভ হয়েছে।'); }
    catch (e: any) { setNotice(e.message || 'সেটিংস সেভ হয়নি।'); await load(); }
    finally { setBusy(false); }
  }

  async function addFaq(event: React.FormEvent) {
    event.preventDefault(); if (!question.trim() || !answer.trim()) return;
    setBusy(true); setNotice('');
    try { const data = await call('save_faq', { question, answer }); setFaqs((items) => [data.faq, ...items]); setQuestion(''); setAnswer(''); setNotice('FAQ যোগ হয়েছে।'); }
    catch (e: any) { setNotice(e.message || 'FAQ সেভ হয়নি।'); }
    finally { setBusy(false); }
  }

  async function removeFaq(id: string) {
    setBusy(true);
    try { await call('delete_faq', { id }); setFaqs((items) => items.filter((faq) => faq.id !== id)); }
    catch (e: any) { setNotice(e.message || 'FAQ মুছতে পারেনি।'); }
    finally { setBusy(false); }
  }

  async function connectPage() {
    setNotice('Facebook OAuth-এর জন্য Vercel-এ Meta App ID ও Secret এবং Meta Developer Console-এ callback/webhook সেট করতে হবে। এই প্রিভিউতে Page token নেওয়া বা মেসেজ পাঠানো চালু নেই।');
    setTab('settings');
  }

  if (!token) return <main className="min-h-screen bg-[#f5f2eb] flex items-center justify-center px-5"><form onSubmit={signIn} className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl border border-stone-200"><div className="text-xs font-bold tracking-[.24em] text-amber-700">RAMYACHOBI · ADMIN</div><h1 className="mt-3 text-3xl font-semibold text-stone-900">AI Inbox</h1><p className="mt-2 text-sm text-stone-500">Delivery Admin-এর একই access code দিয়ে sign in করুন।</p><input type="password" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Admin access code" className="mt-6 w-full rounded-xl border border-stone-300 px-4 py-3" required/><button disabled={busy} className="mt-3 w-full rounded-xl bg-stone-900 px-4 py-3 font-semibold text-white disabled:opacity-60">{busy ? 'Signing in…' : 'Sign in'}</button>{notice && <p className="mt-4 text-sm text-red-700">{notice}</p>}<a className="mt-5 inline-block text-sm text-stone-500 underline" href="/delivery-admin">← Admin Panel</a></form></main>;

  const tabs = [
    { id: 'inbox', label: 'Inbox', icon: Inbox },
    { id: 'agent', label: 'AI Agent', icon: Bot },
    { id: 'automations', label: 'Automations', icon: Zap },
    { id: 'knowledge', label: 'Knowledge', icon: CircleHelp },
    { id: 'settings', label: 'Settings', icon: Settings2 },
  ] as const;

  return <main className="min-h-screen bg-[#f5f2eb] text-stone-900">
    <header className="bg-stone-950 px-5 py-5 text-white"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4"><div><a href="/delivery-admin" className="mb-2 inline-flex items-center gap-2 text-xs text-white/60 hover:text-white"><ArrowLeft className="h-3.5 w-3.5"/> Admin Panel</a><div className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">RamyaChobi</div><h1 className="mt-1 text-2xl font-semibold">AI Inbox</h1></div><div className="flex items-center gap-3"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${settings.is_connected ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/10 text-white/60'}`}>{settings.is_connected ? 'Facebook Connected' : 'Page not connected'}</span><button onClick={() => void load()} className="rounded-xl border border-white/15 p-2.5" aria-label="Refresh"><Activity className="h-4 w-4"/></button></div></div></header>
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 md:grid-cols-[220px_1fr] md:px-6">
      <aside className="rounded-2xl border border-stone-200 bg-white p-3 shadow-sm"><nav className="flex gap-2 overflow-x-auto md:flex-col">{tabs.map(({id,label,icon:Icon})=><button key={id} onClick={()=>setTab(id)} className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold ${tab===id?'bg-stone-900 text-white':'text-stone-600 hover:bg-stone-100'}`}><Icon className="h-4 w-4"/>{label}{id==='inbox' && threads.length>0 && <span className="ml-auto rounded-full bg-amber-300 px-2 py-0.5 text-[10px] text-stone-900">{threads.length}</span>}</button>)}</nav><div className="mt-5 hidden rounded-xl bg-amber-50 p-4 text-xs leading-5 text-stone-600 md:block"><Sparkles className="mb-2 h-4 w-4 text-amber-700"/> AI reply চালু করার আগে FAQ ও package তথ্য যোগ করুন। প্রথমে manual approval রাখা হবে।</div></aside>
      <section className="min-h-[610px] rounded-2xl border border-stone-200 bg-white p-5 shadow-sm md:p-7">
        {notice && <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">{notice}</div>}
        {busy && <div className="mb-3 flex items-center gap-2 text-xs text-stone-400"><Loader2 className="h-3.5 w-3.5 animate-spin"/> Working…</div>}
        {tab==='inbox' && <><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-2xl font-semibold">Messages</h2><p className="mt-1 text-sm text-stone-500">Facebook and Instagram customer conversations</p></div><button onClick={()=>void connectPage()} className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white"><Facebook className="h-4 w-4"/> Connect Facebook Page</button></div>
        {threads.length===0 ? <div className="mt-12 flex min-h-[330px] flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-6 text-center"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><MessageSquare className="h-6 w-6"/></div><h3 className="mt-4 text-lg font-semibold">কোনো conversation এখনো নেই</h3><p className="mt-2 max-w-md text-sm leading-6 text-stone-500">Facebook Page সংযুক্ত ও webhook configure হলে customer message এখানে আসবে। এই পেজে demo message দেখানো হয় না।</p><button onClick={()=>void connectPage()} className="mt-5 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white">Page connect setup</button></div> : <div className="mt-6 divide-y divide-stone-100">{threads.map(t=><button key={t.id} className="flex w-full items-center justify-between py-4 text-left"><div><div className="font-semibold">{t.customer_name||'Facebook customer'}</div><div className="mt-1 text-sm text-stone-500">{t.last_message||'Message'}</div></div><div className="text-xs text-stone-400">{t.platform}</div></button>)}</div>}</>}
        {tab==='agent' && <><h2 className="text-2xl font-semibold">AI Agent</h2><p className="mt-1 text-sm text-stone-500">FAQ-ভিত্তিক উত্তর সাজেস্ট করবে; শুরুতে আপনি approve না করা পর্যন্ত auto-send হবে না।</p><div className="mt-6 rounded-2xl border border-stone-200 p-5"><div className="flex items-start justify-between gap-4"><div className="flex gap-3"><div className="rounded-xl bg-amber-100 p-3 text-amber-800"><Bot className="h-5 w-5"/></div><div><h3 className="font-semibold">RamyaChobi assistant</h3><p className="mt-1 text-sm text-stone-500">Packages, booking, delivery ও সাধারণ প্রশ্ন</p></div></div><button onClick={()=>void saveSettings({...settings,ai_enabled:!settings.ai_enabled})} aria-pressed={settings.ai_enabled} className={`relative h-7 w-12 rounded-full transition ${settings.ai_enabled?'bg-emerald-600':'bg-stone-300'}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${settings.ai_enabled?'left-6':'left-1'}`}/></button></div><div className="mt-5 flex items-center gap-2 text-sm"><span className={`h-2 w-2 rounded-full ${settings.ai_enabled?'bg-emerald-500':'bg-stone-300'}`}/>{settings.ai_enabled?'AI suggestions enabled':'AI suggestions paused'}</div><p className="mt-4 rounded-xl bg-stone-50 p-4 text-sm leading-6 text-stone-600">Facebook connection ও server-side AI key সেট না হওয়া পর্যন্ত AI উত্তর তৈরি হবে না। আমরা অজানা তথ্য বানিয়ে customer-কে পাঠাব না।</p></div></>}
        {tab==='automations' && <><h2 className="text-2xl font-semibold">Automations</h2><p className="mt-1 text-sm text-stone-500">মেসেজ এলে কী হবে সেটি নিয়ন্ত্রণ করুন।</p><div className="mt-6 space-y-3">{[{key:'auto_reply_enabled',title:'AI auto-reply',desc:'অনুমোদিত FAQ থেকে উত্তর পাঠানো',icon:Send},{key:'ai_enabled',title:'Reply suggestions',desc:'ইনবক্সে উত্তর draft তৈরি করা',icon:Sparkles}].map(({key,title,desc,icon:Icon})=><div key={key} className="flex items-center justify-between rounded-2xl border border-stone-200 p-5"><div className="flex items-center gap-3"><div className="rounded-xl bg-stone-100 p-3"><Icon className="h-4 w-4"/></div><div><h3 className="font-semibold">{title}</h3><p className="mt-1 text-sm text-stone-500">{desc}</p></div></div><button disabled={key==='auto_reply_enabled'&&!settings.is_connected} onClick={()=>void saveSettings({...settings,[key]:!settings[key as keyof Settings]})} className={`h-7 w-12 rounded-full p-1 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${settings[key as keyof Settings]?'bg-emerald-600':'bg-stone-300'}`}><span className={`block h-5 w-5 rounded-full bg-white transition ${settings[key as keyof Settings]?'translate-x-5':''}`}/></button></div>)}</div><div className="mt-5 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">Page এবং webhook সংযুক্ত না হওয়া পর্যন্ত auto-reply বন্ধ থাকবে।</div></>}
        {tab==='knowledge' && <><h2 className="text-2xl font-semibold">Knowledge & FAQs</h2><p className="mt-1 text-sm text-stone-500">AI কেবল এই অনুমোদিত তথ্য থেকেই উত্তর সাজেস্ট করবে।</p><form onSubmit={addFaq} className="mt-6 grid gap-3 rounded-2xl border border-stone-200 bg-stone-50 p-4"><input value={question} onChange={e=>setQuestion(e.target.value)} placeholder="প্রশ্ন, যেমন: Wedding package কত?" className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm" required/><textarea value={answer} onChange={e=>setAnswer(e.target.value)} placeholder="সঠিক উত্তর লিখুন…" rows={3} className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm" required/><button disabled={busy} className="inline-flex w-fit items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Plus className="h-4 w-4"/> Add approved answer</button></form><div className="mt-5 space-y-3">{faqs.length===0?<div className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500">এখনো FAQ নেই। AI চালুর আগে package ও booking-এর সঠিক তথ্য যোগ করুন।</div>:faqs.map(f=><article key={f.id} className="rounded-xl border border-stone-200 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{f.question}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-600">{f.answer}</p></div><button onClick={()=>void removeFaq(f.id)} aria-label="Delete FAQ" className="rounded-lg p-2 text-stone-400 hover:bg-red-50 hover:text-red-700"><Trash2 className="h-4 w-4"/></button></div></article>)}</div></>}
        {tab==='settings' && <><h2 className="text-2xl font-semibold">Connections & Settings</h2><p className="mt-1 text-sm text-stone-500">আপনার Page-এ অনুমতি দিয়ে সংযুক্ত করুন।</p><div className="mt-6 rounded-2xl border border-stone-200 p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><div className="rounded-xl bg-blue-50 p-3 text-blue-700"><Facebook className="h-5 w-5"/></div><div><h3 className="font-semibold">Facebook Page</h3><p className="mt-1 text-sm text-stone-500">{settings.is_connected?settings.page_name||'Page connected':'Not connected'}</p></div></div><span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-600">{settings.is_connected?'Connected':'Setup needed'}</span></div><button onClick={()=>void connectPage()} className="mt-5 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white">{settings.is_connected?'Reconnect Page':'Connect with Facebook'}</button></div><div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5"><h3 className="font-semibold text-amber-950">Facebook connection setup</h3><ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-amber-950/80"><li>Meta Developer app-এ Messenger product এবং Facebook Login যোগ করুন।</li><li>Vercel server environment-এ Meta App ID/Secret, webhook verify token ও token-encryption key দিন।</li><li>Webhook callback <code className="rounded bg-white px-1">/api/meta-webhook</code> verify করুন এবং messages event subscribe করুন।</li><li>Page permission দিয়ে authorize করলে webhook message এলে এই Inbox-এ দেখা যাবে।</li></ol><p className="mt-4 text-xs leading-5 text-amber-900/70">এই branch-এ OAuth callback/webhook receiver এখনো সক্রিয় নয়। Facebook permission দিলেই সরাসরি কানেক্ট হবে—এমন live connection এখানে দাবি করা হচ্ছে না।</p></div><button onClick={()=>void load()} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-stone-600"><Check className="h-4 w-4"/> Refresh connection status <ChevronRight className="h-4 w-4"/></button></>}
      </section>
    </div>
  </main>;
}
