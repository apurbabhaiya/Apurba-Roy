export type ManualClientDraft = { client_name: string; phone: string; event_date: string; event_name: string; total: string; paid: string; delivered: boolean };
export function manualClientPayload(draft: ManualClientDraft, requestId: string) {
  const phone = draft.phone.replace(/[০-৯]/g, digit => String('০১২৩৪৫৬৭৮৯'.indexOf(digit))).replace(/[\s()-]/g, '');
  const total = Number(draft.total);
  const paid = Number(draft.paid);
  if (draft.client_name.trim().length < 2 || draft.client_name.trim().length > 150) throw new Error('ক্লায়েন্টের নাম ২–১৫০ অক্ষরে লিখুন।');
  if (!/^\+?\d{8,15}$/.test(phone)) throw new Error('সঠিক মোবাইল নম্বর দিন।');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.event_date) || Number.isNaN(Date.parse(draft.event_date))) throw new Error('অনুষ্ঠান / কাজের তারিখ দিন।');
  if (!draft.total.trim() || !draft.paid.trim() || !Number.isFinite(total) || !Number.isFinite(paid) || total < 0 || total > 1000000000 || paid < 0 || paid > total || !/^\d+(\.\d{1,2})?$/.test(draft.total) || !/^\d+(\.\d{1,2})?$/.test(draft.paid)) throw new Error('মোট বিল ও জমা সঠিকভাবে দিন। জমা মোট বিলের বেশি হবে না; দশমিকের পরে সর্বোচ্চ ২ ঘর।');
  if (draft.delivered && paid < total) throw new Error('পূর্ণ ডেলিভারি দিতে আগে বাকি বিল পরিশোধ করুন।');
  return { request_id: requestId, client_name: draft.client_name.trim(), phone, event_date: draft.event_date, event_name: draft.event_name.trim(), total, paid, delivered: draft.delivered };
}
