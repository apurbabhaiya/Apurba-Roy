import React, { useCallback, useEffect, useMemo, useState } from 'react';
import DeliveryBulkDownloads from './DeliveryBulkDownloads';
import DeliveryCountdown from './DeliveryCountdown';
import DeliveryPreviewGallery from './DeliveryPreviewGallery';
import { deliveryView, deliveryPath, deliveryPreviews, deliveryFileAllowed, effectiveDeliveryExpiry, needsNativeBulkDownload, type DeliveryPreview } from './deliveryView';
import { getRecoveryPolicy, emptyRecoveryPolicy } from '../services/deliveryRecoveryPolicy';
import FacebookPageActions from '../home/FacebookPageActions';
import DeliveryRecoveryNotice from './DeliveryRecoveryNotice';
import { BadgeCheck, CalendarDays, Check, Copy, Download, Image as ImageIcon, LockKeyhole, MessageCircle, PlayCircle, ShieldCheck, Smartphone, WalletCards } from 'lucide-react';
import { DeliveryFinalFile, DeliveryPortalData, getDeliveryPortal, getDeliveryPreviewPortal, submitDeliveryPayment, submitDeliveryReview } from '../services/deliveryPortalService';

const fallbackHero = 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1800&q=85';


function money(value: number | string | undefined | null) {
  return new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 0 }).format(Number(value || 0));
}
function date(value?: string | null) {
  if (!value) return 'Not set';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Not set' : new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dhaka', day: '2-digit', month: 'long', year: 'numeric' }).format(parsed);
}
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

export default function RamyaChobiDelivery({ token, view: viewSegment }: { token: string; view?: string }) {
  const view = deliveryView(viewSegment);
  const [serverOffset, setServerOffset] = useState(0);
  const [supportPhone, setSupportPhone] = useState(emptyRecoveryPolicy.whatsapp_number);
  const [clock, setClock] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setClock(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const [data, setData] = useState<DeliveryPortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');

  const [paymentMessage, setPaymentMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [payerPhone, setPayerPhone] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'BKASH' | 'NAGAD' | 'DBBL' | 'ROCKET'>('BKASH');
  const [paymentScreenshot, setPaymentScreenshot] = useState<File | null>(null);
  const [amount, setAmount] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [bulkFiles, setBulkFiles] = useState<DeliveryFinalFile[]>([]);
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
  const accessExpiry = data ? effectiveDeliveryExpiry(data) : null;
  const canDownload = data?.download_status === 'ENABLED' && !unavailable && data?.is_published !== false && (!accessExpiry || Date.parse(accessExpiry) > clock + serverOffset);
  const fullyPaid = data?.payment_status === 'FULLY_PAID';
  const remaining = Number(data?.remaining_due || 0);
  const isAccessPayment = locked && fullyPaid && Number(data?.late_fee_balance || 0) > 0;
  const dailyFee = Number(data?.daily_late_fee ?? data?.access_fee_per_day ?? 20);
  const paymentOptions = [
    { id: 'BKASH' as const, label: 'bKash', account: data?.bkash_number || '', mark: 'b', color: 'bg-[#e2136e]' },
    { id: 'NAGAD' as const, label: 'Nagad', account: data?.nagad_number || '', mark: 'N', color: 'bg-[#f58220]' },
    { id: 'DBBL' as const, label: 'Dutch-Bangla', account: data?.dbbl_number || '', mark: 'DB', color: 'bg-[#126b54]' },
    { id: 'ROCKET' as const, label: 'Rocket', account: data?.rocket_number || '', mark: 'R', color: 'bg-[#8f1b76]' },
  ].filter((item) => Boolean(item.account));
  const currentMethod = paymentOptions.find((item) => item.id === paymentMethod) || paymentOptions[0];
  const finalFiles = data?.delivery_files || [];
  const photos = finalFiles.filter(file => file.file_type === 'PHOTO');
  const videos = finalFiles.filter(file => file.file_type === 'VIDEO');
  const documents = finalFiles.filter(file => file.file_type === 'DOCUMENT');
  const photoItems = useMemo(() => data ? deliveryPreviews(data, 'PHOTO') : [], [data]);
  const videoItems = useMemo(() => data ? deliveryPreviews(data, 'VIDEO') : [], [data]);
  const activeItems = view === 'photos' ? photoItems : view === 'videos' ? videoItems : [];

  useEffect(() => {
    if (!data?.id) return;
    let alive = true;
    const sync = async () => {
      try {
        const policy = await getRecoveryPolicy(data.id, token, previewMode ? adminPreviewToken : undefined);
        if (alive && policy?.server_now && Number.isFinite(Date.parse(policy.server_now))) setServerOffset(Date.parse(policy.server_now) - Date.now());
        if (alive && policy?.whatsapp_number) setSupportPhone(policy.whatsapp_number);
      } catch { /* The media API remains authoritative if clock sync is unavailable. */ }
    };
    void sync();
    const refresh = async () => {
      if (document.hidden) return;
      void sync();
      try {
        const latest = previewMode && adminPreviewToken ? await getDeliveryPreviewPortal(token, adminPreviewToken) : await getDeliveryPortal(token);
        if (alive) setData(latest);
      } catch { /* Keep the last view; every download is authorized again on the server. */ }
    };
    const timer = window.setInterval(() => void refresh(), 60000);
    window.addEventListener('focus', refresh);
    return () => { alive = false; window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [data?.id, token, previewMode, adminPreviewToken]);

  useEffect(() => {
    if (!data) return;
    setAmount(isAccessPayment ? String(selectedDays * dailyFee) : remaining > 0 ? String(remaining) : '');
    if (!paymentOptions.some((item) => item.id === paymentMethod) && paymentOptions[0]) setPaymentMethod(paymentOptions[0].id);
  }, [data, remaining, paymentOptions.length, isAccessPayment, selectedDays, dailyFee]);

  useEffect(() => {
    if (!previewMode || !adminPreviewToken || view !== 'photos' || data?.is_published !== false) { setAdminPreviewSources({}); return; }
    let cancelled = false;
    const urls: string[] = [];
    const sources: Record<string, string> = {};
    const files = photoItems.flatMap(item => item.file ? [item.file] : []);
    const run = async () => {
      let cursor = 0;
      await Promise.all(Array.from({ length: Math.min(6, files.length) }, async () => {
        while (!cancelled && cursor < files.length) {
          const file = files[cursor++];
          try {
            const response = await fetch(mediaUrl(token, file.id, 'PREVIEW'), { headers: { 'x-admin-token': adminPreviewToken } });
            if (!response.ok) continue;
            const url = URL.createObjectURL(await response.blob());
            if (cancelled) { URL.revokeObjectURL(url); return; }
            urls.push(url); sources[file.id] = url;
            setAdminPreviewSources({ ...sources });
          } catch { /* An unavailable thumbnail does not hide the rest of the gallery. */ }
        }
      }));
    };
    void run();
    return () => { cancelled = true; urls.forEach(URL.revokeObjectURL); };
  }, [previewMode, adminPreviewToken, token, view, photoItems, data?.is_published]);

  function fileCanDownload(file: DeliveryFinalFile) {
    return Boolean(data && deliveryFileAllowed(file, data, clock + serverOffset));
  }
  function previewSource(item: DeliveryPreview) {
    return item.file ? previewMode && data?.is_published === false ? adminPreviewSources[item.file.id] || '' : mediaUrl(token, item.file.id, 'PREVIEW') : item.source || '';
  }
  const resolvePreview = useCallback(async (item: DeliveryPreview) => {
    if (!item.file) return item.source || "";
    if (!previewMode || data?.is_published !== false) return mediaUrl(token, item.file.id, "PREVIEW");
    if (item.file.file_type === 'VIDEO' && Number(item.file.file_size_bytes) > 100 * 1024 * 1024) throw new Error('এই বড় ভিডিওর প্রিভিউ দেখতে private delivery লিংক প্রকাশ করে খুলুন। ফাইল সবার তালিকায় প্রকাশ করার প্রয়োজন নেই।');
    const response = await fetch(mediaUrl(token, item.file.id, 'PREVIEW'), { headers: { 'x-admin-token': adminPreviewToken } });
    if (!response.ok) throw new Error('প্রিভিউ খোলা যায়নি। ফাইল ও অনুমতি পরীক্ষা করুন।');
    return URL.createObjectURL(await response.blob());
  }, [previewMode, token, adminPreviewToken, data?.is_published]);
  async function downloadZip(files: DeliveryFinalFile[], fileName: string) {
    if (!canDownload || !files.length || downloading) return;
    if (needsNativeBulkDownload(files)) { setBulkFiles(files); setDownloadError(''); window.requestAnimationFrame(() => document.querySelector('[aria-label="Download all original files"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })); return; }
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
    const link = document.createElement('a');
    link.href = mediaUrl(token, file.id, 'ORIGINAL');
    link.download = file.file_name || file.title || 'ramyachobi-file'; link.referrerPolicy = 'no-referrer';
    document.body.appendChild(link); link.click(); link.remove();
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
  const freeDays = accessExpiry ? Math.max(0, Math.ceil((Date.parse(accessExpiry) - clock - serverOffset) / 86400000)) : null;
  const allowedFiles = finalFiles.filter(fileCanDownload);
  const statusColor = unavailable || locked ? 'bg-stone-200 text-stone-700' : canDownload ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800';
  const href = (page: 'main' | 'photos' | 'videos' | 'recovery') => deliveryPath(token, page, previewMode);
  if (view !== 'main') return <main className="min-h-screen bg-[#f6f2ea] text-stone-900"><header className="border-b border-stone-200 bg-white px-5 py-6"><div className="mx-auto max-w-6xl"><p className="text-xs font-bold tracking-widest text-emerald-800">RAMYACHOBI · PRIVATE DELIVERY</p><h1 className="mt-2 text-2xl font-bold">{data.client_name}</h1><p className="mt-2 text-sm text-stone-500">{data.event_name || 'Final Delivery'} · {date(data.event_date)}</p>{previewMode && <p className="mt-2 text-sm text-amber-800">Admin preview</p>}</div></header><div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-8">
    {view === 'recovery' ? <><a href={href('main')} className="inline-block rounded-xl border bg-white px-4 py-3 font-bold">← মূল ডেলিভারি পেজে ফিরুন</a><h2 className="text-2xl font-bold">File Recovery / অ্যাক্সেসের সাহায্য</h2><DeliveryRecoveryNotice portalId={data.id} clientToken={token} expiresAt={accessExpiry} title={data.event_name || data.client_name} /></> : <>
      <DeliveryCountdown expiresAt={accessExpiry} serverOffset={serverOffset} />
      {bulkFiles.length > 0 && <DeliveryBulkDownloads files={bulkFiles} allowed={fileCanDownload} onDownload={downloadOne} onClose={() => setBulkFiles([])} />}
      <DeliveryPreviewGallery kind={view === 'photos' ? 'PHOTO' : 'VIDEO'} items={unavailable ? [] : activeItems} backHref={href('main')} source={previewSource} resolveSource={resolvePreview} allowed={fileCanDownload} onDownload={file => void downloadOne(file)} onDownloadAll={() => void downloadZip((view === 'photos' ? photos : videos).filter(fileCanDownload), `ramyachobi-${view}.zip`)} busy={downloading} error={downloadError} previewEnabled={!unavailable && data.preview_enabled !== false} />
    </>}
  </div></main>;

  return (
    <main className="min-h-screen bg-[#f6f2ea] text-[#292820]">
      {previewMode && <div className="bg-amber-200 px-4 py-2 text-center text-xs font-bold text-amber-950">Admin preview · unpublished delivery</div>}
      <header className="relative isolate overflow-hidden bg-[#292820] text-white">
        <img src={data.hero_image_url || fallbackHero} alt="Event cover" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-black/30" />
        <div className="relative mx-auto max-w-6xl px-5 py-6 sm:px-8 sm:py-8">
          <div className="flex items-center justify-between gap-4"><div><div className="text-lg font-semibold tracking-[.18em]">RAMYACHOBI</div><div className="mt-1 text-[10px] uppercase tracking-[.24em] text-white/60">Photography · Cinematography</div></div><span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs">Private delivery</span></div>
          <div className="mt-7 max-w-2xl sm:mt-9">
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
        <DeliveryCountdown expiresAt={accessExpiry} serverOffset={serverOffset} />
        {data.client_message && <div className="rounded-2xl border border-[#e8dfcf] bg-white p-4 text-sm leading-6"><strong>Message from RamyaChobi</strong><p className="mt-1 whitespace-pre-line text-stone-600">{data.client_message}</p></div>}
        {bulkFiles.length > 0 && <DeliveryBulkDownloads files={bulkFiles} allowed={fileCanDownload} onDownload={downloadOne} onClose={() => setBulkFiles([])} />}
        <section aria-label="Your delivery files" className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7"><h2 className="text-xl font-bold">আপনার ছবি ও ভিডিও / Your memories</h2><p className="mt-2 text-sm text-stone-500">আলাদাভাবে ছবি বা ভিডিও দেখুন। সংরক্ষণ করতে Download চাপুন।</p><div className="mt-5 grid gap-3 sm:grid-cols-3">
          <a href={href('photos')} className="flex min-h-28 flex-col justify-center rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950"><ImageIcon className="mb-3 h-7 w-7" /><strong>Preview Photos</strong><span className="mt-1 text-sm">ছবি দেখুন · {photoItems.length}টি</span></a>
          <a href={href('videos')} className="flex min-h-28 flex-col justify-center rounded-2xl border border-stone-200 bg-stone-50 p-5"><PlayCircle className="mb-3 h-7 w-7" /><strong>Preview Videos</strong><span className="mt-1 text-sm text-stone-600">ভিডিও দেখুন · {videoItems.length}টি</span></a>
          <button type="button" onClick={() => void downloadZip(allowedFiles, 'ramyachobi-all-files.zip')} disabled={!allowedFiles.length || downloading} className="flex min-h-28 flex-col items-start justify-center rounded-2xl bg-emerald-800 p-5 text-left text-white disabled:opacity-40"><Download className="mb-3 h-7 w-7" /><strong>{downloading ? 'ডাউনলোড প্রস্তুত হচ্ছে…' : 'Download All Files'}</strong><span className="mt-1 text-sm">সব অনুমোদিত ফাইল · {allowedFiles.length}টি</span></button>
        </div>{!allowedFiles.length && <p className="mt-4 text-sm text-stone-600">ফাইল প্রস্তুত, পেমেন্ট যাচাই ও ডাউনলোডের অনুমতি চালু হলে Download বাটন কাজ করবে।</p>}{downloadError && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{downloadError}</p>}
        {documents.length > 0 && <details className="mt-5 rounded-xl border border-stone-200 p-4"><summary className="cursor-pointer font-bold">কাগজপত্র / Documents ({documents.length})</summary><div className="mt-3 space-y-2">{documents.map(file => <div key={file.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-stone-50 p-3"><span className="break-all text-sm">{file.title || file.file_name || 'Document'}</span><button type="button" disabled={!fileCanDownload(file) || downloading} onClick={() => void downloadOne(file)} className="min-h-11 rounded-xl border bg-white px-4 py-2 text-sm font-bold disabled:opacity-40">Download</button></div>)}</div></details>}
        </section>

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
          <div className="rounded-2xl bg-[#ebe4d7] p-5"><h2 className="text-lg font-semibold">Need help?</h2><p className="mt-1 text-sm leading-6 text-stone-600">Contact RamyaChobi about payments, delivery status, or access dates.</p>{supportPhone && <a href={phoneHref(supportPhone)} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#292820] px-4 py-3 text-sm font-bold text-white"><MessageCircle className="h-4 w-4"/>WhatsApp support</a>}<div className="mt-5 flex items-start gap-2 border-t border-stone-300 pt-4 text-xs leading-5 text-stone-600"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-700"/>Original files stay in private Drive storage. This page never receives a Google login or direct Drive credential.</div></div>
        </section>
        <section className="rounded-2xl border border-stone-200 bg-white p-5"><h2 className="text-lg font-bold">File Recovery / আবার ফাইল পেতে চান?</h2><p className="mt-2 text-sm text-stone-600">মেয়াদ শেষ হলে বা পুরোনো ফাইলের প্রয়োজন হলে আলাদা রিকভারি অংশে নির্দেশনা দেখুন।</p><a href={href('recovery')} className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-stone-300 px-4 py-2 text-sm font-bold">রিকভারি ও অ্যাক্সেসের সাহায্য →</a></section>
        <section className="rounded-2xl bg-white p-6 text-center"><h2 className="text-xl font-bold">আপনার অভিজ্ঞতা জানান</h2><p className="mb-4 mt-2 text-sm text-stone-500">Facebook-এ রিভিউ লিখুন অথবা আমাদের পেজ Like / Follow করুন। এটি ঐচ্ছিক।</p><FacebookPageActions /></section>
        <footer className="pb-4 text-center text-[11px] text-stone-500">RamyaChobi · Private client delivery</footer>
      </div>


    </main>
  );
}
