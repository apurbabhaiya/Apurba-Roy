import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, Loader2, Send, TicketCheck } from 'lucide-react';
import { spinPrizes, submitSpinResult } from '../services/spinResultService';

const fieldClass = 'mt-1 min-h-12 w-full min-w-0 rounded-xl border border-stone-300 bg-white px-3 py-3 text-base text-[#19382e] outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15';

export default function SpinResultSubmission() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [result, setResult] = useState('');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await submitSpinResult({ customerName: name.trim(), phone: phone.trim(), address: address.trim(), spinResult: result, campaignLink: link.trim() });
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.message || 'ফলাফল জমা হয়নি। আবার চেষ্টা করুন।');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main lang="bn" className="min-h-screen bg-[#f8f6ef] px-4 pb-24 pt-6 text-[#19382e] sm:px-6 sm:pt-10">
      <div className="mx-auto max-w-xl">
        <a href="/" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-emerald-900"><ArrowLeft className="h-4 w-4"/>হোম পেজে ফিরুন</a>
        <section className="mt-4 rounded-3xl border border-[#19382e]/10 bg-white p-5 shadow-sm sm:p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#193e32] text-[#efe4b8]"><TicketCheck className="h-6 w-6"/></div>
          {submitted ? (
            <div className="pt-5" role="status">
              <CheckCircle2 className="h-8 w-8 text-emerald-700"/>
              <h1 className="mt-3 text-2xl font-black">ফলাফল জমা হয়েছে</h1>
              <p className="mt-2 text-sm leading-7 text-stone-600">আপনার স্পিনের ফলাফল ও যোগাযোগের তথ্য অ্যাডমিন প্যানেলে পাঠানো হয়েছে। যাচাইয়ের পর টিম আপনার সঙ্গে যোগাযোগ করবে।</p>
              <a href="/" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-[#193e32] px-4 py-2 text-sm font-bold text-white">হোম পেজে ফিরুন</a>
            </div>
          ) : (
            <>
              <p className="mt-5 text-xs font-bold uppercase tracking-[.16em] text-[#8a6740]">RamyaChobi · Spin & Win</p>
              <h1 className="mt-2 text-2xl font-black sm:text-3xl">স্পিনের ফলাফল জমা দিন</h1>
              <p className="mt-2 text-sm leading-7 text-stone-600">স্পিনে পাওয়া ফলাফল, নাম, মোবাইল নম্বর ও ঠিকানা পাঠান। অ্যাডমিন যাচাই করে আপনার সঙ্গে যোগাযোগ করবে।</p>
              <form onSubmit={(event) => void onSubmit(event)} className="mt-6 grid gap-4">
                <label className="text-sm font-bold">আপনার নাম<input required autoComplete="name" maxLength={120} className={fieldClass} value={name} onChange={(e) => setName(e.target.value)}/></label>
                <label className="text-sm font-bold">মোবাইল নম্বর<input required type="tel" inputMode="tel" autoComplete="tel" maxLength={30} className={fieldClass} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01XXXXXXXXX"/></label>
                <label className="text-sm font-bold">ঠিকানা<textarea required autoComplete="street-address" maxLength={500} rows={3} className={fieldClass+' min-h-24 resize-y'} value={address} onChange={(e) => setAddress(e.target.value)}/></label>
                <label className="text-sm font-bold">স্পিনে পাওয়া ফলাফল<select required className={fieldClass} value={result} onChange={(e) => setResult(e.target.value)}><option value="">ফলাফল নির্বাচন করুন</option>{spinPrizes.map(prize => <option key={prize} value={prize}>{prize}</option>)}</select></label>
                <label className="text-sm font-bold">স্পিন / পোস্টের লিংক <span className="font-normal text-stone-500">(ঐচ্ছিক)</span><input type="url" maxLength={500} className={fieldClass} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..."/></label>
                {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</p>}
                <button type="submit" disabled={busy} className="mt-1 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#193e32] px-4 py-3 text-sm font-bold text-white disabled:opacity-60">{busy?<Loader2 className="h-4 w-4 animate-spin"/>:<Send className="h-4 w-4"/>}{busy?'জমা হচ্ছে…':'ফলাফল জমা দিন'}</button>
              </form>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
