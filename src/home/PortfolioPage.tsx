import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Images, Loader2, X } from 'lucide-react';
import { PortfolioPost, getPublicPortfolioPosts } from '../services/portfolioService';

export default function PortfolioPage({ featuredOnly = true }: { featuredOnly?: boolean }) {
  const [posts, setPosts] = useState<PortfolioPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('All');
  const [selected, setSelected] = useState<PortfolioPost | null>(null);

  useEffect(() => {
    setLoading(true);
    getPublicPortfolioPosts(featuredOnly)
      .then(setPosts)
      .catch((err) => setError(err?.message || 'Could not load portfolio.'))
      .finally(() => setLoading(false));
  }, [featuredOnly]);

  const eventTypes = useMemo(
    () => ['All', ...Array.from(new Set(posts.map((post) => post.event_type).filter(Boolean)))],
    [posts]
  );

  const visible = useMemo(
    () => filter === 'All' ? posts : posts.filter((post) => post.event_type === filter),
    [posts, filter]
  );

  return (
    <div className="min-h-screen bg-[#f7f3ed] text-stone-950">
      <nav className="sticky top-0 z-30 border-b border-stone-300 bg-[#f7f3ed]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8 lg:px-10">
          <a href="/" className="text-lg font-semibold tracking-[0.16em]">RAMYACHOBI</a>
          <div className="hidden items-center gap-6 text-xs font-semibold uppercase tracking-[0.13em] md:flex">
            <a href="/about" className="hover:text-amber-700">About</a>
            <a href="/portfolio" className="border-b border-stone-900 pb-1">Portfolio</a>
            <a href="/packages" className="hover:text-amber-700">Packages</a>
            <a href="/booking" className="rounded-full bg-stone-950 px-4 py-2 text-white">Book Your Date</a>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-3xl text-center">
          <div className="text-xs font-bold uppercase tracking-[0.22em] text-amber-700">
            {featuredOnly ? 'Featured Portfolio' : 'RamyaChobi Stories'}
          </div>
          <h1 className="mt-3 font-serif text-4xl leading-tight sm:text-6xl">
            {featuredOnly ? 'Stories selected for the Portfolio.' : 'Published stories and recent work.'}
          </h1>
          <p className="mt-5 leading-7 text-stone-600">
            {featuredOnly
              ? 'Only work marked Featured by the RamyaChobi admin appears here.'
              : 'Published posts remain available here even when they are not featured in the main Portfolio.'}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            {featuredOnly ? (
              <a href="/stories" className="inline-flex items-center gap-2 border border-stone-300 bg-white px-4 py-2 text-sm font-bold">
                View All Stories <ArrowRight className="h-4 w-4" />
              </a>
            ) : (
              <a href="/portfolio" className="inline-flex items-center gap-2 border border-stone-300 bg-white px-4 py-2 text-sm font-bold">
                Featured Portfolio <ArrowRight className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>

        {eventTypes.length > 1 && (
          <div className="mt-10 flex flex-wrap justify-center gap-2">
            {eventTypes.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setFilter(type)}
                className={`rounded-full px-4 py-2 text-xs font-bold ${filter === type ? 'bg-stone-950 text-white' : 'border border-stone-300 bg-white'}`}
              >
                {type}
              </button>
            ))}
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-amber-700" /></div>
        )}

        {error && <div className="mx-auto mt-10 max-w-2xl rounded-2xl bg-red-50 p-4 text-center text-sm text-red-700">{error}</div>}

        {!loading && !error && visible.length === 0 && (
          <div className="mx-auto mt-12 max-w-2xl rounded-3xl border border-dashed border-stone-300 bg-white p-10 text-center">
            <Images className="mx-auto h-9 w-9 text-stone-400" />
            <h2 className="mt-4 text-xl font-semibold">No portfolio stories published yet.</h2>
            <p className="mt-2 text-sm leading-6 text-stone-500">
              Published {featuredOnly ? 'and Featured ' : ''}posts from the Admin Panel will appear here automatically.
            </p>
          </div>
        )}

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((post, index) => {
            const cover = post.cover_image_url || post.portfolio_media?.[0]?.image_url;
            return (
              <button
                type="button"
                key={post.id}
                onClick={() => setSelected(post)}
                className={`group overflow-hidden rounded-3xl bg-white text-left shadow-sm ring-1 ring-stone-200 ${index === 0 ? 'sm:col-span-2 lg:col-span-2' : ''}`}
              >
                <div className={index === 0 ? 'aspect-[16/8]' : 'aspect-[4/3]'}>
                  {cover ? (
                    <img src={cover} alt={post.title} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-stone-100 text-stone-400"><Images className="h-8 w-8" /></div>
                  )}
                </div>
                <div className="p-5">
                  <div className="text-xs font-bold uppercase tracking-[0.15em] text-amber-700">{post.event_type}</div>
                  <h2 className="mt-2 font-serif text-2xl">{post.title}</h2>
                  {post.story && <p className="mt-2 line-clamp-2 text-sm leading-6 text-stone-500">{post.story}</p>}
                </div>
              </button>
            );
          })}
        </div>
      </main>

      {selected && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-4 sm:p-8">
          <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl bg-[#f7f3ed]">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-300 bg-[#f7f3ed]/95 px-5 py-4 backdrop-blur">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.15em] text-amber-700">{selected.event_type}</div>
                <div className="mt-1 font-serif text-2xl">{selected.title}</div>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="rounded-full bg-stone-950 p-2 text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 sm:p-8">
              {selected.story && <p className="mx-auto max-w-3xl whitespace-pre-line text-center leading-8 text-stone-600">{selected.story}</p>}

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {(selected.portfolio_media || []).map((media) => (
                  <img
                    key={media.id}
                    src={media.image_url}
                    alt={media.alt_text || selected.title}
                    className="w-full rounded-2xl object-cover"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
