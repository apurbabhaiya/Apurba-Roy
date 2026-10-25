import React, { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Loader2, Send, TicketCheck } from 'lucide-react';
import { claimSmartphone, createSpinDraw, defaultSpinGameConfig, getSpinGamePublicConfig, submitSpinResult, type SpinGameConfig } from '../services/spinResultService';

const prizeLines: Record<string, string[]> = {
  '5% OFF': ['5%', 'OFF'],
  '1 FREE EDIT': ['FREE', 'EDIT'],
  '1 FREE PRINT': ['FREE', 'PRINT'],
  'TRY AGAIN': ['TRY', 'AGAIN'],
};
const fieldClass = 'mt-1 min-h-12 w-full min-w-0 rounded-xl border border-stone-300 bg-white px-3 py-3 text-base text-[#19382e] outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15';

function pointAt(degrees: number, radius: number) {
  const radians = degrees * Math.PI / 180;
  return { x: 200 + radius * Math.cos(radians), y: 200 + radius * Math.sin(radians) };
}

function wheelPath(index: number, count: number) {
  const segmentAngle = 360 / count;
  const start = -90 + index * segmentAngle;
  const end = start + segmentAngle;
  const a = pointAt(start, 184);
  const b = pointAt(end, 184);
  return `M 200 200 L ${a.x.toFixed(2)} ${a.y.toFixed(2)} A 184 184 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)} Z`;
}

export default function SpinResultSubmission() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [link, setLink] = useState('');
  const [result, setResult] = useState('');
  const [resultRevealed, setResultRevealed] = useState(false);
  const [drawId, setDrawId] = useState('');
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [eligible, setEligible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [campaign, setCampaign] = useState<SpinGameConfig>(defaultSpinGameConfig);
  const [pointsAwarded, setPointsAwarded] = useState(0);
  const [pointsBalance, setPointsBalance] = useState(0);
  const [claimName, setClaimName] = useState('');
  const [claimAddress, setClaimAddress] = useState('');
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimSent, setClaimSent] = useState(false);

  useEffect(() => {
    getSpinGamePublicConfig().then(setCampaign).catch(() => undefined);
  }, []);

  const prizes = [...campaign.pointRewards.map(value => `POINTS ${value}`), '5% OFF', '1 FREE EDIT', '1 FREE PRINT', 'TRY AGAIN'];
  const segmentAngle = 360 / prizes.length;
  const progress = Math.min(100, (pointsBalance / Math.max(1, campaign.smartphoneGoal)) * 100);

  async function startSpin() {
    if (spinning || result) return;
    if (!phone.trim()) {
      setError('স্পিনের আগে মোবাইল নম্বর লিখুন।');
      return;
    }
    if (!eligible) {
      setError('স্পিনের আগে Facebook পোস্টের শর্তটি নিশ্চিত করুন।');
      return;
    }
    setError('');
    setSpinning(true);
    try {
      const draw = await createSpinDraw(phone.trim());
      const prizeIndex = prizes.indexOf(draw.prize);
      if (prizeIndex < 0) throw new Error('স্পিনের ফলাফল পাওয়া যায়নি। আবার চেষ্টা করুন।');
      setDrawId(draw.id);
      setPointsAwarded(draw.pointsAwarded || 0);
      setPointsBalance(draw.pointsBalance || 0);
      const middle = -90 + (prizeIndex + 0.5) * segmentAngle;
      const targetOffset = ((-90 - middle) % 360 + 360) % 360;
      const currentOffset = ((rotation % 360) + 360) % 360;
      const extraTurn = ((targetOffset - currentOffset) % 360 + 360) % 360;
      setRotation(rotation + 360 * 8 + extraTurn);
      window.setTimeout(() => {
        setResult(draw.prize);
        setSpinning(false);
      }, 6600);
    } catch (err: any) {
      setSpinning(false);
      setError(err?.message || 'স্পিন শুরু হয়নি। আবার চেষ্টা করুন।');
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !result || !drawId) return;
    setBusy(true);
    setError('');
    try {
      await submitSpinResult({ customerName: name.trim(), phone: phone.trim(), address: address.trim(), spinDrawId: drawId, campaignLink: link.trim() });
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.message || 'ফলাফল জমা হয়নি। আবার চেষ্টা করুন।');
    } finally {
      setBusy(false);
    }
  }

  async function onClaimSmartphone(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (claimBusy || pointsBalance < campaign.smartphoneGoal) return;
    setClaimBusy(true);
    setError('');
    try {
      await claimSmartphone({ customerName: claimName.trim(), phone: phone.trim(), address: claimAddress.trim() });
      setClaimSent(true);
    } catch (err: any) {
      setError(err?.message || 'স্মার্টফোন পুরস্কারের দাবি জমা হয়নি।');
    } finally {
      setClaimBusy(false);
    }
  }

  return (
    <main lang="bn" className="min-h-screen bg-[#f8f6ef] px-4 pb-48 pt-6 text-[#19382e] sm:px-6 sm:pb-12 sm:pt-10">
      <div className="mx-auto max-w-xl">
        <a href="/" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-emerald-900"><ArrowLeft className="h-4 w-4"/>হোম পেজে ফিরুন</a>
        <section className="mt-4 rounded-3xl border border-[#19382e]/10 bg-white p-5 shadow-sm sm:p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#193e32] text-[#efe4b8]"><TicketCheck className="h-6 w-6"/></div>
          {submitted ? (
            <div className="pt-5" role="status">
              <CheckCircle2 className="h-8 w-8 text-emerald-700"/>
              <h1 className="mt-3 text-2xl font-black">ফলাফল জমা হয়েছে</h1>
              <p className="mt-2 text-sm leading-7 text-stone-600">আপনার ফলাফল <strong>{result}</strong> এবং যোগাযোগের তথ্য অ্যাডমিন প্যানেলে পাঠানো হয়েছে। যাচাইয়ের পর টিম আপনার সঙ্গে যোগাযোগ করবে।</p>
              <a href="/" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-[#193e32] px-4 py-2 text-sm font-bold text-white">হোম পেজে ফিরুন</a>
            </div>
          ) : (
            <>
              <p className="mt-5 text-xs font-bold uppercase tracking-[.16em] text-[#8a6740]">RamyaChobi · Weekly Spin & Win</p>
              <h1 className="mt-2 text-2xl font-black sm:text-3xl">স্পিন করুন, ফলাফল জমা দিন</h1>
              <p className="mt-2 text-sm leading-7 text-stone-600">প্রথম ২০টি RamyaChobi Facebook পোস্টে Like ও Comment করা গ্রাহকের জন্য পুরস্কার প্রযোজ্য। অ্যাডমিন যাচাই করে আপনার সঙ্গে যোগাযোগ করবে।</p>

              <label className="mt-5 block text-sm font-bold">স্পিনের জন্য মোবাইল নম্বর<input required type="tel" inputMode="tel" autoComplete="tel" maxLength={30} disabled={spinning || Boolean(drawId)} className={fieldClass+" disabled:bg-stone-100 disabled:text-stone-500"} value={phone} onChange={(e) => { setPhone(e.target.value); setError(''); }} placeholder="01XXXXXXXXX"/><span className="mt-1 block text-xs font-normal leading-5 text-stone-500">একই নম্বরে ৭ দিনে একবার স্পিন করা যাবে।</span></label>
              <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl bg-[#f8f6ef] p-3 text-sm leading-6"><input type="checkbox" checked={eligible} onChange={e => { setEligible(e.target.checked); setError(''); }} className="mt-1 h-4 w-4 shrink-0 accent-emerald-800"/><span>আমি প্রথম ২০টি RamyaChobi Facebook পোস্টে Like ও Comment করেছি।</span></label>

              <div className="mb-4 rounded-2xl border border-[#19382e]/10 bg-[#f8f6ef] p-4">
                <div className="flex items-center justify-between gap-2"><span className="text-sm font-bold">স্মার্টফোন পুরস্কারের অগ্রগতি</span><span className="text-xs font-semibold">লক্ষ্য {campaign.smartphoneGoal.toLocaleString('bn-BD')}</span></div>
                <div className="mt-2 h-3 overflow-hidden rounded-full bg-stone-200"><div className="h-full rounded-full bg-emerald-700 transition-all" style={{width: `${progress}%`}}/></div>
                <p className="mt-2 text-sm">আপনার পয়েন্ট: <strong>{pointsBalance.toLocaleString('bn-BD')}</strong> · {campaign.smartphoneLabel}: {campaign.smartphoneGoal.toLocaleString('bn-BD')} পয়েন্ট</p>
              </div>
              <div className="mx-auto mt-6 w-full max-w-[390px]">
                <div className="relative mx-auto aspect-square w-full rounded-full bg-[#3a080c] p-2 shadow-[0_12px_30px_rgba(70,8,12,.25)]">
                  <svg viewBox="0 0 400 400" role="img" aria-label="RamyaChobi Spin and Win wheel" className="h-full w-full overflow-visible rounded-full" style={{ transform: `rotate(${rotation}deg)`, transition: spinning ? 'transform 6.5s cubic-bezier(.12,.78,.12,1)' : 'none' }}>
                    <circle cx="200" cy="200" r="196" fill="#5a1510" stroke="#e8bd58" strokeWidth="7"/>
                    {prizes.map((prize, index) => (
                      <path key={`slice-${prize}`} d={wheelPath(index, prizes.length)} fill={index % 2 === 0 ? '#a90d18' : '#fff8df'} stroke="#efcf79" strokeWidth="2.5"/>
                    ))}
                    {prizes.map((prize, index) => {
                      const middle = -90 + (index + 0.5) * segmentAngle;
                      const labelRotation = middle + 90 + (middle > 90 && middle < 270 ? 180 : 0);
                      const lines = prize.startsWith('POINTS ') ? [Number(prize.replace('POINTS ', '')).toLocaleString('bn-BD'), 'পয়েন্ট'] : (prizeLines[prize] || [prize]);
                      const startY = 68 - ((lines.length - 1) * 5.5);
                      return <g key={`label-${prize}`} transform={`rotate(${labelRotation} 200 200)`}>
                        <text x="200" y={startY} textAnchor="middle" fill={index % 2 === 0 ? '#fff8df' : '#94101a'} fontSize={prize === 'CHOCOLATE' ? '9' : '10'} fontWeight="900" letterSpacing=".1">
                          {lines.map((line, lineIndex) => <tspan key={line} x="200" dy={lineIndex === 0 ? 0 : 11} textLength={line.length > 7 ? 52 : undefined} lengthAdjust="spacingAndGlyphs">{line}</tspan>)}
                        </text>
                      </g>;
                    })}
                    <circle cx="200" cy="200" r="32" fill="#d29a2e" stroke="#ffedb0" strokeWidth="5"/>
                    <circle cx="200" cy="200" r="13" fill="#f9e7ae"/>
                  </svg>
                  <div aria-hidden="true" className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1"><div className="h-0 w-0 border-x-[15px] border-t-[30px] border-x-transparent border-t-[#f3c95f] drop-shadow-md"/></div>
                </div>
                <button type="button" onClick={startSpin} disabled={spinning || Boolean(result)} className="mt-4 min-h-12 w-full rounded-xl border border-[#d6ad58] bg-[#193e32] px-5 py-3 text-base font-black text-[#fff1bd] shadow-sm disabled:cursor-not-allowed disabled:opacity-70">{spinning ? 'চাকা ঘুরছে…' : result ? 'স্পিন সম্পন্ন' : 'স্পিন করুন'}</button>
                {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</p>}
                {result && !resultRevealed && <button type="button" onClick={() => setResultRevealed(true)} className="mt-3 min-h-12 w-full rounded-xl bg-[#f0d681] px-4 py-3 text-base font-black text-[#19382e] shadow-sm">🎁 ফলাফল দেখুন</button>}
                <div aria-live="polite" className="mt-3 min-h-14 rounded-xl border border-[#19382e]/15 bg-[#f8f6ef] px-4 py-3 text-center">
                  <p className="text-xs font-semibold text-stone-500">আপনার স্পিনের ফলাফল</p>
                  <p className="mt-1 break-words text-base font-black text-emerald-900">{result ? (resultRevealed ? result : 'ফলাফল দেখতে উপরের বাটনে চাপুন') : (spinning ? 'ফলাফল আসছে…' : 'স্পিন করলে ফলাফল এখানে নিজে থেকে দেখাবে')}</p>
                </div>
              </div>
              {result && resultRevealed && <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-center text-sm font-semibold text-emerald-900">{pointsAwarded > 0 ? `এই স্পিনে ${pointsAwarded.toLocaleString('bn-BD')} পয়েন্ট যোগ হয়েছে।` : 'এই স্পিনে পয়েন্ট পাওয়া যায়নি।'} মোট পয়েন্ট: {pointsBalance.toLocaleString('bn-BD')}</div>}
              {pointsBalance >= campaign.smartphoneGoal && !claimSent && <form onSubmit={(event) => void onClaimSmartphone(event)} className="mt-4 grid gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4">
                <h2 className="font-black">আপনি {campaign.smartphoneGoal.toLocaleString('bn-BD')} পয়েন্ট পূর্ণ করেছেন। {campaign.smartphoneLabel} দাবি করুন।</h2>
                <input required maxLength={120} value={claimName} onChange={e => setClaimName(e.target.value)} className={fieldClass} placeholder="আপনার নাম" />
                <textarea required maxLength={500} rows={2} value={claimAddress} onChange={e => setClaimAddress(e.target.value)} className={fieldClass+' min-h-20'} placeholder="আপনার ঠিকানা" />
                <button type="submit" disabled={claimBusy} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#193e32] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{claimBusy ? 'জমা হচ্ছে…' : 'স্মার্টফোন পুরস্কার দাবি করুন'}</button>
              </form>}
              {claimSent && <p role="status" className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">আপনার স্মার্টফোন পুরস্কারের দাবি অ্যাডমিনের কাছে জমা হয়েছে।</p>}

              <form onSubmit={(event) => void onSubmit(event)} className="mt-5 grid gap-4">
                <label className="text-sm font-bold">আপনার নাম<input required autoComplete="name" maxLength={120} className={fieldClass} value={name} onChange={(e) => setName(e.target.value)}/></label>
                
                <label className="text-sm font-bold">ঠিকানা<textarea required autoComplete="street-address" maxLength={500} rows={3} className={fieldClass+' min-h-24 resize-y'} value={address} onChange={(e) => setAddress(e.target.value)}/></label>
                <div className="text-sm font-bold">স্পিনে পাওয়া ফলাফল<div className={fieldClass+' flex items-center bg-stone-50 font-black text-emerald-900'} aria-live="polite">{result ? (resultRevealed ? result : 'ফলাফল দেখতে উপরের বাটনে চাপুন') : 'স্পিনের পর ফলাফল এখানে বসবে'}</div></div>
                <label className="text-sm font-bold">স্পিন / পোস্টের লিংক <span className="font-normal text-stone-500">(ঐচ্ছিক)</span><input type="url" maxLength={500} className={fieldClass} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..."/></label>
                <button type="submit" disabled={busy || spinning || !result || !resultRevealed || !drawId || !eligible} className="mt-1 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#193e32] px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{busy?<Loader2 className="h-4 w-4 animate-spin"/>:<Send className="h-4 w-4"/>}{busy?'জমা হচ্ছে…':'ফলাফল জমা দিন'}</button>
              </form>
            </>
          )}
          <aside className="mt-6 rounded-2xl border border-[#19382e]/10 bg-[#f8f6ef] p-4 text-center">
            <p className="text-[11px] font-bold uppercase tracking-[.14em] text-stone-500">স্পনসরড বিজ্ঞাপন</p>
            <p className="mt-1 text-sm leading-6 text-stone-600">বিজ্ঞাপনের অফারটি ঐচ্ছিক; ফলাফল দেখতে এটি চাপার প্রয়োজন নেই।</p>
            {campaign.adsterraUrl && <a href={campaign.adsterraUrl} target="_blank" rel="sponsored noopener noreferrer" className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#193e32] px-5 py-2.5 text-sm font-bold text-white">অফার দেখতে যান ↗</a>}
          </aside>
        </section>
      </div>
    </main>
  );
}
