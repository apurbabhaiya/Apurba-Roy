import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Loader2, RefreshCw, Save, TicketCheck } from 'lucide-react';
import { getSpinResultAdminSnapshot, updateSpinResultAdmin, type SpinSubmission } from '../services/spinResultService';
import SpinLoyaltyAdmin from './SpinLoyaltyAdmin';

type Status = SpinSubmission['status'];
const labels: Record<Status, string> = { pending: 'নতুন', verified: 'যাচাই হয়েছে', redeemed: 'পুরস্কার দেওয়া হয়েছে', rejected: 'বাতিল' };
const statusStyle: Record<Status, string> = { pending: 'bg-amber-100 text-amber-900', verified: 'bg-blue-100 text-blue-900', redeemed: 'bg-emerald-100 text-emerald-900', rejected: 'bg-stone-100 text-stone-600' };
const fieldClass = 'min-h-10 rounded-lg border border-stone-300 bg-white px-3 text-sm';

export default function SpinResultAdmin({ adminToken }: { adminToken: string }) {
  const [items, setItems] = useState<SpinSubmission[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { status: Status; note: string }>>({});
  const [filter, setFilter] = useState<'all' | Status>('all');
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function load() {
    if (!adminToken) return;
    setLoading(true); setMessage('');
    try {
      const data = await getSpinResultAdminSnapshot(adminToken);
      setItems(data);
      setDrafts(Object.fromEntries(data.map(item => [item.id, { status: item.status, note: item.admin_note || '' }])));
    } catch (error: any) {
      setMessage(error?.message || 'স্পিনের ফলাফল লোড করা যায়নি।');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [adminToken]);

  const counts = useMemo(() => ({
    all: items.length,
    pending: items.filter(item => item.status === 'pending').length,
    verified: items.filter(item => item.status === 'verified').length,
    redeemed: items.filter(item => item.status === 'redeemed').length,
    rejected: items.filter(item => item.status === 'rejected').length,
  }), [items]);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter(item => (filter === 'all' || item.status === filter) && (!needle || [item.customer_name, item.phone, item.spin_result, item.address].some(value => value.toLowerCase().includes(needle))));
  }, [items, filter, query]);

  async function save(item: SpinSubmission) {
    const draft = drafts[item.id];
    if (!draft || busyId) return;
    setBusyId(item.id); setMessage('');
    try {
      await updateSpinResultAdmin(adminToken, item.id, draft.status, draft.note);
      setMessage('ফলাফলের অবস্থা সেভ হয়েছে।');
      await load();
    } catch (error: any) {
      setMessage(error?.message || 'অবস্থা সেভ করা যায়নি।');
    } finally {
      setBusyId('');
    }
  }

  return (
    <section className="mx-auto max-w-[1500px] space-y-4 px-4 py-5" aria-label="Spin result management">
      <SpinLoyaltyAdmin adminToken={adminToken}/>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-4">
        <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800"><TicketCheck className="h-5 w-5"/></span><div><h2 className="text-lg font-black">Spin Results</h2><p className="text-sm text-stone-500">{counts.pending}টি নতুন · মোট {counts.all}টি জমা</p></div></div>
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-stone-300 px-3 text-sm font-bold disabled:opacity-50"><RefreshCw className={'h-4 w-4 '+(loading?'animate-spin':'')}/>রিফ্রেশ</button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{(['pending','verified','redeemed','rejected'] as const).map(status => <div key={status} className="rounded-xl border border-stone-200 bg-white p-3"><p className="text-xs font-semibold text-stone-500">{labels[status]}</p><p className="mt-1 text-xl font-black">{counts[status]}</p></div>)}</div>
      <div className="flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-3 sm:flex-row">
        <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="নাম, মোবাইল, পুরস্কার বা ঠিকানা খুঁজুন" className={fieldClass+' min-h-11 flex-1'}/>
        <select aria-label="ফলাফল ফিল্টার" value={filter} onChange={e => setFilter(e.target.value as 'all' | Status)} className={fieldClass+' min-h-11'}><option value="all">সব ফলাফল</option>{Object.keys(labels).map(key => <option key={key} value={key}>{labels[key as Status]}</option>)}</select>
      </div>
      {message && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">{message}</p>}
      <div className="grid gap-3 xl:grid-cols-2">
        {shown.map(item => {
          const draft = drafts[item.id] || { status: item.status, note: item.admin_note || '' };
          return <article key={item.id} className="min-w-0 rounded-2xl border border-stone-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="break-words text-lg font-black">{item.customer_name}</h3><span className={'rounded-full px-2.5 py-1 text-xs font-bold '+statusStyle[item.status]}>{labels[item.status]}</span></div><p className="mt-1 text-sm font-semibold text-emerald-900">{item.spin_result}</p></div><time className="text-xs text-stone-500">{new Date(item.created_at).toLocaleString('bn-BD')}</time></div>
            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2"><a className="break-all font-semibold text-emerald-900 underline" href={'tel:'+item.phone}>{item.phone}</a><p className="break-words sm:col-span-2">{item.address}</p>{item.campaign_link && <a href={item.campaign_link} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1 break-all text-emerald-800 underline sm:col-span-2">স্পিন / পোস্টের লিংক খুলুন<ExternalLink className="h-4 w-4 shrink-0"/></a>}</div>
            <div className="mt-4 grid gap-3 border-t border-stone-100 pt-4 sm:grid-cols-[1fr_1.5fr_auto] sm:items-end">
              <label className="text-xs font-bold">অবস্থা<select className={fieldClass+' mt-1 w-full'} value={draft.status} onChange={e => setDrafts(current => ({ ...current, [item.id]: { ...draft, status: e.target.value as Status } }))}>{Object.entries(labels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className="text-xs font-bold">অ্যাডমিন নোট<input maxLength={2000} className={fieldClass+' mt-1 w-full'} value={draft.note} onChange={e => setDrafts(current => ({ ...current, [item.id]: { ...draft, note: e.target.value } }))} placeholder="যাচাই বা পুরস্কার দেওয়ার নোট"/></label>
              <button type="button" onClick={() => void save(item)} disabled={loading || busyId === item.id} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#193e32] px-3 text-sm font-bold text-white disabled:opacity-50">{busyId === item.id?<Loader2 className="h-4 w-4 animate-spin"/>:<Save className="h-4 w-4"/>}সেভ</button>
            </div>
            {item.admin_note && <p className="mt-3 text-xs text-stone-500">আগের নোট: {item.admin_note}</p>}
          </article>;
        })}
      </div>
      {!loading && shown.length === 0 && <p className="rounded-2xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500">কোনো ফলাফল পাওয়া যায়নি।</p>}
      {loading && <p role="status" className="flex items-center justify-center gap-2 py-8 text-sm text-stone-500"><Loader2 className="h-5 w-5 animate-spin"/>ফলাফল লোড হচ্ছে…</p>}
    </section>
  );
}
