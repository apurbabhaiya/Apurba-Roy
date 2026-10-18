import React, { useState } from 'react';
import type { DeliveryAdminPortal } from '../services/deliveryPortalService';

export default function DeliveryPaymentShortcut({ portal, onReview }: { portal: DeliveryAdminPortal; onReview: () => void }) {
  const [feedback, setFeedback] = useState('');
  const due = Math.max(0, Number(portal.remaining_due) || 0);
  const digits = String(portal.whatsapp_number || portal.client_phone || '').replace(/[\s()+-]/g, '');
  const phone = /^01[3-9]\d{8}$/.test(digits) ? `88${digits}` : digits;
  const validPhone = /^[1-9]\d{6,14}$/.test(phone);
  const link = `${window.location.origin}/delivery/${encodeURIComponent(portal.secure_token)}`;
  const amount = new Intl.NumberFormat('bn-BD', { maximumFractionDigits: 2 }).format(due);
  const message = [
    `আসসালামু আলাইকুম ${portal.client_name}।`,
    `RamyaChobi-তে আপনার ${portal.event_name || 'বুকিং'}-এর বাকি টাকা ${amount} টাকা।`,
    'নিচের ব্যক্তিগত লিংক খুলে পেমেন্টের নির্দেশনা দেখুন এবং টাকা পাঠানোর পর লেনদেনের তথ্য জমা দিন।',
    link,
    'পেমেন্ট যাচাই ও ডাউনলোডের অনুমতি চালু হলে ছবি ও ভিডিও ডাউনলোড করতে পারবেন।',
    'আগে টাকা দিয়ে থাকলে লেনদেনের তথ্য জানাবেন। ধন্যবাদ।',
  ].join('\n\n');
  async function copy() {
    try { await navigator.clipboard.writeText(message); setFeedback('মেসেজ কপি হয়েছে।'); }
    catch { setFeedback('কপি হয়নি। নিচের মেসেজ সিলেক্ট করে কপি করুন।'); }
  }
  return <section className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4" aria-label="বকেয়া আদায়ের শর্টকাট">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="font-bold">বকেয়া আদায়</h3><p className="mt-1 text-sm">{due > 0 ? `বাকি ${amount} টাকা` : 'বকেয়া নেই'} · টাকা জমা হলে আগে যাচাই করুন।</p></div>
      <button type="button" onClick={onReview} className="rounded-xl border border-emerald-300 bg-white px-4 py-2.5 text-sm font-bold">টাকা জমা / যাচাই</button>
    </div>
    {due > 0 && (portal.is_published ? <details className="mt-3">
      <summary className="w-fit cursor-pointer rounded-xl bg-emerald-800 px-4 py-3 text-sm font-bold text-white">বকেয়া চাওয়ার মেসেজ</summary>
      <label className="mt-3 block text-sm font-semibold">পাঠানোর আগে মেসেজ দেখুন<textarea readOnly value={message} rows={8} className="mt-2 w-full rounded-xl border border-emerald-200 bg-white p-3 text-sm font-normal leading-6" /></label>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => void copy()} className="rounded-xl bg-stone-950 px-4 py-2.5 text-sm font-bold text-white">মেসেজ কপি</button>
        {validPhone ? <a href={`https://wa.me/${phone}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer" className="rounded-xl bg-green-700 px-4 py-2.5 text-sm font-bold text-white">WhatsApp-এ খুলুন</a> : <span className="self-center text-sm text-red-700">সঠিক WhatsApp নম্বর যোগ করুন।</span>}
      </div>
      <p className="mt-2 text-xs text-stone-600">WhatsApp-এ খসড়া খুলবে। পাঠানোর বাটন আপনি চাপবেন।</p>
      <p role="status" className="mt-2 text-sm">{feedback}</p>
    </details> : <p className="mt-3 text-sm text-amber-900">পেমেন্ট লিংক পাঠানোর আগে Publish Delivery চালু করুন।</p>)}
  </section>;
}
