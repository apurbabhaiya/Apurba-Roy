import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { supabase } from '../services/supabase';

const db = supabase as any;
type ScheduleDay = { event_date: string; booking_count: number };

function getDhakaDateParts() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  return {
    year: Number(parts.find((part) => part.type === 'year')?.value),
    month: Number(parts.find((part) => part.type === 'month')?.value),
    day: Number(parts.find((part) => part.type === 'day')?.value),
  };
}

const monthKeyOf = (date: Date) =>
  date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');

export default function TeamScheduleCalendar() {
  const now = getDhakaDateParts();
  const currentMonthKey = String(now.year) + '-' + String(now.month).padStart(2, '0');
  const maxMonthDate = new Date(now.year, now.month - 1 + 12, 1);
  const maxMonthKey = monthKeyOf(maxMonthDate);
  const [month, setMonth] = useState(() => new Date(now.year, now.month - 1, 1));
  const [items, setItems] = useState<ScheduleDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const monthKey = monthKeyOf(month);
  const monthLabel = useMemo(
    () => new Intl.DateTimeFormat('bn-BD', { month: 'long', year: 'numeric' }).format(month),
    [month],
  );

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError('');
    db.rpc('booking_public_team_schedule', { p_month: monthKey + '-01' })
      .then(({ data, error: requestError }: any) => {
        if (!live) return;
        if (requestError) {
          setItems([]);
          setError('টিমের শিডিউল এখন লোড করা যাচ্ছে না।');
          return;
        }
        setItems((data || []) as ScheduleDay[]);
      })
      .catch(() => {
        if (live) {
          setItems([]);
          setError('টিমের শিডিউল এখন লোড করা যাচ্ছে না।');
        }
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => { live = false; };
  }, [monthKey]);

  const scheduledDays = useMemo(
    () => new Map(items.map((item) => [item.event_date, Number(item.booking_count)])),
    [items],
  );

  const leadingEmptyDays = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: Array<number | null> = [
    ...Array.from({ length: leadingEmptyDays }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const canGoBack = monthKey > currentMonthKey;
  const canGoForward = monthKey < maxMonthKey;

  return (
    <section className="mx-auto mt-6 max-w-4xl rounded-3xl border border-stone-200 bg-white p-4 shadow-sm sm:p-6" aria-labelledby="team-schedule-title">
      <details>
        <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-2xl bg-[#f6f3ed] p-3 sm:p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-900"><CalendarDays className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1">
            <span id="team-schedule-title" className="block text-base font-black text-[#193e32] sm:text-lg">টিমের শিডিউল দেখুন</span>
            <span className="mt-1 block text-xs leading-5 text-stone-600">কোন তারিখে টিমের নিশ্চিত কাজ আছে, ক্যালেন্ডারে দেখুন</span>
          </span>
          <span aria-hidden="true" className="text-xl text-stone-500">⌄</span>
        </summary>

        <div className="pt-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <button type="button" disabled={!canGoBack} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="আগের মাস" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-stone-300 disabled:opacity-40"><ChevronLeft className="h-5 w-5" /></button>
            <h3 className="text-base font-bold capitalize text-[#193e32]" aria-live="polite">{monthLabel}</h3>
            <button type="button" disabled={!canGoForward} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="পরের মাস" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-stone-300 disabled:opacity-40"><ChevronRight className="h-5 w-5" /></button>
          </div>

          {loading ? (
            <div role="status" className="flex min-h-44 items-center justify-center gap-2 text-sm text-stone-600"><Loader2 className="h-5 w-5 animate-spin" />শিডিউল লোড হচ্ছে…</div>
          ) : error ? (
            <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{error}</p>
          ) : (
            <>
              <div role="grid" aria-label={monthLabel} className="grid grid-cols-7 gap-1 sm:gap-2">
                {['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি'].map((day) => (
                  <div role="columnheader" key={day} className="py-2 text-center text-[10px] font-bold text-stone-500 sm:text-xs">{day}</div>
                ))}
                {cells.map((day, index) => {
                  if (day === null) return <div role="gridcell" aria-hidden="true" key={'empty-' + index} className="min-h-12 rounded-lg sm:min-h-14" />;
                  const dayKey = monthKey + '-' + String(day).padStart(2, '0');
                  const count = scheduledDays.get(dayKey) || 0;
                  return (
                    <div role="gridcell" aria-label={day + ' তারিখ' + (count ? ', টিমের ' + count + 'টি কাজ আছে' : ', কোনো নিশ্চিত কাজ দেখানো নেই')} key={dayKey} className={'flex min-h-12 flex-col items-center justify-center rounded-lg border text-xs sm:min-h-14 sm:text-sm ' + (count ? 'border-amber-300 bg-amber-50 font-bold text-amber-950' : 'border-stone-100 bg-white text-stone-700')}>
                      <span>{day}</span>
                      {count > 0 && <span aria-hidden="true" className="mt-0.5 h-1.5 w-1.5 rounded-full bg-amber-600" />}
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-stone-600"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-amber-600" />এই তারিখে টিমের কাজ আছে</div>
              {!items.length && <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">এই মাসে এখনো কোনো নিশ্চিত টিম শিডিউল নেই।</p>}
            </>
          )}
          <p className="mt-3 text-xs leading-5 text-stone-500">এখানে শুধু বুকড/কনফার্মড কাজের তারিখ দেখানো হয়। নাম, ফোন ও আয়োজনের বিবরণ গোপন থাকে। ফাঁকা তারিখও অফিসের নিশ্চিতকরণ ছাড়া বুকিং নিশ্চিত করে না।</p>
        </div>
      </details>
    </section>
  );
}
