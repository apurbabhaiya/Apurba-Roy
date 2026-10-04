import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronRight,
  Download,
  ExternalLink,
  Film,
  FolderHeart,
  Images,
  KeyRound,
  LayoutDashboard,
  LockKeyhole,
  Menu,
  ShieldCheck,
  Sparkles,
  Star,
  X,
} from 'lucide-react';
import { getPublicPortfolioPosts } from '../services/portfolioService';
import { getApprovedClientReviews, submitClientReview, type ClientReview } from '../services/reviewService';

const portfolio = [
  {
    image: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=85',
    title: 'Wedding Story',
    category: 'Wedding Photography',
    caption: 'A quiet pre-wedding moment framed with timeless simplicity.',
  },
  {
    image: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1200&q=85',
    title: 'Celebration',
    category: 'Event Photography',
    caption: 'Celebration, colour and genuine emotion in one frame.',
  },
  {
    image: 'https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&w=1200&q=85',
    title: 'Portrait Moments',
    category: 'Couple Portraits',
    caption: 'Portraits built around connection rather than forced poses.',
  },
  {
    image: 'https://images.unsplash.com/photo-1507501336603-6e31db2be093?auto=format&fit=crop&w=1200&q=85',
    title: 'Family & Friends',
    category: 'Lifestyle',
    caption: 'Natural moments with the people who make the day memorable.',
  },
  {
    image: 'https://images.unsplash.com/photo-1523438885200-e635ba2c371e?auto=format&fit=crop&w=1200&q=85',
    title: 'Reception Night',
    category: 'Wedding Reception',
    caption: 'Reception stories photographed with warmth and detail.',
  },
  {
    image: 'https://images.unsplash.com/photo-1529636798458-92182e662485?auto=format&fit=crop&w=1200&q=85',
    title: 'Quiet Moments',
    category: 'Candid Photography',
    caption: 'Unscripted moments that keep the feeling of the day alive.',
  },
];

const services = [
  {
    icon: Camera,
    title: 'Photography',
    text: 'Wedding, engagement, birthday, family, corporate and event coverage with a story-first approach.',
  },
  {
    icon: Film,
    title: 'Cinematography',
    text: 'Event films, highlights and cinematic edits delivered through a structured private client workflow.',
  },
  {
    icon: Images,
    title: 'Photo Selection',
    text: 'Clients can review and select photographs online without repeated file sharing or manual lists.',
  },
  {
    icon: FolderHeart,
    title: 'Final Delivery',
    text: 'Private delivery pages with payment verification, gallery access controls and clear retention policy.',
  },
];

const reviewGroups = [
  {
    title: 'Wedding Reviews',
    reviews: [
      {
        avatar: 'https://i.postimg.cc/BnPncZmR/Shuvojit.jpg',
        name: 'Shuvojit & Tisha',
        meta: 'Reception • Dhaka',
        text: 'কোয়ালিটি একদম প্রিমিয়াম। কালার টোন ও সিনেমাটিক ভিডিও অসাধারণ।',
      },
      {
        avatar: 'https://i.postimg.cc/tg0Cr0cv/anika.jpg',
        name: 'Anika & Rafi',
        meta: 'Muslim Wedding • Mymensingh',
        text: 'অনেক সুন্দর কভারেজ হয়েছে। সময়মতো সব ডেলিভারি দিয়েছে।',
      },
    ],
  },
  {
    title: 'Pre-Wedding / Engagement Reviews',
    reviews: [
      {
        avatar: 'https://i.postimg.cc/cLtLM1DG/Puja.jpg',
        name: 'Nazmul & Sumi',
        meta: 'Pre-Wedding • Outdoor',
        text: 'পোজিং গাইড ও লোকেশন সাজেশন খুব ভালো ছিল।',
      },
      {
        avatar: 'https://i.postimg.cc/g09kM975/mou.jpg',
        name: 'Rifat & Nabila',
        meta: 'Engagement • Gauripur',
        text: 'ছবিগুলো এক কথায় অসাধারণ। অল্প সময়ে ডেলিভারি পেয়েছি।',
      },
    ],
  },
];

const menuItems = [
  { label: 'Home', href: '#home', icon: Sparkles, kind: 'section' },
  { label: 'Portfolio', href: '/portfolio', icon: Images, kind: 'section' },
  { label: 'Photo Selection', href: '/photo-selection', icon: Images, kind: 'app' },
  { label: 'Final Delivery', href: '/delivery', icon: Download, kind: 'app' },
  { label: 'Face Search', href: '/face-search', icon: Camera, kind: 'app' },
  { label: 'Client Gallery', href: '/client-gallery', icon: FolderHeart, kind: 'app' },
  { label: 'Packages', href: '/packages', icon: Star, kind: 'section' },
  { label: 'Our Services', href: '#services', icon: Film, kind: 'section' },
  { label: 'About RamyaChobi', href: '/about', icon: BookOpenCheck, kind: 'section' },
  { label: 'Client Reviews', href: '#reviews', icon: Star, kind: 'section' },
  { label: 'Contact / Booking', href: '#contact', icon: CalendarDays, kind: 'section' },
];

function Sidebar({ mobile, onClose }: { mobile?: boolean; onClose?: () => void }) {
  return (
    <aside
      className={
        mobile
          ? 'fixed inset-y-0 right-0 z-50 w-[86vw] max-w-sm overflow-y-auto bg-stone-950 p-5 text-white shadow-2xl'
          : 'fixed right-5 top-1/2 z-40 hidden w-64 -translate-y-1/2 rounded-3xl border border-white/10 bg-stone-950/95 p-4 text-white shadow-2xl backdrop-blur-xl xl:block'
      }
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold tracking-[0.18em]">RAMYACHOBI</div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.24em] text-white/40">Main Menu</div>
        </div>
        {mobile && (
          <button onClick={onClose} className="rounded-xl bg-white/10 p-2" aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="mt-5 space-y-1.5">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <a
              key={item.label}
              href={item.href}
              onClick={onClose}
              className="group flex items-center justify-between rounded-2xl px-3 py-3 transition hover:bg-white/10"
            >
              <span className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/8 text-amber-300">
                  <Icon className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{item.label}</span>
                  <span className="mt-0.5 block text-[10px] uppercase tracking-wider text-white/35">
                    {item.kind === 'admin' ? 'Admin' : item.kind === 'app' ? 'Client Tool' : 'Website'}
                  </span>
                </span>
              </span>
              <ChevronRight className="h-4 w-4 text-white/25 transition group-hover:translate-x-0.5 group-hover:text-amber-300" />
            </a>
          );
        })}
      </div>

      <div className="mt-5 rounded-2xl bg-amber-300 p-4 text-stone-950">
        <div className="text-xs font-bold uppercase tracking-wider">Client workflow</div>
        <div className="mt-1 text-sm font-semibold">Booking → Selection → Payment → Final Delivery</div>
      </div>
    </aside>
  );
}

export default function RamyaChobiHome() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [featuredPortfolio, setFeaturedPortfolio] = useState<typeof portfolio>([]);
  const [showMoreReviews, setShowMoreReviews] = useState(false);
  const [liveReviews, setLiveReviews] = useState<ClientReview[]>([]);
  const [reviewForm, setReviewForm] = useState({ client_name: '', review_text: '', rating: 5, review_type: 'Photography', favorite_photo_name: '', event_name: '' });
  const [reviewNotice, setReviewNotice] = useState('');
  useEffect(() => { getApprovedClientReviews().then(setLiveReviews).catch(() => undefined); }, []);

  useEffect(() => {
    getPublicPortfolioPosts(true)
      .then((posts) => {
        const mapped = posts
          .map((post) => ({
            image: post.cover_image_url || post.portfolio_media?.[0]?.image_url || '',
            title: post.title,
            category: post.event_type,
            caption: post.story || '',
          }))
          .filter((item) => Boolean(item.image));

        if (mapped.length > 0) setFeaturedPortfolio(mapped);
      })
      .catch(() => {
        // Keep the visual fallback until the admin publishes Featured work.
      });
  }, []);

  const displayPortfolio = featuredPortfolio.length > 0 ? featuredPortfolio : portfolio;

  return (
    <div className="min-h-screen bg-[#f5f0e7] text-stone-900">
      <Sidebar />
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 xl:hidden" onClick={() => setMenuOpen(false)} />
          <Sidebar mobile onClose={() => setMenuOpen(false)} />
        </>
      )}

      <button
        onClick={() => setMenuOpen(true)}
        className="fixed right-4 top-4 z-30 flex items-center gap-2 rounded-full bg-stone-950 px-4 py-2.5 text-sm font-bold text-white shadow-lg xl:hidden"
      >
        <Menu className="h-4 w-4" /> Menu
      </button>


      <nav className="absolute inset-x-0 top-0 z-30 border-b border-white/15 bg-black/10 text-white backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8 lg:px-10 xl:pr-80">
          <a href="/" className="text-lg font-semibold tracking-[0.16em]">RAMYACHOBI</a>
          <div className="hidden items-center gap-6 text-xs font-semibold uppercase tracking-[0.13em] md:flex">
            <a href="/about" className="hover:text-amber-300">About</a>
            <a href="/portfolio" className="hover:text-amber-300">Gallery</a>
            <a href="#services" className="hover:text-amber-300">Films</a>
            <a href="/packages" className="hover:text-amber-300">Packages</a>
            <a href="/booking" className="rounded-full bg-white px-4 py-2 text-stone-950">Book Your Date</a>
          </div>
        </div>
      </nav>

      <header id="home" className="relative isolate min-h-[88vh] overflow-hidden bg-stone-950 text-white">
        <img
          src="https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1900&q=90"
          alt="Wedding photography"
          className="absolute inset-0 h-full w-full object-cover opacity-45"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/20" />
        <div className="relative mx-auto flex min-h-[88vh] max-w-7xl items-center px-5 py-24 sm:px-8 lg:px-10 xl:pr-80">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold backdrop-blur">
              <Sparkles className="h-4 w-4 text-amber-300" />
              Photography · Film · Private Client Delivery
            </div>
            <div className="mt-6 text-sm font-semibold uppercase tracking-[0.28em] text-amber-300">RamyaChobi</div>
            <h1 className="mt-3 text-4xl font-semibold leading-tight sm:text-5xl lg:text-7xl">
              Your story deserves more than just photographs.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-white/70 sm:text-lg">
              We create photographs and films that feel personal, then deliver them through a clear, private and professional client experience.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="/portfolio" className="inline-flex items-center gap-2 rounded-xl bg-amber-300 px-5 py-3 font-bold text-stone-950">
                Explore Portfolio <ArrowRight className="h-4 w-4" />
              </a>
              <a href="/booking" className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 py-3 font-bold text-white backdrop-blur">
                Start a Booking <CalendarDays className="h-4 w-4" />
              </a>
            </div>

            <div className="mt-10 grid max-w-2xl gap-3 sm:grid-cols-3">
              {[
                ['Private Galleries', 'Secure client access'],
                ['Clear Delivery', 'Defined workflow & timeline'],
                ['Transparent Access', 'Payment and retention rules'],
              ].map(([title, sub]) => (
                <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                  <CheckCircle2 className="h-5 w-5 text-amber-300" />
                  <div className="mt-2 text-sm font-semibold">{title}</div>
                  <div className="mt-1 text-xs text-white/45">{sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="xl:pr-72">
        <section id="portfolio" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.24em] text-amber-700">Portfolio</div>
              <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">Stories, not just frames.</h2>
              <p className="mt-3 max-w-2xl leading-7 text-stone-600">
                Featured work is controlled from the Admin Panel. Publish a post and mark it Featured to show it here automatically.
              </p>
            </div>
            <a href="/portfolio" className="rounded-2xl bg-stone-950 px-4 py-3 text-sm font-semibold text-white">
              View Full Portfolio
            </a>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {displayPortfolio.map((item, i) => (
              <article key={item.title} className={`group relative overflow-hidden rounded-3xl bg-stone-200 ${i === 0 ? 'sm:col-span-2 lg:col-span-2' : ''}`}>
                <div className={i === 0 ? 'aspect-[16/8]' : 'aspect-[4/3]'}>
                  <img src={item.image} alt={item.title} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                </div>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-5 text-white">
                  <div className="text-xs uppercase tracking-[0.18em] text-white/55">{item.category}</div>
                  <div className="mt-1 text-xl font-semibold">{item.title}</div>
                  {item.caption && (
                    <div className="mt-2 line-clamp-2 max-w-xl text-sm leading-6 text-white/70">{item.caption}</div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="services" className="bg-white">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10">
            <div className="max-w-2xl">
              <div className="text-xs font-bold uppercase tracking-[0.24em] text-amber-700">Services</div>
              <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">One connected client experience.</h2>
              <p className="mt-3 leading-7 text-stone-600">
                From booking to photo selection and final delivery, every stage can live inside one RamyaChobi system.
              </p>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {services.map((service) => {
                const Icon = service.icon;
                return (
                  <div key={service.title} className="rounded-3xl border border-stone-200 bg-[#faf8f4] p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-950 text-amber-300">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="mt-5 text-xl font-semibold">{service.title}</h3>
                    <p className="mt-2 leading-7 text-stone-600">{service.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="trust" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10">
          <div className="grid gap-8 lg:grid-cols-[.9fr_1.1fr]">
            <div className="rounded-3xl bg-stone-950 p-7 text-white sm:p-9">
              <ShieldCheck className="h-10 w-10 text-amber-300" />
              <div className="mt-5 text-xs font-bold uppercase tracking-[0.24em] text-amber-300">Why clients can trust the process</div>
              <h2 className="mt-3 text-3xl font-semibold">Professional service is more than a good camera.</h2>
              <p className="mt-4 leading-7 text-white/65">
                A reliable photography experience needs clear pricing, documented delivery, private galleries and predictable access rules. RamyaChobi’s workflow is built around those basics.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                [LockKeyhole, 'Private client access', 'Client galleries use private links and controlled access instead of openly shared original files.'],
                [BookOpenCheck, 'Clear terms', 'Booking details, payment status, delivery timeline and access policy are visible instead of being handled informally.'],
                [Download, 'Structured final delivery', 'Full payment verification, Final Delivery activation and a defined download period are handled in one flow.'],
                [FolderHeart, 'Retention transparency', 'Gallery access expiry and file retention are treated separately so clients know what happens and when.'],
              ].map(([Icon, title, text]: any) => (
                <div key={title} className="rounded-3xl border border-stone-200 bg-white p-5">
                  <Icon className="h-6 w-6 text-amber-700" />
                  <h3 className="mt-4 font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-stone-500">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#e9dfce]">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10">
            <div className="rounded-[2rem] bg-white p-7 shadow-sm sm:p-10">
              <div className="grid gap-8 lg:grid-cols-[1fr_.8fr] lg:items-center">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.24em] text-amber-700">Client Journey</div>
                  <h2 className="mt-2 text-3xl font-semibold">Simple from first contact to final download.</h2>
                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    {[
                      ['01', 'Booking', 'Client information, event details and package terms.'],
                      ['02', 'Production', 'Photography, video production and editing.'],
                      ['03', 'Photo Selection', 'Private online selection from the prepared gallery.'],
                      ['04', 'Final Delivery', 'Payment verification, gallery access and downloads.'],
                    ].map(([num, title, text]) => (
                      <div key={num} className="rounded-2xl bg-stone-50 p-4">
                        <div className="text-xs font-bold text-amber-700">{num}</div>
                        <div className="mt-1 font-semibold">{title}</div>
                        <div className="mt-1 text-sm leading-6 text-stone-500">{text}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-3xl bg-stone-950 p-6 text-white">
                  <Star className="h-8 w-8 text-amber-300" />
                  <h3 className="mt-4 text-2xl font-semibold">Trust comes from consistency.</h3>
                  <p className="mt-3 leading-7 text-white/65">
                    A client should know what was booked, what has been paid, when files are delivered, how long access remains available and where to go for support.
                  </p>
                  <a href="/booking" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-amber-300 px-4 py-3 font-bold text-stone-950">
                    Begin Your Booking <ArrowRight className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="reviews" className="bg-white">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10">
            <div className="flex flex-wrap items-end justify-between gap-5">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.24em] text-amber-700">Client Reviews</div>
                <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">What our clients say.</h2>
                <p className="mt-3 max-w-2xl leading-7 text-stone-600">
                  Feedback from RamyaChobi wedding, engagement and pre-wedding clients.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-4 py-2 text-sm font-bold text-amber-800">
                <Star className="h-4 w-4 fill-amber-400 text-amber-500" /> 5.0 Client Feedback
              </div>
            </div>

            <div className="mt-10 space-y-10">
              {reviewGroups.slice(0, showMoreReviews ? reviewGroups.length : 1).map((group) => (
                <div key={group.title}>
                  <div className="mb-4 flex items-center gap-2">
                    <Star className="h-5 w-5 fill-amber-400 text-amber-500" />
                    <h3 className="text-xl font-semibold">{group.title}</h3>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {group.reviews.map((review) => (
                      <article key={review.name} className="rounded-3xl border border-stone-200 bg-[#faf8f4] p-6 shadow-sm">
                        <div className="flex items-center gap-4">
                          <img
                            src={review.avatar}
                            alt={review.name}
                            className="h-16 w-16 rounded-full object-cover ring-2 ring-white shadow-sm"
                          />
                          <div>
                            <h4 className="font-semibold">{review.name}</h4>
                            <div className="mt-1 text-sm text-stone-500">{review.meta}</div>
                            <div className="mt-2 flex gap-0.5" aria-label="5 out of 5 stars">
                              {[0, 1, 2, 3, 4].map((star) => (
                                <Star key={star} className="h-4 w-4 fill-amber-400 text-amber-500" />
                              ))}
                            </div>
                          </div>
                        </div>
                        <p className="mt-5 text-[15px] leading-7 text-stone-700">“{review.text}”</p>
                      </article>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {liveReviews.length > 0 && (
              <div className="mt-8 grid gap-5 md:grid-cols-2">
                {liveReviews.map((review) => (
                  <article key={review.id} className="rounded-3xl border border-stone-200 bg-[#faf8f4] p-6 shadow-sm">
                    <div className="flex items-center justify-between"><h4 className="font-semibold">{review.client_name}</h4><span className="text-amber-600">{'★'.repeat(review.rating)}</span></div>
                    <div className="mt-1 text-sm text-stone-500">{review.review_type}{review.event_name ? ` • ${review.event_name}` : ''}</div>
                    <p className="mt-4 text-[15px] leading-7 text-stone-700">“{review.review_text}”</p>
                    {review.favorite_photo_name && <p className="mt-3 text-xs text-stone-500">Favourite photo: {review.favorite_photo_name}</p>}
                  </article>
                ))}
              </div>
            )}

            <div className="mt-10 rounded-3xl border border-stone-200 bg-[#faf8f4] p-6">
              <h3 className="text-xl font-serif">Share your RamyaChobi experience</h3>
              <p className="mt-1 text-sm text-stone-500">Your review will appear after studio approval. You can also post the same review on Facebook.</p>
              <form className="mt-5 grid gap-3 sm:grid-cols-2" onSubmit={async (e) => { e.preventDefault(); try { await submitClientReview({ ...reviewForm, rating: Number(reviewForm.rating), favorite_photo_url: null, facebook_review_url: 'https://www.facebook.com/RamyaChobi/reviews', instagram_handle: '@romochobi' }); setReviewNotice('Review submitted for approval. Thank you.'); setReviewForm({ client_name: '', review_text: '', rating: 5, review_type: 'Photography', favorite_photo_name: '', event_name: '' }); } catch { setReviewNotice('Could not submit the review. Please try again.'); } }}>
                <input required value={reviewForm.client_name} onChange={e => setReviewForm({ ...reviewForm, client_name: e.target.value })} placeholder="Your name" className="rounded-xl border border-stone-300 px-4 py-3" />
                <input value={reviewForm.event_name} onChange={e => setReviewForm({ ...reviewForm, event_name: e.target.value })} placeholder="Event / location" className="rounded-xl border border-stone-300 px-4 py-3" />
                <select value={reviewForm.review_type} onChange={e => setReviewForm({ ...reviewForm, review_type: e.target.value })} className="rounded-xl border border-stone-300 px-4 py-3"><option>Photography</option><option>Cinematography</option><option>Photo Selection</option><option>Delivery</option></select>
                <select value={reviewForm.rating} onChange={e => setReviewForm({ ...reviewForm, rating: Number(e.target.value) })} className="rounded-xl border border-stone-300 px-4 py-3"><option value={5}>5 stars</option><option value={4}>4 stars</option><option value={3}>3 stars</option><option value={2}>2 stars</option><option value={1}>1 star</option></select>
                <input value={reviewForm.favorite_photo_name} onChange={e => setReviewForm({ ...reviewForm, favorite_photo_name: e.target.value })} placeholder="Favourite photo name (optional)" className="rounded-xl border border-stone-300 px-4 py-3 sm:col-span-2" />
                <textarea required value={reviewForm.review_text} onChange={e => setReviewForm({ ...reviewForm, review_text: e.target.value })} placeholder="Write your review" rows={4} className="rounded-xl border border-stone-300 px-4 py-3 sm:col-span-2" />
                <button className="rounded-xl bg-stone-950 px-5 py-3 font-bold text-white sm:col-span-2">Submit review</button>
              </form>
              {reviewNotice && <p className="mt-3 text-sm font-semibold text-amber-800">{reviewNotice}</p>}
              <a className="mt-4 inline-flex text-sm font-semibold text-blue-700 underline" href="https://www.facebook.com/RamyaChobi/reviews" target="_blank" rel="noreferrer">Post this review on Facebook</a>
            </div>

            {reviewGroups.length > 1 && (
              <div className="mt-8 text-center">
                <button
                  type="button"
                  onClick={() => setShowMoreReviews((value) => !value)}
                  className="inline-flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-5 py-3 text-sm font-bold shadow-sm transition hover:border-stone-950"
                >
                  {showMoreReviews ? 'Show less' : 'See more'}
                  <ChevronRight className={`h-4 w-4 transition ${showMoreReviews ? 'rotate-90' : ''}`} />
                </button>
              </div>
            )}
          </div>
        </section>

        <section id="contact" className="bg-stone-950 text-white">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.24em] text-amber-300">Contact / Booking</div>
                <h2 className="mt-2 text-3xl font-semibold">Ready to plan your story?</h2>
                <p className="mt-2 max-w-xl text-white/55">
                  Start your booking, review packages, or use the client tools from the Main Menu.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <a href="/booking" className="rounded-xl bg-amber-300 px-5 py-3 font-bold text-stone-950">Book Now</a>
                <a href="/packages" className="rounded-xl border border-white/15 px-5 py-3 font-bold">View Packages</a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-stone-200 bg-white px-5 py-8 text-center text-sm text-stone-500 xl:pr-72">
        <div className="font-semibold tracking-[0.16em] text-stone-900">RAMYACHOBI</div>
        <div className="mt-2">Photography · Cinematography · Private Client Experience</div>
        <div className="mt-2">© 2026 RamyaChobi. All Rights Reserved.</div>
      </footer>
    </div>
  );
}
