import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Download, Image as ImageIcon, PlayCircle, X } from 'lucide-react';
import type { DeliveryFinalFile } from '../services/deliveryPortalService';
import type { DeliveryPreview } from './deliveryView';

type Props = { kind: 'PHOTO' | 'VIDEO'; raw?: boolean; items: DeliveryPreview[]; backHref: string; source: (item: DeliveryPreview) => string; resolveSource: (item: DeliveryPreview) => Promise<string>; allowed: (file: DeliveryFinalFile) => boolean; onDownload: (file: DeliveryFinalFile) => void; onDownloadAll: () => void; busy: boolean; error: string; previewEnabled: boolean };
export default function DeliveryPreviewGallery(props: Props) {
  const { kind, items } = props;
  const [opened, setOpened] = useState<number | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const current = opened === null ? null : items[opened];
  const [openedSource, setOpenedSource] = useState('');
  const [previewError, setPreviewError] = useState('');
  useEffect(() => {
    if (!current) return;
    let alive = true;
    let resolved = '';
    setOpenedSource(''); setPreviewError('');
    void props.resolveSource(current).then(source => {
      resolved = source;
      if (alive) { setOpenedSource(source); if (!source) setPreviewError('প্রিভিউ এখন পাওয়া যাচ্ছে না।'); }
      else if (source.startsWith('blob:')) URL.revokeObjectURL(source);
    }).catch(error => { if (alive) setPreviewError(error?.message || 'প্রিভিউ খোলা যায়নি।'); });
    return () => { alive = false; if (resolved.startsWith('blob:')) URL.revokeObjectURL(resolved); };
  }, [current?.key, props.resolveSource]);
  function close() { setOpened(null); openerRef.current?.focus(); }
  function navigate(delta: number) { setOpenedSource(''); setPreviewError(''); setOpened(index => index === null ? null : (index + delta + items.length) % items.length); }
  useEffect(() => {
    if (opened === null) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      if (kind === 'PHOTO' && event.key === 'ArrowRight') { event.preventDefault(); navigate(1); }
      if (kind === 'PHOTO' && event.key === 'ArrowLeft') { event.preventDefault(); navigate(-1); }
      if (event.key === 'Tab') {
        const focusables = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), video[controls]') || []);
        const first = focusables[0], last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', onKey); };
  }, [opened, items.length, kind]);
  const permitted = items.filter(item => item.file && props.allowed(item.file));
  const label = kind === 'PHOTO' ? 'Photos' : 'Videos';
  return <section>
    <a href={props.backHref} className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-bold"><ArrowLeft className="h-4 w-4" />মূল ডেলিভারি পেজ / Back</a>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-2xl font-bold">{props.raw ? `RAW ${label} Preview` : kind === 'PHOTO' ? 'ছবি দেখুন / Preview Photos' : 'ভিডিও দেখুন / Preview Videos'}</h2><p className="mt-2 text-sm text-stone-500">{items.length} {label.toLowerCase()} · {kind === 'PHOTO' ? 'ছবিতে চাপলে বড় করে দেখতে পারবেন।' : 'ভিডিওতে চাপলে প্লেয়ার খুলবে।'}</p></div><button type="button" disabled={!permitted.length || props.busy} onClick={props.onDownloadAll} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-emerald-800 px-5 py-3 font-bold text-white disabled:opacity-40"><Download className="h-4 w-4" />Download All {props.raw ? `RAW ${label}` : label}</button></div>
    {!props.previewEnabled ? <p className="rounded-2xl border bg-white p-6">প্রিভিউ এখন বন্ধ আছে। সাহায্যের জন্য মূল ডেলিভারি পেজে ফিরে যোগাযোগ করুন।</p> : !items.length ? <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center"><ImageIcon className="mx-auto h-10 w-10 text-stone-400" /><h3 className="mt-4 text-lg font-bold">{kind === 'PHOTO' ? 'এখনও ছবি যুক্ত করা হয়নি' : 'এখনও ভিডিও যুক্ত করা হয়নি'}</h3><p className="mt-2 text-sm text-stone-500">ফাইল প্রস্তুত হলে এখানে দেখা যাবে।</p></div> : <div className={'grid gap-4 '+(kind === 'PHOTO' ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3')}>
      {items.map((item, index) => <article key={item.key} className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"><button type="button" aria-label={`Preview ${item.title}`} onClick={event => { openerRef.current = event.currentTarget; setOpenedSource(''); setPreviewError(''); setOpened(index); }} className="relative block aspect-[4/3] w-full overflow-hidden bg-stone-100 focus-visible:outline-4 focus-visible:outline-emerald-600">
        {kind === 'PHOTO' ? props.source(item) ? <img src={props.source(item)} alt={item.title} loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" /> : <ImageIcon className="mx-auto h-10 w-10 text-stone-400" /> : <><video src={props.source(item) || undefined} muted playsInline preload="metadata" controlsList="nodownload" tabIndex={-1} aria-hidden="true" className="pointer-events-none h-full w-full object-cover" /><span className="absolute inset-0 grid place-items-center bg-black/20"><PlayCircle className="h-14 w-14 text-white drop-shadow" /></span></>}
      </button><div className="p-3"><h3 className="truncate text-sm font-semibold" title={item.title}>{item.title}</h3><button type="button" disabled={!item.file || !props.allowed(item.file) || props.busy} onClick={() => item.file && props.onDownload(item.file)} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-stone-300 px-3 py-2 text-sm font-bold disabled:opacity-40"><Download className="h-4 w-4" />Download {kind === 'PHOTO' ? 'Photo' : 'Video'}</button></div></article>)}
    </div>}
    {!permitted.length && items.length > 0 && <p className="mt-4 text-sm text-stone-600">ডাউনলোডের অনুমতি বা মূল ফাইল এখনও পাওয়া যাচ্ছে না। মূল পেজে পেমেন্ট ও অ্যাক্সেসের সময় দেখুন।</p>}
    {props.error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">{props.error}</p>}
    {current && <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={`${kind === 'PHOTO' ? 'Photo' : 'Video'} preview`} className="fixed inset-0 z-[150] flex flex-col bg-stone-950 p-3 text-white sm:p-5" onClick={close}>
      <div className="flex flex-wrap items-center justify-between gap-2" onClick={event => event.stopPropagation()}><span className="max-w-[65%] truncate text-sm">{current.title} · {(opened || 0) + 1} / {items.length}</span><button ref={closeRef} type="button" onClick={close} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white/10 px-4 py-2"><X className="h-5 w-5" />Close</button></div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center" onClick={event => event.stopPropagation()}>{previewError ? <p role="alert" className="rounded-xl bg-white/10 p-5 text-center">{previewError}</p> : !openedSource ? <p role="status">প্রিভিউ লোড হচ্ছে…</p> : kind === 'VIDEO' ? <video key={current.key} src={openedSource} controls playsInline autoPlay controlsList="nodownload" className="max-h-full max-w-full" onError={() => setPreviewError('ভিডিও চালানো যাচ্ছে না। অনুমতি থাকলে Download বাটন ব্যবহার করুন।')} /> : <img key={current.key} src={openedSource} alt={current.title} onError={() => setPreviewError('ছবিটি লোড হয়নি। ফিরে গিয়ে আবার চেষ্টা করুন।')} referrerPolicy="no-referrer" className="max-h-full max-w-full object-contain" />}</div>
      <div className="flex shrink-0 flex-wrap items-center justify-center gap-3 py-3" onClick={event => event.stopPropagation()}>{kind === 'PHOTO' && <button type="button" aria-label="Previous photo" disabled={items.length < 2} onClick={() => navigate(-1)} className="inline-flex min-h-11 items-center gap-1 rounded-xl bg-white/10 px-4 py-2 disabled:opacity-40"><ChevronLeft className="h-5 w-5" />Previous</button>}<button type="button" disabled={!current.file || !props.allowed(current.file) || props.busy} onClick={() => current.file && props.onDownload(current.file)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 font-bold disabled:opacity-40"><Download className="h-4 w-4" />Download</button>{kind === 'PHOTO' && <button type="button" aria-label="Next photo" disabled={items.length < 2} onClick={() => navigate(1)} className="inline-flex min-h-11 items-center gap-1 rounded-xl bg-white/10 px-4 py-2 disabled:opacity-40">Next<ChevronRight className="h-5 w-5" /></button>}</div>
    </div>}
  </section>;
}
