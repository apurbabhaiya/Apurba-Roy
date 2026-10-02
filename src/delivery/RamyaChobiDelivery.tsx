import React, { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Copy,
  Download,
  Eye,
  FileArchive,
  Image as ImageIcon,
  LockKeyhole,
  PlayCircle,
  ShieldCheck,
  Smartphone,
  WalletCards,
} from 'lucide-react';
import {
  DeliveryPortalData,
  getDeliveryPortal,
  submitDeliveryPayment,
} from '../services/deliveryPortalService';

const fallbackHero =
  'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1800&q=85';

const faq = [
  ['When will I receive Final Delivery?', 'Final Delivery is activated after your complete package payment has been verified.'],
  ['How long is free gallery access?', 'You receive 30 days of complimentary viewing and download access from the Final Delivery date.'],
  ['What happens after 30 days?', 'Gallery and download access lock automatically. If your files are still retained, you can restore access for ৳20 per day.'],
  ['Does access expiry mean my files are deleted?', 'No. Gallery access expiry and file deletion are separate. Files follow RamyaChobi\'s storage retention policy.'],
];

function money(value: number | string | undefined | null) {
  const num = Number(value || 0);
  return new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency: 'BDT',
    maximumFractionDigits: 0,
  }).format(num);
}

function fmtDate(value?: string | null) {
  if (!value) return 'Not set';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
}

function daysRemaining(value?: string | null) {
  if (!value) return null;
  return Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 86400000));
}

function StatCard(props: { label: string; value: React.ReactNode; note?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
      <div className="text-xs uppercase tracking-[0.16em] text-white/60">{props.label}</div>
      <div className="mt-1 text-lg font-semibold text-white">{props.value}</div>
      {props.note && <div className="mt-1 text-xs text-white/55">{props.note}</div>}
    </div>
  );
}

export default function RamyaChobiDelivery({ token }: { token: string }) {
  const [data, setData] = useState<DeliveryPortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [paymentMessage, setPaymentMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [payerPhone, setPayerPhone] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [selectedDays, setSelectedDays] = useState(1);
  const [amount, setAmount] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  async function load() {
    setLoading(true);
    setPageError('');
    try {
      const result = await getDeliveryPortal(token);
      if (!result) {
        setPageError('This private delivery link is invalid or no longer available.');
        setData(null);
      } else {
        setData(result);
      }
    } catch (error: any) {
      setPageError(error?.message || 'Unable to load this delivery page.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [token]);

  const galleryStatus = data?.gallery_status || 'PREVIEW';
  const isLocked = galleryStatus === 'LOCKED';
  const isUnavailable = galleryStatus === 'UNAVAILABLE';
  const temporaryActive = galleryStatus === 'TEMPORARILY_ACTIVE';
  const canDownload = data?.download_status === 'ENABLED' && !isUnavailable;
  const isFullyPaid = data?.payment_status === 'FULLY_PAID';
  const freeDays = daysRemaining(data?.free_access_expires_at);
  const temporaryDays = daysRemaining(data?.access_expires_at);
  const feePerDay = Number(data?.access_fee_per_day || 20);
  const remainingDue = Number(data?.remaining_due || 0);
  const isAccessPayment = isLocked && !isUnavailable;

  useEffect(() => {
    if (!data) return;
    if (isAccessPayment) {
      setAmount(String(selectedDays * feePerDay));
    } else {
      setAmount(remainingDue > 0 ? String(remainingDue) : '');
    }
  }, [data, isAccessPayment, selectedDays, feePerDay, remainingDue]);

  const statusText = useMemo(() => {
    if (isUnavailable) return 'Storage period ended';
    if (temporaryActive) return 'Temporary access active';
    if (isLocked) return 'Gallery access expired';
    if (canDownload) return 'Final delivery active';
    if (data?.payment_status === 'SUBMITTED') return 'Payment submitted';
    return 'Payment pending';
  }, [isUnavailable, temporaryActive, isLocked, canDownload, data?.payment_status]);

  async function submitPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!data || !payerPhone.trim() || !transactionId.trim() || !amount) {
      setPaymentMessage('Please complete mobile number, transaction ID and amount.');
      return;
    }

    setSubmitting(true);
    setPaymentMessage('');
    try {
      await submitDeliveryPayment({
        token,
        paymentType: isAccessPayment ? 'ACCESS' : 'PACKAGE',
        payerPhone: payerPhone.trim(),
        transactionId: transactionId.trim(),
        amount: Number(amount),
        selectedDays: isAccessPayment ? selectedDays : null,
      });
      setPaymentMessage('Payment submitted successfully. RamyaChobi will verify it before access changes.');
      setTransactionId('');
      await load();
    } catch (error: any) {
      setPaymentMessage(error?.message || 'Payment submission failed.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-white/20 border-t-amber-300" />
          <p className="mt-4 text-sm text-white/60">Loading your private RamyaChobi delivery...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-stone-950 px-6 text-white flex items-center justify-center">
        <div className="max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
          <LockKeyhole className="mx-auto h-10 w-10 text-amber-300" />
          <h1 className="mt-4 text-2xl font-semibold">Private Gallery Unavailable</h1>
          <p className="mt-3 text-white/60">{pageError}</p>
        </div>
      </div>
    );
  }

  const previews = data.preview_items || [];

  return (
    <div className="min-h-screen bg-[#f6f2ea] text-stone-900">
      <section className="relative isolate overflow-hidden bg-stone-950 text-white">
        <img
          src={data.hero_image_url || fallbackHero}
          alt="RamyaChobi wedding photography"
          className="absolute inset-0 h-full w-full object-cover opacity-45"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/60 to-stone-950" />
        <div className="relative mx-auto max-w-7xl px-5 pb-12 pt-6 sm:px-8 lg:px-10 lg:pb-16">
          <nav className="flex items-center justify-between">
            <div>
              <div className="text-xl font-semibold tracking-[0.18em]">RAMYACHOBI</div>
              <div className="mt-1 text-xs uppercase tracking-[0.28em] text-white/55">Photography & Videography</div>
            </div>
            <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium backdrop-blur">
              Private Delivery
            </div>
          </nav>

          <div className="mt-20 max-w-3xl lg:mt-28">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-200/20 bg-amber-100/10 px-3 py-1.5 text-xs font-medium text-amber-100">
              <ShieldCheck className="h-4 w-4" /> Secure client access
            </div>
            <h1 className="text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">Your Memories Are Ready</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/70 sm:text-lg">
              View your gallery, complete payment when required, and securely access your final photos and videos.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <StatCard label="Client" value={data.client_name} />
              <StatCard label="Status" value={statusText} />
              <StatCard
                label="Access"
                value={
                  temporaryActive
                    ? `${temporaryDays ?? 0} day${temporaryDays === 1 ? '' : 's'} left`
                    : canDownload
                      ? `${freeDays ?? 0} day${freeDays === 1 ? '' : 's'} left`
                      : isLocked
                        ? 'Locked'
                        : 'Preview only'
                }
              />
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl space-y-8 px-5 py-8 sm:px-8 lg:px-10 lg:py-12">
        <section className="grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
          <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Client Delivery</p>
                <h2 className="mt-2 text-2xl font-semibold">{data.client_name}</h2>
                <p className="mt-1 text-stone-500">{data.event_name || 'Photography & Videography'}</p>
              </div>
              <div className="rounded-2xl bg-stone-950 px-4 py-3 text-right text-white">
                <div className="text-xs uppercase tracking-[0.15em] text-white/50">Gallery</div>
                <div className="mt-1 font-semibold">{galleryStatus.replaceAll('_', ' ')}</div>
              </div>
            </div>

            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-stone-50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold"><CalendarDays className="h-4 w-4" /> Event date</div>
                <div className="mt-2 text-stone-600">{fmtDate(data.event_date)}</div>
              </div>
              <div className="rounded-2xl bg-stone-50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold"><BadgeCheck className="h-4 w-4" /> Package</div>
                <div className="mt-2 text-stone-600">{data.package_name || 'Custom Package'}</div>
              </div>
            </div>

            {data.final_delivery_at && (
              <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-center gap-2 font-semibold text-emerald-900">
                  <CheckCircle2 className="h-5 w-5" /> Final Delivery
                </div>
                <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                  <div><span className="block text-emerald-700">Delivered</span><strong>{fmtDate(data.final_delivery_at)}</strong></div>
                  <div><span className="block text-emerald-700">Free access expires</span><strong>{fmtDate(data.free_access_expires_at)}</strong></div>
                  <div><span className="block text-emerald-700">Days remaining</span><strong>{freeDays ?? 0}</strong></div>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-3xl bg-stone-950 p-6 text-white shadow-sm sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Payment Summary</p>
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between text-white/65"><span>Package price</span><strong className="text-white">{money(data.package_price)}</strong></div>
              <div className="flex items-center justify-between text-white/65"><span>Advance paid</span><strong className="text-white">{money(data.advance_paid)}</strong></div>
              <div className="flex items-center justify-between text-white/65"><span>Verified total paid</span><strong className="text-white">{money(data.verified_total_paid)}</strong></div>
              <div className="border-t border-white/10 pt-4 flex items-center justify-between">
                <span className="font-semibold">Remaining due</span>
                <strong className="text-2xl text-amber-300">{money(data.remaining_due)}</strong>
              </div>
            </div>
            <div className="mt-6 rounded-2xl bg-white/5 p-4 text-sm text-white/65">
              Original downloads remain locked until package payment is fully verified and Final Delivery is activated.
            </div>
          </div>
        </section>

        {isUnavailable ? (
          <section className="rounded-3xl border border-red-200 bg-red-50 p-7 text-center">
            <LockKeyhole className="mx-auto h-10 w-10 text-red-500" />
            <h2 className="mt-3 text-2xl font-semibold text-red-950">This Gallery Is No Longer Available</h2>
            <p className="mx-auto mt-2 max-w-2xl text-red-800/75">
              The file-retention period has ended. Access restoration is no longer available.
            </p>
          </section>
        ) : isLocked ? (
          <section className="rounded-3xl border border-amber-200 bg-amber-50 p-7 sm:p-8">
            <div className="grid gap-8 lg:grid-cols-[1fr_.9fr]">
              <div>
                <LockKeyhole className="h-10 w-10 text-amber-700" />
                <h2 className="mt-4 text-3xl font-semibold">Your Gallery Access Has Expired</h2>
                <p className="mt-3 max-w-xl leading-7 text-stone-600">
                  Your complimentary 30-day Final Delivery period has ended. If your files are still retained, you can restore viewing and download access for {money(feePerDay)} per day.
                </p>
                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[1, 2, 3, 5, 7].map((day) => (
                    <button
                      type="button"
                      key={day}
                      onClick={() => setSelectedDays(day)}
                      className={`rounded-2xl border px-4 py-3 text-left transition ${selectedDays === day ? 'border-stone-950 bg-stone-950 text-white' : 'border-amber-200 bg-white hover:border-stone-400'}`}
                    >
                      <div className="font-semibold">{day} Day{day > 1 ? 's' : ''}</div>
                      <div className={`mt-1 text-sm ${selectedDays === day ? 'text-amber-300' : 'text-stone-500'}`}>{money(day * feePerDay)}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <div className="text-sm text-stone-500">Selected access</div>
                <div className="mt-1 text-2xl font-semibold">{selectedDays} day{selectedDays > 1 ? 's' : ''}</div>
                <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-4">
                  <span>Total access fee</span>
                  <strong className="text-2xl">{money(selectedDays * feePerDay)}</strong>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Private Gallery</p>
                <h2 className="mt-2 text-2xl font-semibold">{canDownload ? 'Final Gallery' : 'Protected Preview Gallery'}</h2>
                <p className="mt-1 text-stone-500">
                  {canDownload ? 'Your verified final delivery is active.' : 'Preview media is protected. Original downloads unlock after full payment verification.'}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  disabled={!canDownload}
                  className="inline-flex items-center gap-2 rounded-xl bg-stone-950 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-500"
                  title={canDownload ? 'Secure Drive download endpoint can be attached here' : 'Locked until Final Delivery'}
                >
                  <Download className="h-4 w-4" /> Download All
                </button>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {previews.map((item, index) => (
                <div key={index} className="group relative aspect-[4/3] overflow-hidden rounded-2xl bg-stone-100">
                  <img src={item.url} alt={item.title || `Gallery item ${index + 1}`} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                  {!canDownload && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                      <span className="-rotate-12 rounded bg-black/45 px-2 py-1 text-xs font-semibold tracking-[0.18em] text-white">RAMYACHOBI PREVIEW</span>
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[11px] font-medium text-white backdrop-blur">
                    {item.type === 'video' ? <PlayCircle className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
                    {item.type === 'video' ? 'Video' : 'Photo'}
                  </div>
                </div>
              ))}
            </div>

            {!canDownload && (
              <div className="mt-5 flex items-start gap-3 rounded-2xl bg-stone-50 p-4 text-sm text-stone-600">
                <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-stone-800" />
                <div><strong className="text-stone-900">Preview only.</strong> Original files remain protected until payment is verified and Final Delivery is activated.</div>
              </div>
            )}
          </section>
        )}

        {!isUnavailable && (!isFullyPaid || isLocked) && (
          <section id="payment" className="grid gap-6 lg:grid-cols-[.85fr_1.15fr]">
            <div className="rounded-3xl bg-[#c9002b] p-6 text-white sm:p-8">
              <WalletCards className="h-9 w-9" />
              <h2 className="mt-4 text-2xl font-semibold">{isAccessPayment ? 'Restore Gallery Access' : 'Complete Your Payment'}</h2>
              <p className="mt-2 text-white/75">
                Send Money to bKash, then submit the payer mobile number and transaction ID for verification.
              </p>
              <div className="mt-6 rounded-2xl bg-white/10 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-white/60">bKash Send Money</div>
                <div className="mt-2 flex items-center justify-between gap-4">
                  <div className="text-2xl font-semibold">{data.bkash_number || '01XXXXXXXXX'}</div>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(data.bkash_number || '')}
                    className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-[#c9002b]"
                  >
                    <Copy className="mr-1 inline h-4 w-4" /> Copy
                  </button>
                </div>
              </div>
              <div className="mt-5 text-sm leading-6 text-white/70">
                Submission does not unlock access automatically. RamyaChobi verifies each transaction first.
              </div>
            </div>

            <form onSubmit={submitPayment} className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold">Payer Mobile Number</span>
                  <input value={payerPhone} onChange={(e) => setPayerPhone(e.target.value)} className="w-full rounded-xl border border-stone-300 px-3.5 py-3 outline-none focus:border-stone-950" placeholder="01XXXXXXXXX" />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold">Transaction ID</span>
                  <input value={transactionId} onChange={(e) => setTransactionId(e.target.value)} className="w-full rounded-xl border border-stone-300 px-3.5 py-3 outline-none focus:border-stone-950" placeholder="e.g. 9ABCD12EFG" />
                </label>
                {isAccessPayment && (
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-semibold">Access Days</span>
                    <select value={selectedDays} onChange={(e) => setSelectedDays(Number(e.target.value))} className="w-full rounded-xl border border-stone-300 px-3.5 py-3 outline-none focus:border-stone-950">
                      {[1,2,3,5,7].map((d) => <option key={d} value={d}>{d} day{d > 1 ? 's' : ''} · {money(d * feePerDay)}</option>)}
                    </select>
                  </label>
                )}
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold">Paid Amount</span>
                  <input value={amount} onChange={(e) => setAmount(e.target.value)} readOnly={isAccessPayment} type="number" min="1" className="w-full rounded-xl border border-stone-300 px-3.5 py-3 outline-none focus:border-stone-950 read-only:bg-stone-50" />
                </label>
              </div>

              <button disabled={submitting} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-stone-950 px-4 py-3 font-semibold text-white disabled:opacity-50">
                <Smartphone className="h-4 w-4" />
                {submitting ? 'Submitting...' : isAccessPayment ? 'Submit Access Payment' : 'Submit Package Payment'}
              </button>

              {paymentMessage && (
                <div className="mt-4 rounded-xl bg-stone-50 p-3 text-sm text-stone-700">{paymentMessage}</div>
              )}
            </form>
          </section>
        )}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [ShieldCheck, 'Private Gallery', 'Private client link with protected access logic.'],
            [BadgeCheck, 'Payment Verification', 'Access changes only after payment verification.'],
            [LockKeyhole, 'Protected Originals', 'Original Google Drive files are not exposed through the landing page.'],
            [Clock3, 'Limited Retention', 'Gallery access and actual file retention are managed separately.'],
          ].map(([Icon, title, text]: any) => (
            <div key={title} className="rounded-2xl border border-stone-200 bg-white p-5">
              <Icon className="h-6 w-6 text-amber-700" />
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="mt-1 text-sm leading-6 text-stone-500">{text}</p>
            </div>
          ))}
        </section>

        <section className="rounded-3xl border border-stone-200 bg-white p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <FileArchive className="h-7 w-7 text-amber-700" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Final Delivery Policy</p>
              <h2 className="mt-1 text-2xl font-semibold">Client Access Policy</h2>
            </div>
          </div>
          <div className="mt-6 grid gap-3 text-sm leading-6 text-stone-600 md:grid-cols-2">
            {[
              'Final photos and videos are released after full package payment is completed and verified.',
              'From the Final Delivery date, clients receive 30 days of complimentary viewing and download access.',
              'Clients should download and securely back up their files during the complimentary period.',
              'After 30 days, Gallery and Download Access lock automatically.',
              'If files are still retained, gallery access may be restored for ৳20 per day.',
              'Each additional day of restored access requires an additional ৳20.',
              'The Access Restoration Fee is separate from the original photography or videography package fee.',
              'Files may be permanently deleted after the applicable RamyaChobi storage-retention period.',
            ].map((item) => (
              <div key={item} className="flex gap-2 rounded-xl bg-stone-50 p-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl bg-stone-950 p-6 text-white sm:p-8">
          <h2 className="text-2xl font-semibold">Frequently Asked Questions</h2>
          <div className="mt-5 divide-y divide-white/10">
            {faq.map(([q, a], index) => (
              <button key={q} type="button" onClick={() => setOpenFaq(openFaq === index ? null : index)} className="w-full py-4 text-left">
                <div className="flex items-center justify-between gap-4">
                  <span className="font-medium">{q}</span>
                  <ChevronDown className={`h-5 w-5 transition ${openFaq === index ? 'rotate-180' : ''}`} />
                </div>
                {openFaq === index && <p className="mt-2 max-w-3xl text-sm leading-6 text-white/60">{a}</p>}
              </button>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-stone-200 bg-white px-5 py-8 text-center text-sm text-stone-500">
        <div className="font-semibold tracking-[0.16em] text-stone-900">RAMYACHOBI</div>
        <div className="mt-2">Photography & Videography · Private Client Delivery</div>
        <div className="mt-2">© 2026 RamyaChobi. All Rights Reserved.</div>
      </footer>
    </div>
  );
}
