import React, { useState } from 'react';
import { TeamEvent, teamConfirmationMessage, whatsappTeamNumber } from './teamConfirmation';
type Props = { client: string; reference: string; status: string; events: TeamEvent[] };
const field = 'mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm';
export default function TeamConfirmation({client,reference,status,events}: Props) {
  const [eventId,setEventId] = useState(events[0]?.id || '');
  const [name,setName] = useState('');
  const [phone,setPhone] = useState('');
  const [role,setRole] = useState('ফটোগ্রাফার');
  const [reportingTime,setReportingTime] = useState('');
  const [note,setNote] = useState('');
  const [confirmed,setConfirmed] = useState(status === 'confirmed');
  const [feedback,setFeedback] = useState('');
  const event = events.find(e=>e.id===eventId);
  const message = event ? teamConfirmationMessage({name,role,client,reference,event,reportingTime,note}) : '';
  const ready = Boolean(event?.event_date && name.trim() && role.trim() && confirmed);
  const recipient = whatsappTeamNumber(phone);
  async function copyMessage() {
    if (!ready) return;
    try { await navigator.clipboard.writeText(message); setFeedback('মেসেজ কপি হয়েছে। Facebook/Messenger বা SMS-এ পেস্ট করে পাঠান।'); }
    catch { setFeedback('কপি করা যায়নি। নিচের মেসেজ সিলেক্ট করে কপি করুন।'); }
  }
  if (!events.length) return <section className="rounded-3xl bg-white p-5 shadow-sm"><h3 className="font-bold">টিম কনফার্মেশন</h3><p className="mt-3 text-sm text-slate-600">এই বুকিংয়ে অনুষ্ঠানের তথ্য নেই। তারিখ ও লোকেশন যোগ করার পরে মেসেজ তৈরি করুন।</p></section>;
  return <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
    <h3 className="text-lg font-black">টিম সদস্যকে কাজ জানান</h3><p className="mt-2 text-sm text-slate-500">সদস্যের নাম লিখুন, অনুষ্ঠান বাছুন, তারপর মেসেজ কপি করুন। একজনের জন্য একটি মেসেজ তৈরি হবে।</p>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-semibold">সদস্যের নাম *<input value={name} onChange={e=>{setName(e.target.value);setFeedback('');}} placeholder="যেমন: রাহুল" className={field}/></label>
      <label className="text-sm font-semibold">দায়িত্ব *<input value={role} onChange={e=>setRole(e.target.value)} placeholder="ফটোগ্রাফার / ভিডিওগ্রাফার" className={field}/></label>
      <label className="text-sm font-semibold sm:col-span-2">অনুষ্ঠান<select value={eventId} onChange={e=>setEventId(e.target.value)} className={field}>{events.map(e=><option key={e.id} value={e.id}>{e.event_name} · {e.event_date}</option>)}</select></label>
      <label className="text-sm font-semibold">রিপোর্টিং সময়<input type="time" value={reportingTime} onChange={e=>setReportingTime(e.target.value)} className={field}/></label>
      <label className="text-sm font-semibold">সদস্যের WhatsApp নম্বর<input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="01XXXXXXXXX / country code" className={field}/></label>
      <label className="text-sm font-semibold sm:col-span-2">সঙ্গে কী আনতে হবে / নির্দেশনা<textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="যেমন: ক্যামেরা, ফ্ল্যাশ ও অতিরিক্ত ব্যাটারি আনবেন।" className={field} rows={2}/></label>
    </div>
    <label className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm font-semibold"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} className="mt-1"/>ক্লায়েন্টের সঙ্গে কাজটি কনফার্ম হয়েছে।</label>
    {!event?.event_date && <p className="mt-3 text-sm text-red-700">অনুষ্ঠানের তারিখ নেই। আগে বুকিংয়ের তারিখ ঠিক করুন।</p>}
    <label className="mt-5 block text-sm font-bold">মেসেজ প্রিভিউ<textarea readOnly value={message} rows={15} className={field + ' leading-6 bg-slate-50'} /></label>
    <div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={!ready} onClick={copyMessage} className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-40">মেসেজ কপি করুন</button>
    {ready && recipient ? <a href={`https://wa.me/${recipient}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer" className="rounded-xl bg-green-700 px-4 py-3 text-sm font-bold text-white">WhatsApp-এ খুলুন</a> : <button type="button" disabled className="rounded-xl bg-green-700 px-4 py-3 text-sm font-bold text-white opacity-40">WhatsApp-এ খুলুন</button>}</div>
    {phone && !recipient && <p className="mt-2 text-xs text-red-700">সঠিক নম্বর লিখুন। বিদেশি নম্বরে country code দিন।</p>}
    <p role="status" className="mt-3 text-sm text-emerald-700">{feedback}</p>
    <p className="mt-3 text-xs leading-5 text-slate-500">WhatsApp-এ মেসেজ খুলবে; পাঠানোর বাটন আপনি চাপবেন। Facebook/Messenger বা SMS-এর জন্য কপি করে পেস্ট করুন। এই ফর্মের সদস্যতথ্য সংরক্ষিত হয় না এবং পাঠানো বা উপস্থিতির অবস্থা ট্র্যাক করে না।</p>
  </section>;
}
