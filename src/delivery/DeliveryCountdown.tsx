import React, { useEffect, useState } from 'react';
import { Clock3 } from 'lucide-react';
import { countdownParts } from './countdown';

export default function DeliveryCountdown({ expiresAt, serverOffset = 0 }: { expiresAt?: string | null; serverOffset?: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const update = () => setNow(Date.now());
    const timer = window.setInterval(update, 1000);
    window.addEventListener('focus', update);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', update); };
  }, []);
  const valid = Boolean(expiresAt && Number.isFinite(Date.parse(expiresAt)));
  const ended = valid && Date.parse(expiresAt!) <= now + serverOffset;
  const parts = countdownParts(expiresAt, now + serverOffset);
  return <section aria-label="Access countdown" className="overflow-hidden rounded-3xl border border-emerald-900/10 bg-[#193e32] p-5 text-white shadow-sm sm:p-7">
    <div className="flex items-center gap-2 text-sm font-semibold text-emerald-100"><Clock3 className="h-4 w-4" />ডাউনলোডের বাকি সময় / Time remaining</div>
    <h2 className="mt-2 text-xl font-bold">{!valid ? 'অ্যাক্সেসের সময় এখনও নির্ধারণ করা হয়নি' : ended ? 'ডাউনলোডের মেয়াদ শেষ হয়েছে' : 'আপনার স্মৃতিগুলো নিজের ডিভাইসে সংরক্ষণ করুন'}</h2>
    {valid && <div role="timer" aria-live="off" aria-label="Days hours minutes seconds remaining" className="mt-5 grid max-w-xl grid-cols-4 gap-2 sm:gap-4">{parts.map((value, index) => <div key={index} className="rounded-2xl border border-white/15 bg-white/10 px-1 py-4 text-center"><span className="block font-mono text-3xl font-bold tabular-nums sm:text-4xl">{String(value).padStart(2, '0')}</span><span className="mt-2 block text-xs text-emerald-100">{['দিন / Days', 'ঘণ্টা / Hours', 'মিনিট / Min', 'সেকেন্ড / Sec'][index]}</span></div>)}</div>}
    <p className="mt-4 text-sm leading-6 text-emerald-100">{valid ? `শেষ সময়: ${new Intl.DateTimeFormat('bn-BD', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Dhaka' }).format(new Date(expiresAt!))} (বাংলাদেশ সময়)।` : 'সময় নির্ধারিত হলে এখানে দিন, ঘণ্টা, মিনিট ও সেকেন্ড কমতে থাকবে।'} {ended ? 'নিচের File Recovery অংশ থেকে সাহায্য নিন।' : 'ডাউনলোডের জন্য পেমেন্ট ও ফাইলের অনুমতিও প্রয়োজন।'}</p>
  </section>;
}
