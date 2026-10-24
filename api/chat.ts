import { allPackages, packageId } from '../src/booking/packageCatalog';
import { calculateChatQuote } from '../src/booking/chatQuote';

const rateBuckets = new Map<string, number[]>();
const perEventIds = new Set(['regular-basic', 'regular-standard', 'outdoor-essentials', 'outdoor-cinematic']);

function limited(req: any) {
  const ip = String(req.headers?.['x-vercel-forwarded-for'] || req.headers?.['x-forwarded-for'] || 'unknown').split(',')[0].trim().slice(0, 80);
  const now = Date.now();
  const recent = (rateBuckets.get(ip) || []).filter(time => now - time < 60_000);
  if (recent.length >= 12) return true;
  recent.push(now);
  rateBuckets.set(ip, recent);
  if (rateBuckets.size > 5000) {
    for (const [key, times] of rateBuckets) {
      if (!times.some(time => now - time < 60_000)) rateBuckets.delete(key);
      if (rateBuckets.size <= 4000) break;
    }
  }
  return false;
}

async function getDiscountPercent(): Promise<number | null> {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const response = await fetch(url + '/rest/v1/rpc/booking_custom_config', {
      method: 'POST',
      headers: { apikey: key, authorization: 'Bearer ' + key, 'content-type': 'application/json' },
      body: '{}',
      cache: 'no-store',
      signal: AbortSignal.timeout(3500),
    });
    if (!response.ok) return null;
    const config: any = await response.json();
    const value = Number(config?.fixed_discount_percent);
    return Number.isFinite(value) && value >= 0 && value <= 99 ? value : null;
  } catch {
    return null;
  }
}

function normalize(value: string) {
  return value.toLocaleLowerCase().replace(/[\s_-]+/g, ' ').trim();
}

function findPackage(message: string) {
  const text = normalize(message);
  const aliases: Record<string, string[]> = {
    'regular-basic': ['রেগুলার বেসিক', 'regular basic', 'basic package'],
    'regular-standard': ['রেগুলার স্ট্যান্ডার্ড', 'regular standard', 'standard package'],
    'regular-storytelling': ['রেগুলার স্টোরিটেলিং', 'regular storytelling'],
    'outdoor-essentials': ['আউটডোর এসেনশিয়াল', 'আউটডোর এসেনশিয়ালস', 'outdoor essentials'],
    'outdoor-cinematic': ['আউটডোর সিনেমাটিক', 'outdoor cinematic'],
    'outdoor-signature': ['আউটডোর সিগনেচার', 'outdoor signature'],
    'sonaton-both-side-signature': ['সনাতন উভয় পক্ষ সিগনেচার', 'sonaton both side signature'],
    'sonaton-both-side-prestige': ['সনাতন উভয় পক্ষ প্রেস্টিজ', 'sonaton both side prestige'],
    'sonaton-both-side-storytelling': ['সনাতন উভয় পক্ষ স্টোরিটেলিং', 'sonaton both side storytelling'],
    'sonaton-bride-side-signature': ['সনাতন কনেপক্ষ সিগনেচার', 'sonaton bride side signature'],
    'sonaton-bride-side-prestige': ['সনাতন কনেপক্ষ প্রেস্টিজ', 'sonaton bride side prestige'],
    'sonaton-bride-side-storytelling': ['সনাতন কনেপক্ষ স্টোরিটেলিং', 'sonaton bride side storytelling'],
    'sonaton-groom-side-signature': ['সনাতন বরপক্ষ সিগনেচার', 'sonaton groom side signature'],
    'sonaton-groom-side-prestige': ['সনাতন বরপক্ষ প্রেস্টিজ', 'sonaton groom side prestige'],
    'sonaton-groom-side-storytelling': ['সনাতন বরপক্ষ স্টোরিটেলিং', 'sonaton groom side storytelling'],
    'sonaton-wedding-day-signature': ['সনাতন বিয়ের দিন সিগনেচার', 'sonaton wedding day signature'],
    'sonaton-wedding-day-prestige': ['সনাতন বিয়ের দিন প্রেস্টিজ', 'sonaton wedding day prestige'],
    'sonaton-wedding-day-storytelling': ['সনাতন বিয়ের দিন স্টোরিটেলিং', 'sonaton wedding day storytelling'],
  };
  return allPackages.find(item => {
    const candidates = [normalize(item.name), ...(aliases[packageId(item.name)] || []).map(normalize)];
    return candidates.some(candidate => candidate && text.includes(candidate));
  }) || null;
}

function eventCount(message: string) {
  const match = message.match(/([0-9০-৯]{1,2})\s*(?:টি|টা)?\s*(?:অনুষ্ঠান|ইভেন্ট|event|events)/i);
  if (!match) return 1;
  const digits = match[1].replace(/[০-৯]/g, digit => String('০১২৩৪৫৬৭৮৯'.indexOf(digit)));
  const count = Number(digits);
  return Number.isInteger(count) && count >= 1 && count <= 20 ? count : 1;
}

function wantsPrice(message: string) {
  return /দাম|দর|কত|টাকা|৳|price|cost|budget|calculate|calculation|হিসাব|খরচ|quote|মোট/i.test(message);
}

function taka(value: number) {
  return '৳' + value.toLocaleString('en-BD', { maximumFractionDigits: 2 });
}

async function quoteReply(message: string) {
  const selected = findPackage(message);
  if (!selected || !wantsPrice(message)) return null;
  const requestedEvents = eventCount(message);
  const percent = await getDiscountPercent();
  if (percent === null) {
    const multiply = perEventIds.has(packageId(selected.name)) ? requestedEvents : 1;
    const base = selected.price * multiply;
    return {
      reply: `${selected.name} প্যাকেজের হিসাব: ${taka(selected.price)}${multiply > 1 ? ` × ${multiply} অনুষ্ঠান = ${taka(base)}` : ''}। বর্তমান অফিস-অনুমোদিত ডিসকাউন্ট যাচাই করা যাচ্ছে না, তাই ছাড়-সহ মোট বলছি না। লাইভ হিসাব দেখুন: /booking`,
    };
  }
  const quote = calculateChatQuote({ packageName: selected.name, eventCount: requestedEvents, approvedDiscountPercent: percent });
  const base = quote.chargedEvents > 1
    ? `${taka(quote.basePrice)} × ${quote.chargedEvents} অনুষ্ঠান = ${taka(quote.gross)}`
    : taka(quote.gross);
  const note = quote.note ? ' এই প্যাকেজে তালিকাভুক্ত ইভেন্টগুলো অন্তর্ভুক্ত, তাই অতিরিক্ত ইভেন্ট দিয়ে দাম গুণ করা হয়নি।' : '';
  return {
    reply: `${quote.packageName}: ${base}। অফিস-নির্ধারিত ছাড় ${quote.approvedDiscountPercent}% = ${taka(quote.discount)}। ছাড়ের পর প্যাকেজ মোট ${taka(quote.payable)}।${note} ছবি পোর্টফোলিওতে প্রকাশের অনুমতি না দিলে বুকিং ফর্মে ৳১০,০০০ অতিরিক্ত হতে পারে। তারিখ ও বুকিং অফিস যাচাই করে নিশ্চিত করবে। পূর্ণ হিসাব: /booking`,
  };
}

const packageList = () => {
  const groups = [
    ['রেগুলার', allPackages.filter(p => p.name.startsWith('Regular'))],
    ['আউটডোর', allPackages.filter(p => p.name.startsWith('Outdoor'))],
    ['সনাতন বিয়ে', allPackages.filter(p => p.name.startsWith('Sonaton'))],
  ];
  return groups.map(([name, items]: any) => `${name}: ${items.map((p: any) => `${p.name} ${taka(p.price)}`).join(' · ')}`).join('\n');
};

function answerFAQ(message: string) {
  const text = normalize(message);
  if (/প্যাকেজ|package|দাম|দর|price|খরচ|কত টাকা/.test(text)) {
    return `প্যাকেজের ধরন ও সাইটে প্রকাশিত দাম:\n${packageList()}\nআপনার আয়োজনের সঠিক হিসাব, ইভেন্ট সংখ্যা ও বর্তমান ছাড় দেখতে /booking খুলুন। কাস্টম ও ঘণ্টাভিত্তিক সিটি শুটের হিসাব ইনপুট অনুযায়ী বদলায়।`;
  }
  if (/বুক|booking|reserve|তারিখ|date|availability|ফাঁকা আছে/.test(text)) {
    return 'বুকিং /booking থেকে প্যাকেজ বা কাস্টম আয়োজন বেছে তারিখ, সময় ও লোকেশন দিয়ে হিসাব দেখুন। বুকিংয়ের আবেদন জমা দিলেই তারিখ নিশ্চিত হয় না; অফিস প্রাপ্যতা, শর্ত ও পেমেন্ট যাচাই করে নিশ্চিত করবে।';
  }
  if (/ফটো|ছবি|photograph|cinema|video|ভিডিও|drone|ড্রোন|album|অ্যালবাম/.test(text)) {
    return 'বিয়ে, জন্মদিন, পরিবার ও আউটডোর আয়োজনের ফটোগ্রাফি ও সিনেমাটোগ্রাফি করা হয়। প্যাকেজে টিম, কভারেজ, ছবি-ভিডিও এবং অ্যালবামের সুবিধা মিলিয়ে দেখতে /packages, কাজের নমুনা দেখতে /portfolio খুলুন।';
  }
  if (/custom|কাস্টম|hour|ঘণ্টা|city|সিটি|ছোট শুট|travel|ট্রাভেল/.test(text)) {
    return 'কাস্টম আয়োজন বা ঘণ্টাভিত্তিক সিটি ফটোশুটের দাম শহর, তারিখ, সময়, টিম ও ট্রাভেল অনুযায়ী বদলায়। সঠিক তথ্য দিয়ে /booking-এ হিসাব দেখুন।';
  }
  if (/delivery|ডেলিভারি|গ্যালারি|gallery|ছবি ডাউনলোড|download|face|মুখ/.test(text)) {
    return 'নিজের ছবি দেখতে ক্লায়েন্ট গ্যালারি বা /delivery ব্যবহার করুন। ছবি খুঁজতে /face-search দেখুন। গ্যালারির ব্যক্তিগত ছবি বা ক্লায়েন্টের তথ্য এই চ্যাটে দেখানো হয় না।';
  }
  if (/হাসি|funny|মজার|রম্য|গল্প|portfolio|কাজের নমুনা/.test(text)) {
    return 'আমাদের প্রকাশিত ছবি ও কাজের নমুনা /portfolio এবং /stories-এ দেখুন। নির্দিষ্ট কোনো কাজ বা ফটোগ্রাফি স্টাইল জানতে চাইলে সেটির নাম লিখুন।';
  }
  if (/যোগাযোগ|contact|মানুষ|human|whatsapp|ফোন|call/.test(text)) {
    return 'মানুষের সঙ্গে কথা বলতে WhatsApp: https://wa.me/8801776044951 অথবা ফোন: 01776044951।';
  }
  return 'আমি প্যাকেজ, বুকিং, হিসাব, ফটোগ্রাফি ও ছবি ডেলিভারি বিষয়ে সাইটের তথ্য দিয়ে সাহায্য করি। কোনটি জানতে চান? /packages · /booking · /portfolio · /delivery · মানুষের সহায়তা: https://wa.me/8801776044951';
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const origin = req.headers?.origin;
  const host = req.headers?.host;
  if (origin && host && new URL(origin).host !== host) return res.status(403).json({ error: 'Origin not allowed' });
  if (limited(req)) return res.status(429).json({ reply: 'এক মিনিট পরে আবার চেষ্টা করুন।' });
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  if (!message || message.length > 1200) return res.status(400).json({ error: '১–১২০০ অক্ষরের প্রশ্ন লিখুন।' });

  try {
    const exact = await quoteReply(message);
    return res.status(200).json({ reply: exact?.reply || answerFAQ(message) });
  } catch {
    return res.status(200).json({ reply: 'এই মুহূর্তে ছাড়-সহ হিসাব পাওয়া যাচ্ছে না। /booking-এ লাইভ হিসাব দেখুন অথবা WhatsApp-এ অফিসের সঙ্গে কথা বলুন: https://wa.me/8801776044951' });
  }
}
