import React, { useEffect, useState } from 'react';
import { Loader2, RefreshCw, Save, Search, Smartphone } from 'lucide-react';
import {
  defaultSpinGameConfig,
  getSmartphoneClaimsAdmin,
  getSpinGameAdminConfig,
  getSpinWalletAdmin,
  saveSpinGameAdminConfig,
  updateSmartphoneClaimAdmin,
  type SmartphoneClaim,
  type SpinGameConfig,
  type SpinWalletSnapshot,
} from '../services/spinResultService';

const inputClass = 'mt-1 min-h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-900';

export default function SpinLoyaltyAdmin({ adminToken }: { adminToken: string }) {
  const [config, setConfig] = useState<SpinGameConfig>(defaultSpinGameConfig);
  const [claims, setClaims] = useState<SmartphoneClaim[]>([]);
  const [walletPhone, setWalletPhone] = useState('');
  const [wallet, setWallet] = useState<SpinWalletSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [claimBusy, setClaimBusy] = useState('');

  async function load() {
    if (!adminToken) return;
    setLoading(true);
    setMessage('');
    try {
      const [nextConfig, nextClaims] = await Promise.all([
        getSpinGameAdminConfig(adminToken),
        getSmartphoneClaimsAdmin(adminToken),
      ]);
      setConfig(nextConfig);
      setClaims(nextClaims);
    } catch (error: any) {
      setMessage(error?.message || 'Spin settings লোড করা যায়নি।');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [adminToken]);

  async function save() {
    if (saving) return;
    setSaving(true);
    setMessage('');
    try {
      const saved = await saveSpinGameAdminConfig(adminToken, config);
      setConfig(saved);
      setMessage('Spin settings সেভ হয়েছে।');
    } catch (error: any) {
      setMessage(error?.message || 'Spin settings সেভ করা যায়নি।');
    } finally {
      setSaving(false);
    }
  }

  async function searchWallet(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      setWallet(await getSpinWalletAdmin(adminToken, walletPhone.trim()));
    } catch (error: any) {
      setWallet(null);
      setMessage(error?.message || 'পয়েন্ট ব্যালেন্স পাওয়া যায়নি।');
    } finally {
      setLoading(false);
    }
  }

  async function saveClaim(claim: SmartphoneClaim, status: SmartphoneClaim['status']) {
    if (claimBusy) return;
    setClaimBusy(claim.id);
    setMessage('');
    try {
      await updateSmartphoneClaimAdmin(adminToken, claim.id, status, claim.admin_note || '');
      setClaims(await getSmartphoneClaimsAdmin(adminToken));
      setMessage('পুরস্কারের দাবি আপডেট হয়েছে।');
    } catch (error: any) {
      setMessage(error?.message || 'দাবির অবস্থা আপডেট করা যায়নি।');
    } finally {
      setClaimBusy('');
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-emerald-900/15 bg-emerald-50/50 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-emerald-800"><Smartphone className="h-5 w-5"/></span>
          <div><h2 className="text-lg font-black text-stone-900">Spin & Win · পয়েন্ট সেটিংস</h2><p className="text-sm text-stone-600">পুরোনো ও নতুন গ্রাহক এখন থেকে স্পিন ও সম্পন্ন বুকিংয়ে পয়েন্ট জমাবেন। পুরোনো বুকিং থেকে পয়েন্ট যোগ হবে না।</p></div>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 text-sm font-bold text-stone-800 disabled:opacity-50"><RefreshCw className={'h-4 w-4 '+(loading?'animate-spin':'')}/>রিফ্রেশ</button>
      </div>

      <div className="grid gap-3 rounded-xl bg-white p-4 sm:grid-cols-2">
        <label className="text-sm font-bold text-stone-800">পুরস্কার<input value={config.smartphoneLabel} maxLength={80} onChange={e => setConfig({...config, smartphoneLabel:e.target.value})} className={inputClass}/></label>
        <label className="text-sm font-bold text-stone-800">লক্ষ্য পয়েন্ট<input type="number" min={1} value={config.smartphoneGoal} onChange={e => setConfig({...config, smartphoneGoal:Number(e.target.value)})} className={inputClass}/></label>
        <div className="sm:col-span-2"><p className="text-sm font-bold text-stone-800">স্পিনে পয়েন্ট</p><div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">{config.pointRewards.map((value,index) => <label key={index} className="text-xs font-semibold text-stone-600">ঘর {index+1}<input type="number" min={0} value={value} onChange={e => setConfig({...config,pointRewards:config.pointRewards.map((item,i)=>i===index?Number(e.target.value):item)})} className={inputClass}/></label>)}</div></div>
        <label className="text-sm font-bold text-stone-800">প্রতি সম্পন্ন বুকিংয়ে পয়েন্ট<input type="number" min={0} value={config.bookingPoints} onChange={e => setConfig({...config,bookingPoints:Number(e.target.value)})} className={inputClass}/><span className="mt-1 block text-xs font-normal text-stone-500">০ দিলে বুকিং থেকে পয়েন্ট যোগ হবে না।</span></label>
        <label className="text-sm font-bold text-stone-800 sm:col-span-2">ঐচ্ছিক Adsterra লিংক<input type="url" maxLength={500} value={config.adsterraUrl} onChange={e => setConfig({...config,adsterraUrl:e.target.value})} className={inputClass} placeholder="https://..."/><span className="mt-1 block text-xs font-normal text-stone-500">এই লিংক ফলাফল বা পয়েন্ট পাওয়ার শর্ত নয়।</span></label>
        <div className="sm:col-span-2 flex flex-wrap items-center gap-3"><button type="button" onClick={() => void save()} disabled={saving || loading} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#193e32] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving?<Loader2 className="h-4 w-4 animate-spin"/>:<Save className="h-4 w-4"/>}সেটিংস সেভ</button><span className="text-sm text-stone-600">১,০০,০০,০০০ পয়েন্টে {config.smartphoneLabel} দাবি করা যাবে।</span></div>
      </div>

      <form onSubmit={searchWallet} className="flex flex-col gap-2 rounded-xl bg-white p-4 sm:flex-row">
        <input value={walletPhone} onChange={e => setWalletPhone(e.target.value)} className={inputClass+' mt-0 flex-1'} placeholder="গ্রাহকের মোবাইল নম্বর" inputMode="tel"/>
        <button type="submit" disabled={loading} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-stone-300 px-3 text-sm font-bold text-stone-800 disabled:opacity-50"><Search className="h-4 w-4"/>পয়েন্ট দেখুন</button>
      </form>
      {wallet && <div className="rounded-xl bg-white p-4"><h3 className="font-black text-stone-900">{wallet.phone} · {wallet.pointsBalance.toLocaleString('bn-BD')} পয়েন্ট</h3><div className="mt-2 space-y-1 text-xs text-stone-600">{wallet.ledger.map((entry,index)=><p key={index}>{new Date(entry.created_at).toLocaleString('bn-BD')} · {entry.source_type==='booking'?'সম্পন্ন বুকিং':'স্পিন'} · {entry.points_delta>0?'+':''}{entry.points_delta.toLocaleString('bn-BD')} · মোট {entry.balance_after.toLocaleString('bn-BD')}</p>)}</div></div>}

      <div className="rounded-xl bg-white p-4">
        <h3 className="font-black text-stone-900">স্মার্টফোন পুরস্কারের দাবি ({claims.length})</h3>
        {claims.length===0 ? <p className="mt-2 text-sm text-stone-500">এখনও কোনো দাবি জমা হয়নি।</p> : <div className="mt-3 grid gap-3 xl:grid-cols-2">{claims.map(claim=><article key={claim.id} className="rounded-xl border border-stone-200 p-3"><div className="flex flex-wrap justify-between gap-2"><strong>{claim.customer_name}</strong><span className="text-xs font-bold">{claim.status}</span></div><p className="mt-1 text-sm">{claim.phone_normalized}</p><p className="text-sm">{claim.address}</p><textarea maxLength={2000} value={claim.admin_note||''} onChange={e=>setClaims(claims.map(item=>item.id===claim.id?{...item,admin_note:e.target.value}:item))} className={inputClass+' min-h-16'} placeholder="অ্যাডমিন নোট"/><div className="mt-2 flex gap-2"><select value={claim.status} onChange={e=>setClaims(claims.map(item=>item.id===claim.id?{...item,status:e.target.value as SmartphoneClaim['status']}:item))} className={inputClass+' mt-0 flex-1'}><option value="pending">নতুন</option><option value="verified">যাচাই হয়েছে</option><option value="redeemed">পুরস্কার দেওয়া হয়েছে</option><option value="rejected">বাতিল</option></select><button type="button" disabled={claimBusy===claim.id} onClick={()=>void saveClaim(claim,claim.status)} className="min-h-10 rounded-lg bg-[#193e32] px-3 text-sm font-bold text-white disabled:opacity-50">{claimBusy===claim.id?'সেভ হচ্ছে…':'সেভ'}</button></div></article>)}</div>}
      </div>
      {message && <p role="status" className="rounded-xl bg-white p-3 text-sm font-semibold text-emerald-900">{message}</p>}
    </section>
  );
}
