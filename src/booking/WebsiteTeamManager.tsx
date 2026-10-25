import React, { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, ImagePlus, Loader2, Plus, RefreshCw, Save, Users, X } from 'lucide-react';
import {
  getWebsiteTeamAdminSnapshot,
  saveWebsiteTeamMember,
  setWebsiteTeamWorkPosts,
  type WebsiteTeamMember,
  type WebsiteTeamPortfolioPost,
  type WebsiteTeamWork,
} from '../services/websiteTeamService';

type Snapshot = { members: WebsiteTeamMember[]; work: WebsiteTeamWork[]; posts: WebsiteTeamPortfolioPost[] };
type Draft = {
  id?: string;
  name: string;
  role: string;
  phone: string;
  bio: string;
  photo_url: string;
  tags: string;
  sort_order: number;
  is_visible: boolean;
};

const blankDraft = (): Draft => ({
  name: '', role: '', phone: '', bio: '', photo_url: '', tags: '', sort_order: 0, is_visible: false,
});

const fieldClass = 'mt-1 min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/15';

async function compressPortrait(file: File) {
  if (!file.type.startsWith('image/')) throw new Error('ছবির ফাইল নির্বাচন করুন।');
  if (file.size > 15 * 1024 * 1024) throw new Error('ছবির ফাইল ১৫ MB-এর কম হতে হবে।');
  const image = await createImageBitmap(file);
  const scale = Math.min(1, 900 / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('ছবি প্রস্তুত করা যায়নি।');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();
  const dataUrl = canvas.toDataURL('image/jpeg', 0.84);
  if (dataUrl.length > 680_000) throw new Error('এই ছবিটি ছোট করে আবার আপলোড করুন।');
  return dataUrl;
}

export default function WebsiteTeamManager({ adminToken }: { adminToken: string }) {
  const [snapshot, setSnapshot] = useState<Snapshot>({ members: [], work: [], posts: [] });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [selectedPosts, setSelectedPosts] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const visibleCount = useMemo(() => snapshot.members.filter((member) => member.is_visible && !member.deleted_at).length, [snapshot.members]);

  async function load() {
    setLoading(true);
    setMessage('');
    try {
      const data = await getWebsiteTeamAdminSnapshot(adminToken);
      setSnapshot({ members: data.members || [], posts: data.posts || [], work: data.work || [] });
    } catch (error: any) {
      setMessage(error?.message || 'টিমের তথ্য লোড করা যায়নি।');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [adminToken]);

  function editMember(member: WebsiteTeamMember) {
    setDraft({
      id: member.id,
      name: member.name || '',
      role: member.role || '',
      phone: member.phone || '',
      bio: member.bio || '',
      photo_url: member.photo_url || '',
      tags: (member.tags || []).join(', '),
      sort_order: Number(member.sort_order || 0),
      is_visible: Boolean(member.is_visible),
    });
    setSelectedPosts(snapshot.work.filter((item) => item.member_id === member.id && item.post_id).map((item) => item.post_id as string));
    setMessage('');
  }

  function startNewMember() {
    setDraft(blankDraft());
    setSelectedPosts([]);
    setMessage('');
  }

  async function saveMember() {
    if (!draft) return;
    if (!draft.name.trim() || !draft.role.trim()) {
      setMessage('নাম ও পদ লিখুন।');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const member = await saveWebsiteTeamMember(adminToken, {
        id: draft.id,
        name: draft.name.trim(),
        role: draft.role.trim(),
        phone: draft.phone.trim(),
        bio: draft.bio.trim(),
        photo_url: draft.photo_url,
        tags: draft.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
        sort_order: Number(draft.sort_order || 0),
        is_visible: draft.is_visible,
      });
      await setWebsiteTeamWorkPosts(adminToken, member.id, selectedPosts);
      setDraft(null);
      setMessage('টিমের তথ্য সেভ হয়েছে।');
      await load();
    } catch (error: any) {
      setMessage(error?.message || 'তথ্য সেভ করা যায়নি।');
    } finally {
      setLoading(false);
    }
  }

  async function toggleVisibility(member: WebsiteTeamMember) {
    setLoading(true);
    setMessage('');
    try {
      await saveWebsiteTeamMember(adminToken, { ...member, is_visible: !member.is_visible });
      await load();
    } catch (error: any) {
      setMessage(error?.message || 'প্রকাশের অবস্থা বদলানো যায়নি।');
    } finally {
      setLoading(false);
    }
  }

  async function handlePhoto(file?: File) {
    if (!file || !draft) return;
    setLoading(true);
    setMessage('');
    try {
      const photoUrl = await compressPortrait(file);
      setDraft((current) => current ? { ...current, photo_url: photoUrl } : current);
      setMessage('ছবি প্রস্তুত হয়েছে। সেভ করলে সাইটে যোগ হবে।');
    } catch (error: any) {
      setMessage(error?.message || 'ছবি আপলোড করা যায়নি।');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-[1500px] space-y-5 px-4 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-900/10 bg-white p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800"><Users className="h-5 w-5"/></span>
          <div><h2 className="text-lg font-black">ওয়েবসাইট টিম</h2><p className="text-sm text-stone-500">{visibleCount} জন ক্লায়েন্টদের কাছে দেখা যাচ্ছে · {snapshot.members.length} জনের তথ্য</p></div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-stone-300 px-3 text-sm font-bold disabled:opacity-50"><RefreshCw className={'h-4 w-4 '+(loading?'animate-spin':'')}/>রিফ্রেশ</button>
          <button type="button" onClick={startNewMember} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#193e32] px-4 text-sm font-bold text-white"><Plus className="h-4 w-4"/>নতুন সদস্য</button>
        </div>
      </div>

      {message && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">{message}</p>}

      {draft && (
        <div className="rounded-2xl border border-emerald-900/15 bg-white p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3"><h3 className="text-lg font-black">{draft.id ? 'সদস্যের তথ্য সম্পাদনা' : 'নতুন সদস্য যোগ করুন'}</h3><button type="button" onClick={() => setDraft(null)} aria-label="বন্ধ করুন" className="flex h-10 w-10 items-center justify-center rounded-xl border border-stone-300"><X className="h-5 w-5"/></button></div>
          <div className="grid gap-4 md:grid-cols-[220px_1fr]">
            <div>
              <div className="aspect-[4/5] overflow-hidden rounded-xl bg-stone-100">{draft.photo_url ? <img src={draft.photo_url} alt="টিম সদস্য" className="h-full w-full object-cover"/> : <div className="flex h-full items-center justify-center text-sm text-stone-400">ছবি নেই</div>}</div>
              <label className="mt-2 flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-stone-300 px-3 text-sm font-bold"><ImagePlus className="h-4 w-4"/>ছবি আপলোড<input type="file" accept="image/*" className="sr-only" onChange={(event) => { void handlePhoto(event.currentTarget.files?.[0]); event.currentTarget.value = ''; }}/></label>
            </div>
            <div className="grid content-start gap-3 sm:grid-cols-2">
              <label className="text-sm font-bold">নাম<input className={fieldClass} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={100}/></label>
              <label className="text-sm font-bold">পদবী<input className={fieldClass} value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} maxLength={150}/></label>
              <label className="text-sm font-bold">ফোন নম্বর<input className={fieldClass} value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} maxLength={30}/></label>
              <label className="text-sm font-bold">ক্রম<input type="number" className={fieldClass} value={draft.sort_order} onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })}/></label>
              <label className="text-sm font-bold sm:col-span-2">সংক্ষিপ্ত পরিচিতি<textarea className={fieldClass+' min-h-20'} value={draft.bio} onChange={(e) => setDraft({ ...draft, bio: e.target.value })} maxLength={2000}/></label>
              <label className="text-sm font-bold sm:col-span-2">ট্যাগ, কমা দিয়ে আলাদা করুন<input className={fieldClass} value={draft.tags} onChange={(e) => setDraft({ ...draft, tags: e.target.value })} placeholder="ফটোগ্রাফি, ভিডিওগ্রাফি"/></label>
              <label className="flex min-h-11 items-center gap-2 text-sm font-bold sm:col-span-2"><input type="checkbox" checked={draft.is_visible} onChange={(e) => setDraft({ ...draft, is_visible: e.target.checked })} className="h-4 w-4 accent-emerald-800"/>ক্লায়েন্টের About পেজে দেখান</label>
              <fieldset className="rounded-xl border border-stone-200 p-3 sm:col-span-2"><legend className="px-1 text-sm font-bold">এই সদস্যের পোর্টফোলিও কাজ</legend><p className="mb-2 text-xs text-stone-500">ক্লায়েন্ট ওই সদস্যের নাম চাপলে এই কাজগুলো দেখতে পারবেন।</p><div className="max-h-52 space-y-2 overflow-y-auto">{snapshot.posts.length ? snapshot.posts.map((post) => <label key={post.id} className="flex cursor-pointer items-start gap-2 rounded-lg bg-stone-50 p-2 text-sm"><input type="checkbox" checked={selectedPosts.includes(post.id)} onChange={(e) => setSelectedPosts((current) => e.target.checked ? [...current, post.id] : current.filter((id) => id !== post.id))} className="mt-1 accent-emerald-800"/><span><strong>{post.title}</strong><small className="ml-2 text-stone-500">{post.event_type}{post.is_published ? '' : ' · Draft'}</small></span></label>) : <p className="text-sm text-stone-500">পোর্টফোলিও পোস্ট পাওয়া যায়নি।</p>}</div></fieldset>
              <div className="flex flex-wrap gap-2 sm:col-span-2"><button type="button" onClick={() => void saveMember()} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#193e32] px-4 text-sm font-bold text-white disabled:opacity-50">{loading?<Loader2 className="h-4 w-4 animate-spin"/>:<Save className="h-4 w-4"/>}সেভ করুন</button><button type="button" onClick={() => setDraft(null)} className="min-h-11 rounded-xl border border-stone-300 px-4 text-sm font-bold">বাতিল</button></div>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {snapshot.members.map((member) => {
          const hidden = !member.is_visible || Boolean(member.deleted_at);
          const workCount = snapshot.work.filter((item) => item.member_id === member.id && item.post_id).length;
          return <article key={member.id} className="flex gap-3 rounded-2xl border border-stone-200 bg-white p-3">
            <div className="h-24 w-20 shrink-0 overflow-hidden rounded-xl bg-stone-100">{member.photo_url && <img src={member.photo_url} alt={member.name} className="h-full w-full object-cover"/>}</div>
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-black">{member.name}</h3><span className={'rounded-full px-2 py-1 text-[10px] font-bold '+(hidden?'bg-stone-100 text-stone-500':'bg-emerald-100 text-emerald-800')}>{hidden?'লুকানো':'প্রকাশিত'}</span></div><p className="mt-1 text-sm text-stone-600">{member.role}</p><p className="mt-1 text-xs text-stone-500">{member.phone || 'ফোন নম্বর নেই'} · {workCount}টি কাজ</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => editMember(member)} className="min-h-9 rounded-lg border border-stone-300 px-3 text-xs font-bold">সম্পাদনা</button><button type="button" onClick={() => void toggleVisibility(member)} disabled={loading || Boolean(member.deleted_at)} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-stone-300 px-3 text-xs font-bold disabled:opacity-50">{hidden?<Eye className="h-3.5 w-3.5"/>:<EyeOff className="h-3.5 w-3.5"/>}{hidden?'প্রকাশ করুন':'লুকান'}</button></div></div>
          </article>;
        })}
      </div>
      {loading && snapshot.members.length === 0 && <div role="status" className="flex items-center justify-center gap-2 py-10 text-sm text-stone-500"><Loader2 className="h-5 w-5 animate-spin"/>তথ্য লোড হচ্ছে…</div>}
    </section>
  );
}
