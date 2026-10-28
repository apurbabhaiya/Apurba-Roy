import React, { useMemo, useState } from 'react';
import { cashDate, CashEntry, sumCash } from './financeSummary';

const money = (amount: number) => new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 0 }).format(amount);
const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const todayDhaka = () => new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Dhaka',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
type ScheduleBooking = { id: string; reference_no?: string | null; client_name?: string | null; status?: string | null; deleted_at?: string | null; advance_paid?: number | string };
type ScheduleEvent = { id: string; booking_id: string; event_date: string; event_name?: string | null; start_time?: string | null; end_time?: string | null; venue?: string | null; location?: string | null };
type Props = {
  bookings: ScheduleBooking[];
  payments: { amount: number | string; paid_on?: string | null }[];
  costs: { amount: number | string; paid_on?: string | null }[];
  events?: ScheduleEvent[];
  calendarNotes?: { note_date: string; title: string; note: string }[];
  onEditEvent?: (event: ScheduleEvent) => void;
};
export default function FinanceCalendar({bookings=[],payments=[],costs=[],events=[],calendarNotes=[],onEditEvent}: Props) {
  const safeBookings=Array.isArray(bookings)?bookings:[]; const safePayments=Array.isArray(payments)?payments:[]; const safeCosts=Array.isArray(costs)?costs:[]; const safeEvents=Array.isArray(events)?events:[]; const safeNotes=Array.isArray(calendarNotes)?calendarNotes:[];
  const bookingById=new Map(safeBookings.filter(booking=>!booking.deleted_at&&!['cancelled','rejected','declined'].includes(String(booking.status||'').toLowerCase())).map(booking=>[booking.id,booking]));
  const scheduleEvents=safeEvents.filter(event=>bookingById.has(event.booking_id));
  const today = todayDhaka();
  const [month, setMonth] = useState(today.slice(0,7));
  const [selectedDay, setSelectedDay] = useState(today);
  const selectedEvents=scheduleEvents.filter(event=>event.event_date===selectedDay);
  const [year, monthNumber] = month.split('-').map(Number);
  const { entries, undatedIncome, undatedExpense } = useMemo(() => {
    const entries: CashEntry[] = [];
    let undatedIncome = safeBookings.reduce((total,b) => total + Number(b.advance_paid || 0),0);
    let undatedExpense = 0;
    for (const payment of safePayments) {
      const date = cashDate(payment.paid_on), amount = Number(payment.amount || 0);
      if (date) entries.push({ date, amount, kind:'income' }); else undatedIncome += amount;
    }
    for (const cost of safeCosts) {
      const date = cashDate(cost.paid_on), amount = Number(cost.amount || 0);
      if (date) entries.push({ date, amount, kind:'expense' }); else undatedExpense += amount;
    }
    return {entries,undatedIncome,undatedExpense};
  },[safeBookings,safePayments,safeCosts]);
  const monthTotals = sumCash(entries,month), yearTotals = sumCash(entries,String(year)), dayTotals = sumCash(entries,selectedDay);
  const numberOfDays = new Date(Date.UTC(year,monthNumber,0)).getUTCDate();
  const offset = new Date(Date.UTC(year,monthNumber-1,1)).getUTCDay();
  const yearOptions = [...new Set([year,Number(today.slice(0,4)),...entries.map(e => Number(e.date.slice(0,4)))])].sort((a,b)=>b-a);
  function chooseMonth(value: string) { setMonth(value); setSelectedDay(`${value}-01`); }
  function moveMonth(delta: number) {
    const date = new Date(Date.UTC(year,monthNumber-1+delta,1));
    chooseMonth(date.toISOString().slice(0,7));
  }
  const netLabel = (value: number) => value > 0 ? 'উদ্বৃত্ত' : value < 0 ? 'ঘাটতি' : 'সমান';
  return <section aria-label="Financial calendar" className="mb-4 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
    <div className="bg-slate-950 p-5 text-white"><p className="text-xs font-bold uppercase tracking-widest text-amber-300">Accounts overview · BDT</p><h2 className="mt-1 text-xl font-bold">আয় ও খরচের ক্যালেন্ডার</h2><p className="mt-2 text-xs text-slate-300">সব বুকিংয়ের হিসাব, Trash-সহ। সার্চের কারণে হিসাব বদলাবে না।</p></div>
    <div className="space-y-5 p-4">
      <div className="flex items-center gap-2"><button type="button" aria-label="Previous month" onClick={()=>moveMonth(-1)} className="rounded-lg border px-3 py-2">‹</button><label className="flex-1 text-xs font-semibold">মাস<select aria-label="Calendar month" value={monthNumber} onChange={e=>chooseMonth(`${year}-${e.target.value.padStart(2,'0')}`)} className="mt-1 w-full rounded-lg border p-2">{months.map((name,i)=><option key={name} value={i+1}>{name}</option>)}</select></label><label className="w-24 text-xs font-semibold">বছর<select aria-label="Calendar year" value={year} onChange={e=>chooseMonth(`${e.target.value}-${String(monthNumber).padStart(2,'0')}`)} className="mt-1 w-full rounded-lg border p-2">{yearOptions.map(y=><option key={y}>{y}</option>)}</select></label><button type="button" aria-label="Next month" onClick={()=>moveMonth(1)} className="rounded-lg border px-3 py-2">›</button></div>
      <div className="grid grid-cols-7 gap-1 text-center">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><div key={d} className="py-1 text-xs font-bold text-slate-500">{d}</div>)}{Array.from({length:offset},(_,i)=><span key={`blank-${i}`} />)}{Array.from({length:numberOfDays},(_,i)=>{
        const date = `${month}-${String(i+1).padStart(2,'0')}`, totals = sumCash(entries,date);
        const hasNote=safeNotes.some(note=>note.note_date===date);
        const eventCount=scheduleEvents.filter(event=>event.event_date===date).length;
        return <button key={date} type="button" aria-label={`${date}: received ${money(totals.income)}, expense ${money(totals.expense)}${hasNote?', has note':''}${eventCount?', '+eventCount+' event'+(eventCount===1?'':'s'):''}`} aria-pressed={selectedDay===date} onClick={()=>setSelectedDay(date)} className={`min-h-14 rounded-lg border p-1 text-sm ${selectedDay===date?'border-amber-500 bg-amber-100 font-bold':'border-slate-100 hover:bg-slate-50'}`}><span>{i+1}</span><span className="mt-1 flex justify-center gap-1">{totals.income!==0 && <span className="h-1.5 w-1.5 rounded-full bg-emerald-600"/>}{totals.expense!==0 && <span className="h-1.5 w-1.5 rounded-full bg-red-500"/>}{hasNote&&<span className="h-1.5 w-1.5 rounded-full bg-blue-600"/>}{eventCount>0&&<span className="h-1.5 w-1.5 rounded-full bg-amber-500"/>}</span>{eventCount>0&&<span className="block text-[9px] font-bold leading-3 text-amber-800">{eventCount}টি ইভেন্ট</span>}</button>;
      })}</div>
      <p className="text-xs text-slate-500">সবুজ বিন্দু: টাকা জমা · লাল বিন্দু: খরচ · নীল বিন্দু: তারিখের নোট</p>
      {safeNotes.filter(note=>note.note_date===selectedDay).map(note=><article key={note.title+note.note} className="rounded-xl border border-blue-200 bg-blue-50 p-3"><b className="text-sm">{note.title}</b><p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{note.note}</p></article>)}
      <section aria-label={selectedDay+' এর বুকিং'} className="rounded-2xl border border-amber-200 bg-amber-50 p-3"><h3 className="font-bold">এই তারিখের ইভেন্ট · {selectedEvents.length}</h3>{selectedEvents.length?<div className="mt-2 space-y-2">{selectedEvents.map(event=>{const booking=bookingById.get(event.booking_id);const time=[event.start_time,event.end_time].filter(Boolean).map(value=>value?.slice(0,5)).join('–');return <article key={event.id} className="rounded-xl border border-amber-100 bg-white p-3"><p className="font-bold">{booking?.client_name||'নাম নেই'} · {event.event_name||'অনুষ্ঠান'}</p><p className="mt-1 text-xs text-stone-600">{booking?.reference_no||'বুকিং'}{time?' · '+time:''}{event.venue||event.location?' · '+(event.venue||event.location):''}</p>{onEditEvent&&<button type="button" onClick={()=>onEditEvent(event)} className="mt-2 min-h-9 rounded-lg border border-amber-300 px-3 text-xs font-bold text-amber-900">তারিখ সম্পাদনা</button>}</article>})}</div>:<p className="mt-1 text-sm text-stone-600">এই তারিখে কোনো সক্রিয় বুকিং ইভেন্ট নেই।</p>}</section>
      {[{label:selectedDay,total:dayTotals},{label:`${months[monthNumber-1]} ${year}`,total:monthTotals},{label:`পুরো বছর ${year}`,total:yearTotals}].map(({label,total})=><div key={label} className="rounded-2xl bg-slate-50 p-3"><h3 className="text-sm font-bold">{label}</h3><dl className="mt-2 grid grid-cols-3 gap-2 text-xs"><div><dt>জমা</dt><dd className="mt-1 font-bold text-emerald-700">{money(total.income)}</dd></div><div><dt>খরচ</dt><dd className="mt-1 font-bold text-red-700">{money(total.expense)}</dd></div><div><dt>{netLabel(total.net)}</dt><dd className={`mt-1 font-bold ${total.net<0?'text-red-700':'text-slate-900'}`}>{money(Math.abs(total.net))}</dd></div></dl></div>)}
      <details><summary className="cursor-pointer text-sm font-bold">বছরের ১২ মাসের হিসাব</summary><div className="mt-3 overflow-x-auto"><table className="w-full text-left text-xs"><caption className="sr-only">Monthly cash summary for {year}</caption><thead><tr><th className="p-2">মাস</th><th>জমা</th><th>খরচ</th><th>উদ্বৃত্ত / ঘাটতি</th></tr></thead><tbody>{months.map((name,i)=>{const totals=sumCash(entries,`${year}-${String(i+1).padStart(2,'0')}`);return <tr key={name} className="border-t"><th className="p-2">{name}</th><td>{money(totals.income)}</td><td>{money(totals.expense)}</td><td className={totals.net<0?'text-red-700':'text-emerald-700'}>{money(totals.net)}</td></tr>;})}</tbody></table></div></details>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5"><strong>হিসাবের ভিত্তি:</strong> তারিখসহ রেকর্ড করা টাকা জমা − খরচ। এটি নগদ প্রবাহের উদ্বৃত্ত/ঘাটতি, পূর্ণ ব্যবসায়িক লাভ/লস নয়। বকেয়া বা প্যাকেজের দাম আয় হিসেবে ধরা হয়নি।<p className="mt-2">তারিখবিহীন জমা/অগ্রিম: <strong>{money(undatedIncome)}</strong> · তারিখবিহীন খরচ: <strong>{money(undatedExpense)}</strong>। এগুলো দিন, মাস ও বছরের মোটে নেই।</p></div>
    </div>
  </section>;
}

