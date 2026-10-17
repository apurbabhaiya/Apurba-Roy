export type TeamEvent = { id: string; event_name: string; event_date: string; start_time?: string; end_time?: string; venue?: string; location?: string };
export function whatsappTeamNumber(value: string) {
  const digits = value.replace(/[\s()+-]/g, '');
  const normalized = /^01[3-9]\d{8}$/.test(digits) ? `88${digits}` : digits;
  return /^[1-9]\d{6,14}$/.test(normalized) ? normalized : '';
}
export function teamConfirmationMessage(input: { name: string; role: string; client: string; reference: string; event: TeamEvent; reportingTime: string; note: string }) {
  const e = input.event;
  return [
    `কাজের কনফার্মেশন | RamyaChobi`,
    `প্রিয় ${input.name.trim()},`,
    `নিচের কনফার্ম করা কাজে আপনার উপস্থিতি প্রয়োজন।`,
    '',
    `দায়িত্ব: ${input.role.trim()}`,
    `ক্লায়েন্ট: ${input.client}`,
    `বুকিং: ${input.reference}`,
    `অনুষ্ঠান: ${e.event_name || 'উল্লেখ নেই'}`,
    `তারিখ: ${e.event_date || 'নির্ধারিত হয়নি'}`,
    `কাজের সময়: ${e.start_time?.slice(0,5) || 'নির্ধারিত হয়নি'}${e.end_time ? ` থেকে ${e.end_time.slice(0,5)}` : ''} (বাংলাদেশ সময়)`,
    `রিপোর্টিং সময়: ${input.reportingTime || 'কাজের সময়ের আগে যোগাযোগ করুন'}${input.reportingTime ? ' (বাংলাদেশ সময়)' : ''}`,
    `ভেন্যু: ${e.venue || 'নির্ধারিত হয়নি'}`,
    `লোকেশন: ${e.location || e.venue || 'নির্ধারিত হয়নি'}`,
    ...(e.location || e.venue ? [`ম্যাপ: https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([e.venue,e.location].filter(Boolean).join(', '))}`] : []),
    ...(input.note.trim() ? ['',`নির্দেশনা: ${input.note.trim()}`] : []),
    '',
    'মেসেজটি দেখে আপনার উপস্থিতি নিশ্চিত করে উত্তর দিন। সময়মতো উপস্থিত থাকবেন।',
    'ধন্যবাদ, RamyaChobi'
  ].join('\n');
}
