import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';

type ChatFaq = {
  id: string;
  question: string;
  keywords: string[];
  answer: string;
  is_active: boolean;
  created_at: string;
};

const blankFaq = { question: '', keywords: '', answer: '', is_active: true };

export default function ChatbotAdmin({ token }: { token: string }) {
  const [faqs, setFaqs] = useState<ChatFaq[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [form, setForm] = useState(blankFaq);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setNotice('');
    try {
      const { data, error } = await supabase.rpc('booking_admin_chatbot_config', {
        p_token: token,
        p_action: 'get',
      });
      if (error) throw error;
      setEnabled(data?.auto_reply_enabled !== false);
      setFaqs(Array.isArray(data?.faqs) ? data.faqs : []);
    } catch (error: any) {
      setNotice(error?.message || 'চ্যাটবোর্ডের সেটিংস লোড হয়নি।');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  async function updateAutoReply(next: boolean) {
    setSaving(true);
    setNotice('');
    try {
      const { error } = await supabase.rpc('booking_admin_chatbot_config', {
        p_token: token,
        p_action: 'settings',
        p_auto_reply_enabled: next,
      });
      if (error) throw error;
      setEnabled(next);
      setNotice(next ? 'অটো-রিপ্লাই চালু হয়েছে।' : 'কাস্টম FAQ অটো-রিপ্লাই বন্ধ হয়েছে।');
    } catch (error: any) {
      setNotice(error?.message || 'সেটিংস সংরক্ষণ হয়নি।');
    } finally {
      setSaving(false);
    }
  }

  function startEdit(faq: ChatFaq) {
    setEditingId(faq.id);
    setForm({
      question: faq.question,
      keywords: (faq.keywords || []).join(', '),
      answer: faq.answer,
      is_active: faq.is_active,
    });
    setNotice('');
  }

  function resetForm() {
    setEditingId(null);
    setForm(blankFaq);
  }

  async function saveFaq(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    const keywords = form.keywords.split(',').map(item => item.trim()).filter(Boolean);
    setSaving(true);
    setNotice('');
    try {
      const { error } = await supabase.rpc('booking_admin_chatbot_config', {
        p_token: token,
        p_action: 'save',
        p_id: editingId,
        p_question: form.question.trim(),
        p_keywords: keywords,
        p_answer: form.answer.trim(),
        p_is_active: form.is_active,
      });
      if (error) throw error;
      resetForm();
      setNotice('প্রশ্ন ও উত্তর সংরক্ষণ হয়েছে।');
      await load();
    } catch (error: any) {
      setNotice(error?.message || 'প্রশ্ন ও উত্তর সংরক্ষণ হয়নি।');
    } finally {
      setSaving(false);
    }
  }

  async function toggleFaq(faq: ChatFaq) {
    setSaving(true);
    setNotice('');
    try {
      const { error } = await supabase.rpc('booking_admin_chatbot_config', {
        p_token: token,
        p_action: 'save',
        p_id: faq.id,
        p_question: faq.question,
        p_keywords: faq.keywords || [],
        p_answer: faq.answer,
        p_is_active: !faq.is_active,
      });
      if (error) throw error;
      setNotice(faq.is_active ? 'এই উত্তরটি বন্ধ করা হয়েছে।' : 'এই উত্তরটি চালু করা হয়েছে।');
      await load();
    } catch (error: any) {
      setNotice(error?.message || 'উত্তরের অবস্থা বদলানো যায়নি।');
    } finally {
      setSaving(false);
    }
  }

  async function deleteFaq(faq: ChatFaq) {
    if (saving || !window.confirm('এই প্রশ্ন ও উত্তরটি মুছে ফেলবেন?')) return;
    setSaving(true);
    setNotice('');
    try {
      const { error } = await supabase.rpc('booking_admin_chatbot_config', {
        p_token: token,
        p_action: 'delete',
        p_id: faq.id,
      });
      if (error) throw error;
      if (editingId === faq.id) resetForm();
      setNotice('প্রশ্ন ও উত্তর মুছে ফেলা হয়েছে।');
      await load();
    } catch (error: any) {
      setNotice(error?.message || 'প্রশ্ন ও উত্তর মুছতে পারিনি।');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mx-auto max-w-5xl space-y-5">
      <header className="rounded-2xl bg-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-800">Chatboard</p>
        <h2 className="mt-1 text-2xl font-black">চ্যাটবোর্ড অটো-রিপ্লাই</h2>
        <p className="mt-2 text-sm text-slate-600">প্রশ্নের keyword মিললে বট আপনার লেখা উত্তর দেবে। প্যাকেজের লাইভ দাম ও বুকিংয়ের হিসাব ক্যালকুলেটর থেকেই আসবে।</p>
        <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3">
          <input type="checkbox" checked={enabled} disabled={saving} onChange={event => void updateAutoReply(event.target.checked)} className="h-5 w-5 accent-emerald-700" />
          <span><strong>আমার FAQ-গুলোর অটো-রিপ্লাই চালু</strong><small className="block text-slate-500">বন্ধ করলে এই প্যানেলে যোগ করা উত্তরগুলো ব্যবহার হবে না।</small></span>
        </label>
      </header>

      {notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}

      <form onSubmit={saveFaq} className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
        <h3 className="text-lg font-black">{editingId ? 'প্রশ্ন ও উত্তর সম্পাদনা' : 'নতুন অটো-রিপ্লাই যোগ করুন'}</h3>
        <label className="block text-sm font-bold">গ্রাহক কী প্রশ্ন করতে পারে?
          <input required minLength={3} maxLength={250} value={form.question} onChange={event => setForm(current => ({ ...current, question: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-300 p-3 font-normal" placeholder="যেমন: ছবির ডেলিভারি পেতে কত দিন লাগে?" />
        </label>
        <label className="block text-sm font-bold">মিল খোঁজার keyword, কমা দিয়ে আলাদা করুন
          <input required maxLength={1000} value={form.keywords} onChange={event => setForm(current => ({ ...current, keywords: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-300 p-3 font-normal" placeholder="ডেলিভারি, ছবি কবে পাব, কত দিন" />
        </label>
        <label className="block text-sm font-bold">বটের উত্তর
          <textarea required minLength={1} maxLength={2000} rows={4} value={form.answer} onChange={event => setForm(current => ({ ...current, answer: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-300 p-3 font-normal" placeholder="গ্রাহককে যে উত্তরটি দেখাতে চান সেটি লিখুন" />
        </label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={event => setForm(current => ({ ...current, is_active: event.target.checked }))} className="h-4 w-4 accent-emerald-700" /> এই উত্তরটি চালু থাকবে</label>
        <div className="flex flex-wrap gap-2">
          <button disabled={saving} className="rounded-xl bg-emerald-800 px-5 py-3 font-bold text-white disabled:opacity-50">{saving ? 'সংরক্ষণ হচ্ছে…' : editingId ? 'পরিবর্তন সংরক্ষণ' : 'উত্তর যোগ করুন'}</button>
          {editingId && <button type="button" onClick={resetForm} className="rounded-xl border border-slate-300 px-5 py-3 font-bold">বাতিল</button>}
        </div>
      </form>

      <section className="space-y-3">
        <div className="flex items-center justify-between"><h3 className="text-lg font-black">সেট করা প্রশ্ন ও উত্তর</h3><button type="button" onClick={() => void load()} disabled={loading || saving} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold">Refresh</button></div>
        {loading ? <p className="rounded-xl bg-white p-5 text-slate-600">লোড হচ্ছে…</p> : faqs.length === 0 ? <p className="rounded-xl bg-white p-5 text-slate-600">এখনো কোনো FAQ যোগ হয়নি। উপরের ফর্মে প্রশ্ন, keyword ও উত্তর লিখুন।</p> : faqs.map(faq => (
          <article key={faq.id} className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-bold">{faq.question}</p>
                <p className="mt-1 text-xs text-slate-500">Keyword: {(faq.keywords || []).join(', ') || 'নেই'}</p>
                <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{faq.answer}</p>
              </div>
              <span className={faq.is_active ? 'rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-900' : 'rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600'}>{faq.is_active ? 'চালু' : 'বন্ধ'}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={saving} onClick={() => startEdit(faq)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold">সম্পাদনা</button>
              <button type="button" disabled={saving} onClick={() => void toggleFaq(faq)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold">{faq.is_active ? 'বন্ধ করুন' : 'চালু করুন'}</button>
              <button type="button" disabled={saving} onClick={() => void deleteFaq(faq)} className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-bold text-rose-800">মুছুন</button>
            </div>
          </article>
        ))}
      </section>
    </section>
  );
}
