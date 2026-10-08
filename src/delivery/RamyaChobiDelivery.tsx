import React, { useEffect, useMemo, useState } from 'react';
import { BadgeCheck, CalendarDays, Check, Copy, Download, FileText, Image as ImageIcon, LockKeyhole, MessageCircle, PlayCircle, ShieldCheck, Smartphone, WalletCards, X } from 'lucide-react';
import { DeliveryFinalFile, DeliveryPortalData, getDeliveryPortal, getDeliveryPreviewPortal, submitDeliveryPayment, submitDeliveryReview } from '../services/deliveryPortalService';

const fallbackHero = 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1800&q=85';
type Tab = 'PHOTOS' | 'VIDEOS' | 'DOCUMENTS';

function money(value: number | string | undefined | null) {
  return new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 0 }).format(Number(value || 0));
}
function date(value?: string | null) {
  if (!value) return 'Not set';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Not set' : new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }).format(parsed);
}
function fileSize(value?: number | null) {
  const bytes = Number(value || 0);
  if (!bytes) return '';
  const units = ['B','KB','MB','GB']; const index = Math.min(3, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}
function daysLeft(value?: string | null) { return value ? Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 86400000)) : null; }
function mediaUrl(token: string, fileId: string, mode: 'PREVIEW' | 'ORIGINAL') { return `/api/delivery-media?token=${encodeURIComponent(token)}&fileId=${encodeURIComponent(fileId)}&mode=${mode}`; }
function phoneHref(value?: string | null) {
  const digits = String(value || '').replace(/\D/g, '');
  const normalized = digits.startsWith('880') ? digits : digits.startsWith('0') ? `88${digits}` : `880${digits}`;
  return `https://wa.me/${normalized}?text=${encodeURIComponent('আসসালামু আলাইকুম। RamyaChobi Final Delivery সম্পর্কে সহায়তা চাই।')}`;
}
function deliveryLabel(status?: string) {
  if (status === 'FINAL_DELIVERED') return 'Delivered';
  if (status === 'READY') return 'Ready';
  return 'Editing';
}

export default function RamyaChobiDelivery({ token }: { token: string }) {
  const [data, setData] = useState<DeliveryPortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [tab, setTab] = useState<Tab>('PHOTOS');
  const [selected, setSelected] = useState<string[]>([]);
  const [lightbox, setLightbox] = useState<{ src: string; title: string; isVideo?: boolean } | null>(null);
  const [paymentMessage, setPaymentMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [payerPhone, setPayerPhone] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'BKASH' | 'NAGAD' | 'DBBL' | 'ROCKET'>('BKASH');
  const [paymentScreenshot, setPaymentScreenshot] = useState<File | null>(null);
  const [amount, setAmount] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const [review, setReview] = useState('');
  const [rating, setRating] = useState(5);
  const [reviewMessage, setReviewMessage] = useState('');
  const [reviewBusy, setReviewBusy] = useState(false);
  const [adminPreviewToken, setAdminPreviewToken] = useState('');
  const [adminPreviewSources, setAdminPreviewSources] = useState<Record<string, string>>({});
  const [selectedDays, setSelectedDays] = useState(1);

  const previewMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('preview') === 'admin';
  useEffect(() => {
    let adminToken = '';
    try { adminToken = previewMode ? localStorage.getItem('ramya_booking_admin_token_v1') || '' : ''; } catch {}
    setAdminPreviewToken(adminToken);
  }, [previewMode]);

  async function load() {
    setLoading(true); setPageError('');
    try {
      const result = previewMode && adminPreviewToken
        ? await getDeliveryPreviewPortal(token, adminPreviewToken)
        : await getDeliveryPortal(token);
      if (!result) { setData(null); setPageError('This private delivery link is invalid, unpublished, or no longer available.'); }
      else setData(result);
    } catch (error: any) { setPageError(error?.message || 'Unable to load this delivery page.'); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    if (previewMode && !adminPreviewToken) {
      setData(null);
      setPageError('Sign in to Delivery Admin before opening a client preview.');
      setLoading(false);
      return;
    }
    void load();
  }, [token, previewMode, adminPreviewToken]);

  const galleryStatus = data?.gallery_status || 'PREVIEW';
  const locked = galleryStatus === 'LOCKED';
  const unavailable = galleryStatus === 'UNAVAILABLE';
  const canDownload = data?.download_status === 'ENABLED' && !unavailable && data?.is_published !== false;
  const canPhoto = canDownload && data?.photo_download_permission === true;
  const canVideo = canDownload && data?.video_download_permission === true;
  const canDocument = canDownload && data?.document_download_permission === true;
  const fullyPaid = data?.payment_status === 'FULLY_PAID';
  const remaining = Number(data?.remaining_due || 0);
  const isAccessPayment = locked && fullyPaid && Number(data?.late_fee_balance || 0) > 0;
  const dailyFee = Number(data?.daily_late_fee ?? data?.access_fee_per_day ?? 20);
  const accessExpiry = data?.access_expires_at || data?.free_access_expires_at;
  const paymentOptions = [
    { id: 'BKASH' as const, label: 'bKash', account: data?.bkash_number || '', mark: 'b', color: 'bg-[#e2136e]' },
    { id: 'NAGAD' as const, label: 'Nagad', account: data?.nagad_number || '', mark: 'N', color: 'bg-[#f58220]' },
    { id: 'DBBL' as const, label: 'Dutch-Bangla', account: data?.dbbl_number || '', mark: 'DB', color: 'bg-[#126b54]' },
    { id: 'ROCKET' as const, label: 'Rocket', account: data?.rocket_number || '', mark: 'R', color: 'bg-[#8f1b76]' },
  ].filter((item) => Boolean(item.account));
  const currentMethod = paymentOptions.find((item) => item.id === paymentMethod) || paymentOptions[0];
  const finalFiles = data?.delivery_files || [];
  const photos = finalFiles.filter((item) => item.file_type === 'PHOTO');
  const videos = finalFiles.filter((item) => item.file_type === 'VIDEO');
  const documents = finalFiles.filter((item) => item.file_type === 'DOCUMENT');
  const previews = data?.preview_items || [];
  const legacyPhotos = previews.filter((item) => item.type === 'image');
  const legacyVideos = previews.filter((item) => item.type === 'video');
  const activeItems = tab === 'PHOTOS' ? (photos.length ? photos : legacyPhotos) : tab === 'VIDEOS' ? (videos.length ? videos : legacyVideos) : documents;

  useEffect(() => {
    if (!data) return;
    setAmount(isAccessPayment ? String(selectedDays * dailyFee) : remaining > 0 ? String(remaining) : '');
    if (!paymentOptions.some((item) => item.id === paymentMethod) && paymentOptions[0]) setPaymentMethod(paymentOptions[0].id);
  }, [data, remaining, paymentOptions.length, isAccessPayment, selectedDays, dailyFee]);

  useEffect(() => {
    if (!previewMode || !adminPreviewToken || !activeItems.length) { setAdminPreviewSources({}); return; }
    let cancelled = false;
    const urls: string[] = [];
    const run = async () => {
      const entries = await Promise.all(activeItems.slice(0, 80).map(async (item: any, index) => {
        if (!item.id || item.file_type === 'DOCUMENT') return null;
        try {
          const response = await fetch(mediaUrl(token, item.id, 'PREVIEW'), { headers: { 'x-admin-token': adminPreviewToken } });
          if (!response.ok) return null;
          const url = URL.createObjectURL(await response.blob()); urls.push(url);
          return [item.id, url] as const;
        } catch { return null; }
      }));
      if (!cancelled) setAdminPreviewSources(Object.fromEntries(entries.filter(Boolean) as Array<readonly [string,string]>));
    };
    void run();
    return () => { cancelled = true; urls.forEach(URL.revokeObjectURL); };
  }, [previewMode, adminPreviewToken, token, tab, activeItems.length]);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setLightbox(null); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [lightbox]);

  function fileCanDownload(file: DeliveryFinalFile) {
    return file.file_type === 'PHOTO' ? canPhoto : file.file_type === 'VIDEO' ? canVideo : file.file_type === 'DOCUMENT' ? canDocument : false;
  }
  function openFile(file: DeliveryFinalFile) {
    if (file.file_type === 'DOCUMENT') return;
    const url = mediaUrl(token, file.id, fileCanDownload(file) ? 'ORIGINAL' : 'PREVIEW');
    setLightbox({ src: previewMode ? (adminPreviewSources[file.id] || url) : url, title: file.title || file.file_name || 'RamyaChobi delivery', isVideo: file.file_type === 'VIDEO' });
  }
  async function downloadZip(files: DeliveryFinalFile[], fileName: string) {
    if (!canDownload || !files.length || downloading) return;
    setDownloading(true); setDownloadError('');
    try {
      const response = await fetch('/api/delivery-zip', { method: 'POST', headers: { 'content-type': 'application/json', ...(previewMode && adminPreviewToken ? { 'x-admin-token': adminPreviewToken } : {}) }, body: JSON.stringify({ token, files: files.map((file) => file.id) }) });
      if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body?.error || 'ZIP download failed.'); }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a'); link.href = url; link.download = fileName; document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 3000);
    } catch (error: any) { setDownloadError(error?.message || 'Download failed.'); }
    finally { setDownloading(false); }
  }
  function downloadOne(file: DeliveryFinalFile) {
    if (!fileCanDownload(file)) return;
    const link = document.createElement('a'); link.href = mediaUrl(token, file.id, 'ORIGINAL'); link.download = file.file_name || file.title || 'ramyachobi-file';
    if (previewMode && adminPreviewToken) link.setAttribute('data-admin-preview', adminPreviewToken);
    link.click();
  }
  async function submitPayment(event: React.FormEvent) {
    event.preventDefault();
    if (!data || !currentMethod || !payerPhone.trim() || !transactionId.trim() || !amount || !paymentScreenshot) {
      setPaymentMessage('Enter the payer number, transaction ID, amount and payment screenshot.'); return;
    }
    setSubmitting(true); setPaymentMessage('');
    try {
      await submitDeliveryPayment({ token, paymentType: isAccessPayment ? 'ACCESS' : 'PACKAGE', paymentMethod, screenshot: paymentScreenshot, payerPhone: payerPhone.trim(), transactionId: transactionId.trim(), amount: Number(amount), selectedDays: isAccessPayment ? selectedDays : null });
      setPaymentMessage('Payment submitted. Access changes only after an admin verifies it.');
      setTransactionId(''); setPaymentScreenshot(null); await load();
    } catch (error: any) { setPaymentMessage(error?.message || 'Payment submission failed.'); }
    finally { setSubmitting(false); }
  }
  async function sendReview(event: React.FormEvent) {
    event.preventDefault(); setReviewBusy(true); setReviewMessage('');
    try { const result = await submitDeliveryReview({ token, rating, review }); setReview(''); setReviewMessage(`Review submitted for ${result.status} moderation.`); }
    catch (error: any) { setReviewMessage(error?.message || 'Review could not be submitted.'); }
    finally { setReviewBusy(false); }
  }

  if (loading) return <div className="grid min-h-screen place-items-center bg-[#f6f2ea] px-6 text-stone-600"><div className="text-center"><div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-stone-300 border-t-amber-600" /><p className="mt-4 text-sm">Opening your private delivery…</p></div></div>;
  if (!data) return <div className="grid min-h-screen place-items-center bg-[#f6f2ea] p-6"><div className="max-w-md rounded-3xl border border-stone-200 bg-white p-8 text-center"><LockKeyhole className="mx-auto h-9 w-9 text-amber-700" /><h1 className="mt-4 text-2xl font-semibold">Delivery unavailable</h1><p className="mt-2 text-sm leading-6 text-stone-600">{pageError || 'This delivery could not be loaded.'}</p></div></div>;

  const deliveryStatus = deliveryLabel(data.delivery_status);
  const freeDays = daysLeft(accessExpiry);
  const selectedFiles = finalFiles.filter((file) => selected.includes(file.id) && fileCanDownload(file));
  const statusColor = unavailable || locked ? 'bg-stone-200 text-stone-700' : canDownload ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800';
  const displayUrl = (item: any, index: number) => 'file_type' in item ? (previewMode ? adminPreviewSources[item.id] || '' : mediaUrl(token, item.id, 'PREVIEW')) : item.url;

  return (
    <main className="min-h-screen bg-[#f6f2ea] text-[#292820]">
      {previewMode && <div className="bg-amber-200 px-4 py-2 text-center text-xs font-bold text-amber-950">Admin preview · unpublished delivery</div>}
      <header className="relative isolate overflow-hidden bg-[#292820] text-white">
        <img src={data.hero_image_url || fallbackHero} alt="Event cover" className="absolute inset-0 h-full w-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-black/30" />
        <div className="relative mx-auto max-w-6xl px-5 py-6 sm:px-8 sm:py-8">
          <div className="flex items-center justify-between gap-4"><div><div className="text-lg font-semibold tracking-[.18em]">RAMYACHOBI</div><div className="mt-1 text-[10px] uppercase tracking-[.24em] text-white/60">Photography · Cinematography</div></div><span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs">Private delivery</span></div>
          <div className="mt-12 max-w-2xl sm:mt-16">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/30 bg-amber-100/10 px-3 py-1.5 text-xs text-amber-100"><ShieldCheck className="h-4 w-4" /> Private client gallery</div>
            <h1 className="mt-4 text-3xl font-semibold leading-tight sm:text-5xl">{data.client_name || 'Your event memories'}</h1>
            <p className="mt-2 text-sm text-white/75 sm:text-base">{data.event_name || 'Photography & Videography'}{data.event_date ? ` · ${date(data.event_date)}` : ''}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${statusColor}`}>{deliveryStatus}</span>
              <span className="rounded-full border border-white/20 bg-black/20 px-3 py-1.5 text-xs">{canDownload ? `${freeDays ?? 0} days access left` : unavailable ? 'Retention ended' : locked ? 'Download access expired' : fullyPaid ? 'Preparing delivery' : 'Payment pending'}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-5 px-4 py-5 sm:px-8 sm:py-8">
        {data.client_message && <div className="rounded-2xl border border-[#e8dfcf] bg-white p-4 text-sm leading-6"><strong>Message from RamyaChobi</strong><p className="mt-1 whitespace-pre-line text-stone-600">{data.client_message}</p></div>}
        <section className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
          <div className="rounded-2xl border border-[#e5dfd3] bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[.18em] text-amber-700">Event delivery</p><h2 className="mt-1 text-xl font-semibold">{data.event_name || 'Final Delivery'}</h2><p className="mt-1 text-sm text-stone-500">{data.package_name || 'Photography package'}</p></div><span className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${statusColor}`}>{deliveryStatus}</span></div>
            <div className="mt-5 grid grid-cols-2 gap-3 text-sm"><div className="rounded-xl bg-[#f8f6f1] p-3"><div className="flex items-center gap-2 text-xs text-stone-500"><CalendarDays className="h-4 w-4" /> Event date</div><strong className="mt-1 block">{date(data.event_date)}</strong></div><div className="rounded-xl bg-[#f8f6f1] p-3"><div className="flex items-center gap-2 text-xs text-stone-500"><BadgeCheck className="h-4 w-4" /> Payment status</div><strong className="mt-1 block">{data.payment_status.replaceAll('_',' ')}</strong></div></div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div className="rounded-xl bg-[#f8f6f1] p-3"><span className="block text-xs text-stone-500">Access expiry</span><strong>{date(accessExpiry)}</strong></div><div className="rounded-xl bg-[#f8f6f1] p-3"><span className="block text-xs text-stone-500">Storage retention</span><strong>{date(data.storage_retention_until)}</strong></div></div>
          </div>
          <div className="rounded-2xl bg-[#292820] p-5 text-white shadow-sm sm:p-6">
            <p className="text-[11px] font-bold uppercase tracking-[.18em] text-amber-300">Payment summary</p>
            <div className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-3 text-white/70"><span>Total bill</span><strong className="text-white">{money(data.package_price)}</strong></div><div className="flex justify-between gap-3 text-white/70"><span>Verified payments</span><strong className="text-white">{money(data.total_paid ?? data.verified_total_paid)}</strong></div><div className="flex justify-between gap-3 border-t border-white/15 pt-3"><span className="font-semibold">Remaining balance</span><strong className="text-xl text-amber-300">{money(data.remaining_due)}</strong></div></div>
            <p className="mt-4 rounded-xl bg-white/5 p-3 text-xs leading-5 text-white/65">Only verified payments are included. Download access is checked again on the server for every file.</p>
          </div>
        </section>

        {unavailable ? <section className="rounded-2xl border border-red-200 bg-white p-8 text-center"><LockKeyhole className="mx-auto h-8 w-8 text-red-600"/><h2 className="mt-3 text-xl font-semibold">Storage retention ended</h2><p className="mt-2 text-sm text-stone-600">The storage retention period has ended. Please contact RamyaChobi for help.</p></section> : locked ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><h2 className="font-semibold">Download access expired</h2><p className="mt-1 text-sm text-stone-600">Access has expired. Send a restoration payment only after confirming the amount with RamyaChobi.</p></section> : null}

        {!unavailable && <section className="overflow-hidden rounded-2xl border border-[#e5dfd3] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-4 py-4 sm:px-5">
            <div><p className="text-[11px] font-bold uppercase tracking-[.18em] text-amber-700">Your files</p><h2 className="mt-1 text-xl font-semibold">{canDownload ? 'Final delivery' : 'Preview gallery'}</h2></div>
            <div className="flex flex-wrap gap-2">
              {selectedFiles.length > 0 && <button onClick={() => void downloadZip(selectedFiles,'ramyachobi-selected.zip')} disabled={!canDownload || downloading} className="rounded-xl border border-stone-300 px-3 py-2 text-xs font-bold disabled:opacity-40">Download selected ({selectedFiles.length})</button>}
              <button onClick={() => void downloadZip(photos.filter(fileCanDownload),'ramyachobi-photos.zip')} disabled={!canPhoto || !photos.length || downloading} className="inline-flex items-center gap-1.5 rounded-xl bg-[#292820] px-3 py-2 text-xs font-bold text-white disabled:opacity-40"><Download className="h-3.5 w-3.5" />All photos ZIP</button>
            </div>
          </div>
          <div className="flex gap-1 overflow-x-auto border-b border-stone-200 px-3 pt-2 sm:px-5" role="tablist">
            {([['PHOTOS',`Photos (${photos.length || legacyPhotos.length})`],['VIDEOS',`Videos (${videos.length || legacyVideos.length})`],['DOCUMENTS',`Documents (${documents.length})`]] as [Tab,string][]).map(([value,label]) => <button key={value} role="tab" aria-selected={tab===value} onClick={() => { setTab(value); setSelected([]); }} className={`shrink-0 border-b-2 px-3 py-3 text-sm font-semibold ${tab===value ? 'border-amber-600 text-stone-950' : 'border-transparent text-stone-500'}`}>{label}</button>)}
          </div>
          <div className="p-3 sm:p-5">
            {activeItems.length === 0 ? <div className="grid min-h-40 place-items-center rounded-xl border border-dashed border-stone-300 bg-[#fbfaf7] p-5 text-center"><div><FileText className="mx-auto h-7 w-7 text-stone-400"/><p className="mt-2 text-sm font-semibold">No {tab.toLowerCase()} available yet</p><p className="mt-1 text-xs text-stone-500">Files will appear here when the delivery is ready.</p></div></div> : <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
              {activeItems.map((item: any, index: number) => {
                const isFile = Boolean(item.id);
                const label = item.title || item.file_name || `Photo ${index + 1}`;
                const canItem = isFile && fileCanDownload(item);
                const source = isFile ? displayUrl(item,index) : item.url;
                return <article key={isFile ? item.id : `${tab}-${index}`} className="group overflow-hidden rounded-xl border border-stone-200 bg-white">
                  <div className={`relative aspect-[4/3] bg-[#efede7] ${tab !== 'DOCUMENTS' ? 'cursor-zoom-in' : ''}`} onClick={() => { if (tab === 'DOCUMENTS') return; setLightbox({ src: source, title: label, isVideo: tab === 'VIDEOS' }); }}>
                    {tab === 'PHOTOS' ? source ? <img src={source} loading="lazy" alt={label} className="h-full w-full object-cover transition group-hover:scale-[1.02]" /> : <div className="grid h-full place-items-center"><ImageIcon className="h-8 w-8 text-stone-400"/></div> : tab === 'VIDEOS' ? <div className="relative h-full"><video src={source} preload="metadata" className="h-full w-full object-cover"/><span className="absolute inset-0 grid place-items-center bg-black/10"><PlayCircle className="h-10 w-10 text-white drop-shadow"/></span></div> : <div className="grid h-full place-items-center"><FileText className="h-9 w-9 text-amber-700"/></div>}
                    {!canDownload && tab !== 'DOCUMENTS' && <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-1 text-[10px] font-bold text-white">PREVIEW</span>}
                    {isFile && canItem && <label onClick={(e) => e.stopPropagation()} className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-lg bg-white/95 shadow"><input type="checkbox" checked={selected.includes(item.id)} onChange={(e) => setSelected((old) => e.target.checked ? [...old,item.id] : old.filter((id) => id !== item.id))} aria-label={`Select ${label}`} className="h-4 w-4 accent-stone-900" /></label>}
                  </div>
                  <div className="flex items-center justify-between gap-2 p-2.5"><div className="min-w-0"><div className="truncate text-xs font-semibold" title={label}>{label}</div><div className="mt-0.5 text-[10px] text-stone-500">{isFile ? fileSize(item.file_size_bytes) || item.file_type.toLowerCase() : tab.toLowerCase()}</div></div>{isFile && canItem && <button onClick={() => downloadOne(item)} className="shrink-0 rounded-lg bg-[#292820] px-2.5 py-1.5 text-[10px] font-bold text-white">Download</button>}</div>
                </article>;
              })}
            </div>}
            {downloadError && <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{downloadError}</div>}
          </div>
        </section>}

        {!fullyPaid && !unavailable && <section className="grid gap-4 lg:grid-cols-[.8fr_1.2fr]">
          <div className="rounded-2xl bg-[#292820] p-5 text-white"><WalletCards className="h-7 w-7 text-amber-300"/><h2 className="mt-3 text-xl font-semibold">Submit payment</h2><p className="mt-1 text-sm text-white/65">Select a configured account, copy the number, then send payment.</p><div className="mt-4 space-y-2">{paymentOptions.length ? paymentOptions.map((option) => <button key={option.id} onClick={() => setPaymentMethod(option.id)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${paymentMethod===option.id ? 'border-amber-300 bg-white/10' : 'border-white/10 bg-white/5'}`}><span className={`grid h-8 w-8 place-items-center rounded-lg text-sm font-black ${option.color}`}>{option.mark}</span><span className="text-sm font-semibold">{option.label}</span>{paymentMethod===option.id && <Check className="ml-auto h-4 w-4 text-amber-300"/>}</button>) : <p className="rounded-xl bg-white/5 p-3 text-sm text-white/70">Payment methods are not configured. Contact RamyaChobi.</p>}</div>
            {currentMethod && <div className="mt-3 rounded-xl bg-white/10 p-3"><div className="text-[10px] uppercase tracking-[.16em] text-white/55">{currentMethod.label} number</div><div className="mt-1 flex items-center justify-between gap-3"><strong className="text-lg">{currentMethod.account}</strong><button onClick={() => { void navigator.clipboard?.writeText(currentMethod.account); setPaymentMessage('Payment number copied.'); }} className="rounded-lg bg-white px-2.5 py-2 text-xs font-bold text-stone-900"><Copy className="mr-1 inline h-3.5 w-3.5"/>Copy</button></div></div>}
          </div>
          <form onSubmit={submitPayment} className="rounded-2xl border border-[#e5dfd3] bg-white p-5">
            <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold">Payer mobile<input value={payerPhone} onChange={(e) => setPayerPhone(e.target.value)} placeholder="01XXXXXXXXX" className="mt-1.5 w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm"/></label><label className="text-xs font-semibold">Transaction ID<input value={transactionId} onChange={(e) => setTransactionId(e.target.value)} placeholder="Enter TrxID" className="mt-1.5 w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm"/></label>{isAccessPayment && <label className="text-xs font-semibold">Restore access<select value={selectedDays} onChange={(e) => setSelectedDays(Number(e.target.value))} className="mt-1.5 w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm">{[1,2,3,5,7].map((day) => <option key={day} value={day}>{day} day{day>1?'s':''} · {money(day*dailyFee)}</option>)}</select></label>}<label className="text-xs font-semibold">Amount (BDT)<input type="number" min="1" max={isAccessPayment ? undefined : remaining || undefined} readOnly={isAccessPayment} value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1.5 w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm read-only:bg-stone-50"/><span className="mt-1 block font-normal text-stone-500">{isAccessPayment ? 'Restoration fee' : `Balance due: ${money(remaining)}`}</span></label><label className="text-xs font-semibold">Payment screenshot<input type="file" accept="image/jpeg,image/png,image/webp" required onChange={(e) => setPaymentScreenshot(e.target.files?.[0] || null)} className="mt-1.5 w-full rounded-xl border border-dashed border-stone-300 bg-stone-50 px-2 py-2 text-xs"/><span className="mt-1 block font-normal text-stone-500">JPEG, PNG or WebP, up to 5 MB</span></label></div>
            <button disabled={submitting || !currentMethod} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#292820] px-4 py-3 text-sm font-bold text-white disabled:opacity-40"><Smartphone className="h-4 w-4"/>{submitting ? 'Submitting…' : 'Submit for verification'}</button>{paymentMessage && <p className="mt-3 rounded-xl bg-stone-50 p-3 text-sm text-stone-700">{paymentMessage}</p>}
            <p className="mt-3 text-xs leading-5 text-stone-500">Status: {data.payment_status === 'SUBMITTED' ? 'Pending admin verification' : data.payment_status === 'REJECTED' ? 'Rejected · contact support' : 'No submitted payment'}.</p>
          </form>
        </section>}

        <section className="grid gap-4 lg:grid-cols-2">
          <form onSubmit={sendReview} className="rounded-2xl border border-[#e5dfd3] bg-white p-5"><h2 className="text-lg font-semibold">Leave a review</h2><p className="mt-1 text-xs text-stone-500">Your review is sent to the team for approval before it appears publicly.</p><div className="mt-3 flex gap-1" aria-label="Rating">{[1,2,3,4,5].map((value) => <button type="button" key={value} onClick={() => setRating(value)} aria-label={`${value} stars`} className={`text-2xl ${rating >= value ? 'text-amber-500' : 'text-stone-300'}`}>★</button>)}</div><textarea value={review} onChange={(e) => setReview(e.target.value)} minLength={12} maxLength={2000} required placeholder="Tell us about your experience" className="mt-2 min-h-24 w-full resize-y rounded-xl border border-stone-300 px-3 py-2.5 text-sm"/><button disabled={reviewBusy} className="mt-2 rounded-xl border border-stone-300 px-4 py-2.5 text-sm font-bold disabled:opacity-40">{reviewBusy ? 'Submitting…' : 'Submit review'}</button>{reviewMessage && <p className="mt-2 text-xs text-stone-600">{reviewMessage}</p>}</form>
          <div className="rounded-2xl bg-[#ebe4d7] p-5"><h2 className="text-lg font-semibold">Need help?</h2><p className="mt-1 text-sm leading-6 text-stone-600">Contact RamyaChobi about payments, delivery status, or access dates.</p>{(data.whatsapp_number || data.client_phone) && <a href={phoneHref(data.whatsapp_number || data.client_phone)} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#292820] px-4 py-3 text-sm font-bold text-white"><MessageCircle className="h-4 w-4"/>WhatsApp support</a>}<div className="mt-5 flex items-start gap-2 border-t border-stone-300 pt-4 text-xs leading-5 text-stone-600"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-700"/>Original files stay in private Drive storage. This page never receives a Google login or direct Drive credential.</div></div>
        </section>
        <footer className="pb-4 text-center text-[11px] text-stone-500">RamyaChobi · Private client delivery</footer>
      </div>

      {lightbox && <div className="fixed inset-0 z-[150] grid place-items-center bg-black/90 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Photo preview" onClick={() => setLightbox(null)}><button onClick={() => setLightbox(null)} aria-label="Close preview" className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white"><X className="h-5 w-5"/></button><div className="max-h-full w-full max-w-6xl" onClick={(e) => e.stopPropagation()}>{lightbox.isVideo ? <video src={lightbox.src} controls autoPlay className="mx-auto max-h-[82vh] max-w-full"/> : <img src={lightbox.src} alt={lightbox.title} className="mx-auto max-h-[86vh] max-w-full object-contain"/>}<p className="mt-3 text-center text-sm text-white/80">{lightbox.title}</p></div></div>}
    </main>
  );
}
