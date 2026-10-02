import React, { useMemo, useState } from 'react';
import { ArrowRight, Check, ChevronDown, Menu, X } from 'lucide-react';

type Category = 'regular' | 'outdoor' | 'sonaton';
type SonatonSide = 'both' | 'bride' | 'groom' | 'wedding';

const packages: Record<Category, Array<{
  tier: string;
  name: string;
  badge?: string;
  coverage: string;
  crew: string[];
  deliverables: string[];
  physical: string[];
}>> = {
  regular: [
    {
      tier: 'Essential',
      name: 'Regular Essential',
      coverage: 'Short event coverage',
      crew: ['1 Photographer', '1 Cinematographer'],
      deliverables: ['Edited usable photographs', '1 highlight/reel', '1 final film'],
      physical: ['Available as add-on'],
    },
    {
      tier: 'Signature',
      name: 'Regular Signature',
      badge: 'Most Popular',
      coverage: 'Extended event coverage',
      crew: ['2 Photographers', '1 Cinematographer'],
      deliverables: ['Edited usable photographs', 'Highlight film', 'Full film', 'Trailer'],
      physical: ['Photobook available as add-on'],
    },
    {
      tier: 'Story',
      name: 'Regular Storytelling',
      coverage: 'Full storytelling coverage',
      crew: ['1 Lead Photographer', '1 Candid Photographer', '2 Cinematographers'],
      deliverables: ['Edited usable photographs', 'Highlight film', 'Full film', 'Trailer'],
      physical: ['Premium album options available'],
    },
  ],
  outdoor: [
    {
      tier: 'Essential',
      name: 'Outdoor Essential',
      coverage: 'Pre-wedding or post-wedding session',
      crew: ['1 Photographer', '1 Cinematographer'],
      deliverables: ['Curated edited photographs', 'Short cinematic reel'],
      physical: ['Digital delivery'],
    },
    {
      tier: 'Cinematic',
      name: 'Outdoor Cinematic',
      badge: 'Most Popular',
      coverage: 'Extended outdoor session',
      crew: ['1 Photographer', '1 Cinematographer', 'Drone when applicable'],
      deliverables: ['Edited photographs', 'Cinematic film', 'Trailer'],
      physical: ['Album available as add-on'],
    },
    {
      tier: 'Signature',
      name: 'Outdoor Signature',
      coverage: 'Premium outdoor storytelling session',
      crew: ['1 Lead Photographer', '1 Candid Photographer', '1 Cinematographer'],
      deliverables: ['Edited photographs', 'Cinematic film', 'Trailer'],
      physical: ['Premium album options available'],
    },
  ],
  sonaton: [
    {
      tier: 'Signature',
      name: 'Sonaton Signature',
      coverage: 'Traditional wedding-event coverage',
      crew: ['Photography team', 'Cinematography team'],
      deliverables: ['Edited photographs', 'Highlight film', 'Full film'],
      physical: ['Album options available'],
    },
    {
      tier: 'Prestige',
      name: 'Sonaton Prestige',
      badge: 'Most Popular',
      coverage: 'Multi-event traditional wedding coverage',
      crew: ['Extended photography team', 'Cinematography team', 'Drone when applicable'],
      deliverables: ['Edited photographs', 'Highlight film', 'Full film', 'Trailer'],
      physical: ['Standard album options available'],
    },
    {
      tier: 'Storytelling',
      name: 'Sonaton Storytelling',
      coverage: 'Complete multi-event story coverage',
      crew: ['Lead + candid photographers', 'Multi-camera cinematography team'],
      deliverables: ['Edited photographs', 'Highlight film', 'Full film', 'Trailer'],
      physical: ['Premium album options available'],
    },
  ],
};

const sonatonNotes: Record<SonatonSide, string> = {
  both: 'Coverage for celebrations where both bride and groom sides are part of the complete wedding story.',
  bride: 'Bride-side focused coverage across the selected traditional events.',
  groom: 'Groom-side focused coverage across the selected traditional events.',
  wedding: 'Wedding-day focused coverage centred on the main ceremonial events.',
};

function TopNav() {
  return (
    <nav className="sticky top-0 z-40 border-b border-stone-300 bg-[#f7f3ed]/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8 lg:px-10">
        <a href="/" className="text-lg font-semibold tracking-[0.16em]">RAMYACHOBI</a>
        <div className="hidden items-center gap-6 text-xs font-semibold uppercase tracking-[0.13em] md:flex">
          <a href="/about" className="hover:text-amber-700">About</a>
          <a href="/#portfolio" className="hover:text-amber-700">Gallery</a>
          <a href="/#services" className="hover:text-amber-700">Films</a>
          <a href="/packages" className="border-b border-stone-900 pb-1">Packages</a>
          <a href="/booking" className="rounded-full bg-stone-950 px-4 py-2 text-white">Book Your Date</a>
        </div>
      </div>
    </nav>
  );
}

function PackageCard({ item }: { item: (typeof packages.regular)[number] }) {
  const [open, setOpen] = useState<string | null>('deliverables');

  const rows = [
    ['crew', 'Crew', item.crew],
    ['deliverables', 'Deliverables', item.deliverables],
    ['physical', 'Physical Deliverables', item.physical],
  ] as const;

  return (
    <article className="relative flex min-h-[520px] flex-col border border-stone-300 bg-white p-5">
      {item.badge && (
        <div className="absolute right-0 top-0 bg-amber-800 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
          {item.badge}
        </div>
      )}
      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-800">{item.tier}</div>
      <h3 className="mt-2 text-2xl font-serif">{item.name}</h3>
      <div className="mt-2 text-2xl font-semibold">Contact for pricing</div>
      <div className="mt-5 border-y border-stone-300 py-3">
        <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800">Coverage</div>
        <div className="mt-1 text-sm text-stone-600">{item.coverage}</div>
      </div>

      <div className="mt-3 divide-y divide-stone-200">
        {rows.map(([id, label, values]) => (
          <div key={id}>
            <button
              type="button"
              onClick={() => setOpen(open === id ? null : id)}
              className="flex w-full items-center justify-between py-3 text-left text-sm font-semibold"
            >
              {label}
              <ChevronDown className={`h-4 w-4 transition ${open === id ? 'rotate-180' : ''}`} />
            </button>
            {open === id && (
              <div className="space-y-2 pb-3">
                {values.map((v) => (
                  <div key={v} className="flex gap-2 text-sm text-stone-600">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                    <span>{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <a href="/booking" className="mt-auto flex items-center justify-center gap-2 bg-stone-950 px-4 py-3 text-xs font-bold uppercase tracking-wider text-white">
        Book Your Date <ArrowRight className="h-4 w-4" />
      </a>
    </article>
  );
}

export default function RamyaChobiPackages() {
  const [category, setCategory] = useState<Category>('regular');
  const [sonatonSide, setSonatonSide] = useState<SonatonSide>('both');

  const title = useMemo(() => {
    if (category === 'regular') return 'Regular';
    if (category === 'outdoor') return 'Outdoor';
    return 'Sonaton Collection';
  }, [category]);

  return (
    <div className="min-h-screen bg-[#f7f3ed] text-stone-950">
      <TopNav />

      <main className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-amber-800">RamyaChobi · Packages & Services</div>
          <h1 className="mt-4 font-serif text-4xl leading-tight sm:text-5xl">Wedding Photography & Cinematography Packages</h1>
          <p className="mt-5 text-sm leading-6 text-stone-600">
            Choose the coverage style first, then review the team, deliverables and booking flow. Prices are intentionally left open until RamyaChobi’s final rate card is added.
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-3xl grid-cols-3 border-y border-stone-300">
          {([
            ['regular', 'Regular'],
            ['outdoor', 'Outdoor'],
            ['sonaton', 'Sonaton'],
          ] as Array<[Category, string]>).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setCategory(id)}
              className={`py-3 text-[10px] font-bold uppercase tracking-[0.18em] ${category === id ? 'bg-stone-950 text-white' : 'text-stone-600'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <section className="mt-12">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-stone-300 pb-4">
            <h2 className="font-serif text-3xl">{title}</h2>
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-500">
              Photography & Cinematography
            </div>
          </div>

          {category === 'sonaton' && (
            <>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {([
                  ['both', 'Both Side'],
                  ['bride', 'Bride Side'],
                  ['groom', 'Groom Side'],
                  ['wedding', 'Wedding Day'],
                ] as Array<[SonatonSide, string]>).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSonatonSide(id)}
                    className={`border px-4 py-2 text-[10px] font-bold uppercase tracking-wider ${sonatonSide === id ? 'border-stone-950 bg-stone-950 text-white' : 'border-stone-400 bg-transparent'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="mx-auto mt-5 max-w-2xl text-center text-sm text-stone-500">{sonatonNotes[sonatonSide]}</p>
            </>
          )}

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {packages[category].map((item) => <PackageCard key={item.name} item={item} />)}
          </div>
        </section>

        <section className="mx-auto mt-16 max-w-4xl">
          <div className="flex items-end justify-between border-b border-stone-300 pb-3">
            <h2 className="font-serif text-3xl">FAQ</h2>
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Questions & Answers</span>
          </div>
          {[
            ['How do I book my wedding date?', 'Choose a suitable package, open the booking form and submit your event details. RamyaChobi can then confirm availability and payment terms.'],
            ['Can I check whether my date is available?', 'Submit the booking form with your preferred event date. Availability must be confirmed before the booking is treated as final.'],
            ['Can I book multiple events?', 'Yes. The booking system supports multiple event entries under the same client booking.'],
            ['When is Final Delivery available?', 'Final Delivery is activated after full package payment is verified, according to the RamyaChobi delivery policy.'],
          ].map(([q, a]) => (
            <details key={q} className="border-b border-stone-300 py-4">
              <summary className="cursor-pointer list-none text-sm font-medium">{q}<span className="float-right">+</span></summary>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-600">{a}</p>
            </details>
          ))}
        </section>
      </main>
    </div>
  );
}
