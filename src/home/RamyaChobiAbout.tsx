import React from 'react';
import { ArrowRight, Camera, Film, ShieldCheck } from 'lucide-react';

function TopNav() {
  return (
    <nav className="sticky top-0 z-40 border-b border-stone-300 bg-[#f7f3ed]/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8 lg:px-10">
        <a href="/" className="text-lg font-semibold tracking-[0.16em]">RAMYACHOBI</a>
        <div className="hidden items-center gap-6 text-xs font-semibold uppercase tracking-[0.13em] md:flex">
          <a href="/about" className="border-b border-stone-900 pb-1">About</a>
          <a href="/#portfolio" className="hover:text-amber-700">Gallery</a>
          <a href="/#services" className="hover:text-amber-700">Films</a>
          <a href="/packages" className="hover:text-amber-700">Packages</a>
          <a href="/booking" className="rounded-full bg-stone-950 px-4 py-2 text-white">Book Your Date</a>
        </div>
      </div>
    </nav>
  );
}

const team = [
  {
    name: 'Apurba Roy',
    role: 'Founder, Lead Photographer',
    image: 'https://i.postimg.cc/3w2dXrtr/Apurba-Roy-CEO-Core-Photographer.jpg',
    icon: Camera,
  },
  {
    name: 'Maya Chaudhary',
    role: 'Core Cinematographer',
    image: 'https://i.postimg.cc/C1N52PT8/Maya-Chowdhury-Niyaz-Core-CInematographer.jpg',
    icon: Film,
  },
];

export default function RamyaChobiAbout() {
  return (
    <div className="min-h-screen bg-[#f7f3ed] text-stone-950">
      <TopNav />

      <main>
        <section className="mx-auto max-w-6xl px-5 py-20 text-center sm:px-8 lg:px-10">
          <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-amber-800">About RamyaChobi</div>
          <h1 className="mx-auto mt-4 max-w-4xl font-serif text-4xl leading-tight sm:text-6xl">Photography is the craft. Trust is the service.</h1>
          <p className="mx-auto mt-6 max-w-2xl leading-7 text-stone-600">
            RamyaChobi combines photography, cinematography and a structured digital client workflow so that booking, photo selection, payment and final delivery remain clear from beginning to end.
          </p>
        </section>

        <section className="border-y border-stone-300 bg-white">
          <div className="mx-auto grid max-w-6xl gap-8 px-5 py-16 sm:px-8 md:grid-cols-3 lg:px-10">
            {[
              ['Story First', 'We focus on meaningful moments, people and relationships rather than treating every event like the same template.'],
              ['Clear Process', 'Clients can see booking information, select photographs and use a defined final-delivery workflow.'],
              ['Private Delivery', 'The delivery system separates previews, verified payment, gallery access and retention rules.'],
            ].map(([title, text]) => (
              <div key={title}>
                <ShieldCheck className="h-6 w-6 text-amber-700" />
                <h2 className="mt-4 font-serif text-2xl">{title}</h2>
                <p className="mt-3 text-sm leading-6 text-stone-600">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:px-10">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-stone-300 pb-4">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-amber-800">The Team</div>
              <h2 className="mt-2 font-serif text-4xl">People behind RamyaChobi</h2>
            </div>
            <div className="text-xs text-stone-500">Photography · Cinematography · Client Experience</div>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {team.map((person) => {
              const Icon = person.icon;
              return (
                <article key={person.name} className="overflow-hidden border border-stone-300 bg-white">
                  <div className="aspect-[4/3] overflow-hidden bg-stone-200">
                    <img src={person.image} alt={person.name} className="h-full w-full object-cover" />
                  </div>
                  <div className="p-6">
                    <Icon className="h-5 w-5 text-amber-700" />
                    <h3 className="mt-3 font-serif text-3xl">{person.name}</h3>
                    <p className="mt-1 text-sm font-semibold uppercase tracking-[0.12em] text-stone-500">{person.role}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="bg-stone-950 text-white">
          <div className="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-16 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-10">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-amber-300">Your story starts here</div>
              <h2 className="mt-2 max-w-2xl font-serif text-4xl">A meaningful day deserves a thoughtful process.</h2>
            </div>
            <a href="/booking" className="inline-flex items-center gap-2 bg-amber-300 px-5 py-3 text-sm font-bold text-stone-950">
              Book Your Date <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
