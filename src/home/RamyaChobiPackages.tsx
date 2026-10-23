import {useCustomConfig} from '../booking/CustomPackages';
import React, { useMemo, useState } from 'react';
import { ArrowRight, Check, ChevronDown, Sparkles } from 'lucide-react';

import {regularPackages,outdoorPackages,sonatonPackages,packageId,type Category,type SonatonSide,type PackageItem} from '../booking/packageCatalog';

const sonatonNotes: Record<SonatonSide, string> = {
  both: 'Complete storytelling for celebrations where both bride and groom sides are covered as one connected wedding story.',
  bride: 'Bride-side focused coverage from Holud through the key wedding rituals and family moments.',
  groom: 'Groom-side focused coverage including family rituals, wedding events and reception moments.',
  wedding: 'Focused wedding-day collections built around the main ceremonial events and rituals.',
};

function formatPrice(price: number) {
  return `৳ ${price.toLocaleString('en-US')}`;
}

function TopNav() {
  return (
    <nav className="sticky top-0 z-40 border-b border-[#d9c9bd] bg-[#fbf7f3]/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8 lg:px-10">
        <a href="/" className="text-lg font-semibold tracking-[0.16em] text-[#241a18]">RAMYACHOBI</a>
        <div className="hidden items-center gap-6 text-xs font-semibold uppercase tracking-[0.13em] md:flex">
          <a href="/about" className="transition hover:text-[#7b3f4a]">About</a>
          <a href="/portfolio" className="transition hover:text-[#7b3f4a]">Gallery</a>
          <a href="/#services" className="transition hover:text-[#7b3f4a]">Films</a>
          <a href="/packages" className="border-b border-[#7b3f4a] pb-1 text-[#7b3f4a]">Packages</a>
          <a href="/booking" className="rounded-full bg-[#2b1f1d] px-4 py-2 text-white transition hover:bg-[#7b3f4a]">Book Your Date</a>
        </div>
      </div>
    </nav>
  );
}

function PackageCard({ item, selected, onSelect }: { item: PackageItem; selected: boolean; onSelect:()=>void }) {
  const [open, setOpen] = useState<string | null>('deliverables');

  const rows = [
    ['crew', 'Crew', item.crew],
    ['deliverables', 'Deliverables', item.deliverables],
    ['physical', 'Physical Deliverables', item.physical],
  ] as const;

  return (
    <article role="group" aria-label={item.name} tabIndex={0} onKeyDown={e=>{if(e.target===e.currentTarget&&(e.key==='Enter'||e.key===' ')){e.preventDefault();onSelect()}}} onClick={e=>{if(!(e.target as HTMLElement).closest('a,button,summary'))onSelect()}} className={"relative flex min-h-[560px] flex-col overflow-hidden rounded-[1.75rem] border border-[#dfd1c7] bg-white p-6 shadow-[0_18px_60px_rgba(56,36,31,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(56,36,31,0.13)]"+(selected?" ring-2 ring-emerald-600":"")}>
      <label className="mb-4 flex cursor-pointer items-center gap-2 text-sm font-bold text-emerald-800"><input type="radio" name="website-package" checked={selected} onChange={onSelect}/>{selected?'✓ নির্বাচিত':'এই প্যাকেজ নির্বাচন করুন'}</label>
      {item.badge && (
        <div className="absolute right-4 top-4 rounded-full bg-[#7b3f4a] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white">
          {item.badge}
        </div>
      )}

      <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#a06d43]">{item.tier}</div>
      <h3 className="mt-3 pr-20 font-serif text-2xl leading-tight text-[#241a18]">{item.name}</h3>
      <div className="mt-4 text-3xl font-semibold tracking-tight text-[#7b3f4a]">{formatPrice(item.price)}</div>

      <div className="mt-6 rounded-2xl bg-[#f7f0ea] p-4">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#a06d43]">Coverage</div>
        <div className="mt-1.5 text-sm leading-6 text-[#5e504b]">{item.coverage}</div>
      </div>

      <div className="mt-4 divide-y divide-[#eadfd7]">
        {rows.map(([id, label, values]) => (
          <div key={id}>
            <button
              type="button"
              onClick={() => setOpen(open === id ? null : id)}
              className="flex w-full items-center justify-between py-3.5 text-left text-sm font-semibold text-[#302421]"
            >
              {label}
              <ChevronDown className={`h-4 w-4 transition ${open === id ? 'rotate-180' : ''}`} />
            </button>
            {open === id && (
              <div className="space-y-2.5 pb-4">
                {values.map((value) => (
                  <div key={value} className="flex gap-2.5 text-sm leading-5 text-[#6b5b55]">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#a06d43]" />
                    <span>{value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <a
        href={'/booking?package='+encodeURIComponent(packageId(item.name))}
        className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#2b1f1d] px-4 py-3.5 text-xs font-bold uppercase tracking-[0.14em] text-white transition hover:bg-[#7b3f4a]"
      >
        এই প্যাকেজে বুকিং করুন <ArrowRight className="h-4 w-4" />
      </a>
    </article>
  );
}

export default function RamyaChobiPackages() {
  const {config}=useCustomConfig();
  const [selectedPackage,setSelectedPackage]=useState('');
  const [category, setCategory] = useState<Category>('regular');
  const [sonatonSide, setSonatonSide] = useState<SonatonSide>('both');

  const currentPackages = useMemo<PackageItem[]>(() => {
    if (category === 'regular') return regularPackages;
    if (category === 'outdoor') return outdoorPackages;
    return sonatonPackages[sonatonSide];
  }, [category, sonatonSide]);

  const title = useMemo(() => {
    if (category === 'regular') return 'Regular Collections';
    if (category === 'outdoor') return 'Outdoor Collections';
    return 'Sonaton Collection';
  }, [category]);

  return (
    <div className="min-h-screen bg-[#fbf7f3] text-[#241a18]">
      <TopNav />

      <main>
        <section className="relative overflow-hidden border-b border-[#e3d7cf] bg-[radial-gradient(circle_at_top_left,_#f2dfd6,_transparent_42%),linear-gradient(135deg,#fbf7f3_0%,#f6eee8_100%)]">
          <div className="mx-auto max-w-6xl px-5 py-16 text-center sm:px-8 sm:py-20 lg:px-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#d8bca9] bg-white/70 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[#7b3f4a]">
              <Sparkles className="h-4 w-4" /> RamyaChobi Packages 2026
            </div>
            <h1 className="mx-auto mt-6 max-w-4xl font-serif text-4xl leading-tight sm:text-5xl lg:text-6xl">
              Wedding Photography & Cinematography Packages
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-[#6a5952] sm:text-base">
              Choose the collection that fits your event, team requirement and storytelling style. Every package can be discussed before final booking confirmation.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-12 sm:px-8 lg:px-10">
          {config?.mini_enabled && <a href="/booking/city" className="mb-8 block rounded-3xl border-2 border-emerald-600 bg-emerald-50 p-6 text-emerald-950"><span className="text-xs font-bold">ছোট শুটের সহজ বুকিং</span><h2 className="mt-2 text-2xl font-black">সিটি ফটোশুট · ঘণ্টায় {formatPrice(config.mini_price)} থেকে</h2><p className="mt-2 text-sm">একক, কাপল বা পরিবার · ঢাকা ঘণ্টায় ৳{config.mini_city_rates?.['ঢাকা']?.hourly_rate??2000}, ট্রাভেল ৳{config.mini_city_rates?.['ঢাকা']?.travel??500} / দিন · অন্য শহরে ট্রাভেল ৳২০০ থেকে · পুরো টাকা অগ্রিম</p><span className="mt-3 inline-block font-bold">✓ এই ছোট প্যাকেজটি নিন →</span></a>}
          <p className="mb-4 text-center text-sm font-semibold">প্যাকেজের গোল ঘরে টিক দিন। নির্বাচিত প্যাকেজে সবুজ বর্ডার ও ✓ চিহ্ন দেখাবে।</p>
          <div className="mx-auto grid max-w-2xl grid-cols-3 rounded-2xl border border-[#ddcfc5] bg-white p-1.5 shadow-sm">
            {([
              ['regular', 'Regular'],
              ['outdoor', 'Outdoor'],
              ['sonaton', 'Sonaton'],
            ] as Array<[Category, string]>).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => {setCategory(id);setSelectedPackage('')}}
                className={`rounded-xl px-3 py-3 text-xs font-bold uppercase tracking-[0.14em] transition ${category === id ? 'bg-[#7b3f4a] text-white shadow-sm' : 'text-[#74635c] hover:bg-[#f7f0ea]'}`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-12 flex flex-wrap items-end justify-between gap-4 border-b border-[#ddcfc5] pb-5">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a06d43]">Photography + Cinematography</div>
              <h2 className="mt-2 font-serif text-3xl sm:text-4xl">{title}</h2>
            </div>
            <div className="rounded-full bg-[#f2e5dd] px-4 py-2 text-xs font-semibold text-[#7b3f4a]">
              Transparent package pricing
            </div>
          </div>

          {category === 'sonaton' && (
            <div className="mt-7">
              <div className="flex flex-wrap justify-center gap-2.5">
                {([
                  ['both', 'Both Side'],
                  ['bride', 'Bride Side'],
                  ['groom', 'Groom Side'],
                  ['wedding', 'Wedding Day'],
                ] as Array<[SonatonSide, string]>).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {setSonatonSide(id);setSelectedPackage('')}}
                    className={`rounded-full border px-4 py-2.5 text-xs font-bold transition ${sonatonSide === id ? 'border-[#2b1f1d] bg-[#2b1f1d] text-white' : 'border-[#d8c8bd] bg-white text-[#6d5a53] hover:border-[#7b3f4a]'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="mx-auto mt-5 max-w-3xl text-center text-sm leading-6 text-[#74635c]">{sonatonNotes[sonatonSide]}</p>
            </div>
          )}

          <div className="mt-9 grid gap-5 md:grid-cols-3">
            {currentPackages.map((item) => <PackageCard key={item.name} item={item} selected={selectedPackage===packageId(item.name)} onSelect={()=>setSelectedPackage(packageId(item.name))} />)}
          </div>

          {selectedPackage && <div className="sticky bottom-3 z-30 mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-300 bg-white p-4 shadow-xl"><p className="text-sm font-bold">✓ নির্বাচিত: {currentPackages.find(p=>packageId(p.name)===selectedPackage)?.name}</p><a href={'/booking?package='+encodeURIComponent(selectedPackage)} className="rounded-xl bg-emerald-800 px-5 py-3 font-bold text-white">এই প্যাকেজে বুকিং করুন →</a></div>}
          <section className="mx-auto mt-20 max-w-4xl">
            <div className="flex items-end justify-between border-b border-[#ddcfc5] pb-4">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a06d43]">Need to know</div>
                <h2 className="mt-1 font-serif text-3xl">Frequently Asked Questions</h2>
              </div>
              <span className="hidden text-[10px] font-bold uppercase tracking-wider text-[#8a766d] sm:block">Questions & Answers</span>
            </div>

            {[
              ['How do I book my wedding date?', 'Choose a suitable package, open the booking form and submit your event details. RamyaChobi will confirm availability and the payment terms before the booking is final.'],
              ['Can I check whether my date is available?', 'Yes. Submit the booking form with your preferred date and event details. Availability must be confirmed by RamyaChobi.'],
              ['Can I book multiple events under one booking?', 'Yes. The booking flow supports multiple events and can keep them under one client booking.'],
              ['Can I customize a package?', 'You can discuss coverage, crew, albums and additional requirements before the booking is confirmed.'],
              ['When is Final Delivery available?', 'Final Delivery becomes available after the full package payment has been verified, according to the RamyaChobi delivery policy.'],
            ].map(([question, answer]) => (
              <details key={question} className="group border-b border-[#e4d9d1] py-5">
                <summary className="cursor-pointer list-none text-sm font-semibold text-[#312522]">
                  {question}
                  <span className="float-right text-[#7b3f4a] transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-[#74635c]">{answer}</p>
              </details>
            ))}
          </section>

          <section className="mt-16 rounded-[2rem] bg-[#2b1f1d] px-6 py-10 text-center text-white sm:px-10">
            <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#e6bd96]">Your story starts here</div>
            <h2 className="mx-auto mt-3 max-w-2xl font-serif text-3xl sm:text-4xl">Choose your collection, then reserve your date.</h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-white/65">
              Send your event details through the booking form and RamyaChobi will confirm availability before finalizing your package.
            </p>
            <a href="/booking" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#e7c19c] px-5 py-3 font-bold text-[#2b1f1d] transition hover:bg-white">
              Book Your Date <ArrowRight className="h-4 w-4" />
            </a>
          </section>
        </section>
      </main>
    </div>
  );
}
