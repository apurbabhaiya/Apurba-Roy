import React, { useEffect, useState } from 'react';
import { ArrowRight, BookOpenCheck, Camera, Film, Heart, Loader2, Phone, ShieldCheck } from 'lucide-react';
import ClientPageShell, { clientFocus } from './ClientPageShell';
import { getPublicTeamMembers, type WebsiteTeamMember } from '../services/websiteTeamService';

export default function RamyaChobiAbout() {
  const [team, setTeam] = useState<WebsiteTeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    getPublicTeamMembers()
      .then((members) => { if (live) setTeam(members); })
      .catch(() => { if (live) setError('টিমের তথ্য এখন লোড করা যাচ্ছে না। পরে আবার চেষ্টা করুন।'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  return (
    <ClientPageShell current="about">
      <main id="page-content">
        <section className="mx-auto grid max-w-6xl gap-5 px-4 py-7 sm:px-6 md:grid-cols-[1.1fr_.9fr] md:items-center md:gap-10 md:py-12">
          <div>
            <p className="text-[11px] font-semibold tracking-[.16em] text-[#8a6740]">ABOUT RAMYACHOBI</p>
            <h1 className="mt-2 text-3xl font-bold leading-[1.4] sm:text-5xl">ছবির পেছনে মানুষ,<br/><span className="font-normal text-[#8a6740]">স্মৃতির পাশে রম্যছবি।</span></h1>
            <p className="mt-4 max-w-xl text-sm leading-7 text-stone-600 sm:text-base">বিয়ে, জন্মদিন বা পরিবারের আয়োজন। আপনার মানুষ, অনুভূতি ও মুহূর্তগুলো ছবি এবং ভিডিওতে ধরে রাখাই আমাদের কাজ।</p>
            <p className="mt-2 max-w-xl text-sm leading-7 text-stone-600">বুকিং থেকে পছন্দের ছবি বাছাই ও ফাইনাল ডেলিভারি পর্যন্ত প্রতিটি ধাপ সহজ করে রাখতে চাই।</p>
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <a href="/portfolio" className={'flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#193e32] px-3 py-3 text-sm font-bold text-white '+clientFocus}>আমাদের কাজ<ArrowRight className="h-4 w-4"/></a>
              <a href="/packages" className={'flex min-h-12 items-center justify-center rounded-xl border border-[#19382e]/25 bg-white px-3 py-3 text-sm font-bold '+clientFocus}>প্যাকেজ দেখুন</a>
            </div>
          </div>
          <aside className="rounded-2xl bg-[#e9eee5] p-5 sm:p-6">
            <Camera className="h-7 w-7 text-emerald-800"/><h2 className="mt-3 text-xl font-bold">কীভাবে কাজ করি?</h2>
            <div className="mt-4 space-y-4">
              {[['১','আপনার প্রয়োজন জানি','অনুষ্ঠান, সময় ও বাজেট মিলিয়ে কথা বলি।'],['২','আয়োজনের গল্প ধরি','ছবি ও ভিডিওতে গুরুত্বপূর্ণ মুহূর্তগুলো রাখি।'],['৩','আপনার ছবি পৌঁছে দিই','গ্যালারি থেকে সিলেকশন ও ফাইনাল ডেলিভারি।']].map(([n,title,text])=><div key={n} className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold">{n}</span><div><h3 className="text-sm font-bold">{title}</h3><p className="mt-1 text-xs leading-6 text-stone-600">{text}</p></div></div>)}
            </div>
          </aside>
        </section>

        <section className="border-y border-[#19382e]/10 bg-white">
          <div className="mx-auto grid max-w-6xl gap-3 px-4 py-7 sm:px-6 md:grid-cols-3">
            {[{icon:Heart,title:'মুহূর্তকে গুরুত্ব',text:'একেকটি আয়োজনের গল্প আলাদা। মানুষ ও অনুভূতিকে প্রাধান্য দিই।'},{icon:BookOpenCheck,title:'খরচ ও শর্ত পরিষ্কার',text:'প্যাকেজ, সময় ও পেমেন্টের শর্ত দেখে বুকিংয়ের আবেদন করতে পারবেন।'},{icon:ShieldCheck,title:'নিজের গ্যালারি',text:'নির্ধারিত অ্যাক্সেসের মাধ্যমে ছবি বাছাই ও ডেলিভারি নেওয়ার সুবিধা।'}].map(({icon:Icon,title,text})=><article key={title} className="flex items-start gap-3 rounded-xl bg-[#f8f6ef] p-4"><Icon className="mt-1 h-5 w-5 shrink-0 text-emerald-800"/><div><h2 className="text-sm font-bold">{title}</h2><p className="mt-1 text-xs leading-6 text-stone-600">{text}</p></div></article>)}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:py-12">
          <p className="text-[11px] font-semibold tracking-[.16em] text-[#8a6740]">OUR TEAM</p>
          <h2 className="mt-1 text-2xl font-bold">ক্যামেরার পেছনের মানুষ</h2>
          <p className="mt-2 max-w-xl text-sm leading-7 text-stone-600">সদস্যের নাম থেকে তাঁর নির্বাচিত কাজগুলো দেখতে পারবেন।</p>
          {loading ? <div role="status" className="flex items-center justify-center gap-2 py-14 text-sm text-stone-500"><Loader2 className="h-5 w-5 animate-spin"/>টিমের তথ্য আসছে…</div>
            : error ? <p role="alert" className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{error}</p>
              : team.length === 0 ? <p className="mt-5 rounded-xl border border-dashed border-stone-300 bg-white p-6 text-sm text-stone-500">টিমের তথ্য শিগগিরই যোগ করা হবে।</p>
                : <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {team.map((member) => <article key={member.id} className="overflow-hidden rounded-2xl border border-[#19382e]/10 bg-white">
                    <div className="aspect-[4/3] overflow-hidden bg-stone-100">{member.photo_url ? <img src={member.photo_url} alt={member.name} loading="lazy" decoding="async" className="h-full w-full object-cover object-top"/> : <div className="flex h-full items-center justify-center"><Camera className="h-8 w-8 text-stone-400"/></div>}</div>
                    <div className="p-4">
                      <h3 className="text-xl font-bold">{member.name}</h3>
                      <p className="mt-1 flex items-start gap-2 text-sm leading-6 text-stone-500"><Film className="mt-1 h-4 w-4 shrink-0 text-emerald-800"/>{member.role}</p>
                      {member.phone && <a href={`tel:${member.phone.replace(/[\s()-]/g, '')}`} className={'mt-3 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-emerald-900 '+clientFocus}><Phone className="h-4 w-4"/>{member.phone}</a>}
                      <a href={`/portfolio?member=${encodeURIComponent(member.id)}`} className={'mt-3 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#193e32] px-3 text-sm font-bold text-white '+clientFocus}>এই সদস্যের কাজ<ArrowRight className="h-4 w-4"/></a>
                    </div>
                  </article>)}
                </div>}
        </section>
      </main>
    </ClientPageShell>
  );
}
