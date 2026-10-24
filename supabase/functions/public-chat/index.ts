type PackageInfo = {
  id: string;
  name: string;
  price: number;
  coverage?: string;
  crew?: string[];
  deliverables?: string[];
  physical?: string[];
};

const allowedOrigins = [
  "https://ramyachobi-client.vercel.app",
  "https://apurba-roy-three.vercel.app",
  "https://apurba-roy-git-main-ramyachobi.vercel.app",
];
const requests = new Map<string, number[]>();
const perEventIds = new Set(["regular-basic", "regular-standard", "outdoor-essentials", "outdoor-cinematic"]);

function originAllowed(origin: string) {
  return allowedOrigins.includes(origin)
    || /^https:\/\/apurba-[a-z0-9]+-ramyachobi\.vercel\.app$/.test(origin)
    || /^https:\/\/apurba-roy-git-[a-z0-9-]+-ramyachobi\.vercel\.app$/.test(origin);
}

function json(data: unknown, status: number, origin: string | null) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  if (origin && originAllowed(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }
  return new Response(JSON.stringify(data), { status, headers });
}

function limited(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown").split(",")[0].trim().slice(0, 80);
  const now = Date.now();
  const recent = (requests.get(ip) || []).filter(time => now - time < 60_000);
  if (recent.length >= 12) return true;
  recent.push(now);
  requests.set(ip, recent);
  if (requests.size > 5000) {
    for (const [key, times] of requests) {
      if (!times.some(time => now - time < 60_000)) requests.delete(key);
      if (requests.size <= 4000) break;
    }
  }
  return false;
}

async function rpc(name: string) {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !key) return null;
  try {
    const response = await fetch(url.replace(/\/$/, "") + "/rest/v1/rpc/" + name, {
      method: "POST",
      headers: { apikey: key, authorization: "Bearer " + key, "content-type": "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(3500),
    });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

function normalize(value: string) {
  return value.toLocaleLowerCase().replace(/[\s_-]+/g, " ").trim();
}

function findPackage(message: string, catalog: PackageInfo[]) {
  const text = normalize(message);
  const aliases: Record<string, string[]> = {
    "regular-basic": ["রেগুলার বেসিক", "basic package"],
    "regular-standard": ["রেগুলার স্ট্যান্ডার্ড", "standard package"],
    "regular-storytelling": ["রেগুলার স্টোরিটেলিং"],
    "outdoor-essentials": ["আউটডোর এসেনশিয়াল", "আউটডোর এসেনশিয়ালস"],
    "outdoor-cinematic": ["আউটডোর সিনেমাটিক"],
    "outdoor-signature": ["আউটডোর সিগনেচার"],
    "sonaton-both-side-signature": ["সনাতন উভয় পক্ষ সিগনেচার"],
    "sonaton-both-side-prestige": ["সনাতন উভয় পক্ষ প্রেস্টিজ"],
    "sonaton-both-side-storytelling": ["সনাতন উভয় পক্ষ স্টোরিটেলিং"],
    "sonaton-bride-side-signature": ["সনাতন কনেপক্ষ সিগনেচার"],
    "sonaton-bride-side-prestige": ["সনাতন কনেপক্ষ প্রেস্টিজ"],
    "sonaton-bride-side-storytelling": ["সনাতন কনেপক্ষ স্টোরিটেলিং"],
    "sonaton-groom-side-signature": ["সনাতন বরপক্ষ সিগনেচার"],
    "sonaton-groom-side-prestige": ["সনাতন বরপক্ষ প্রেস্টিজ"],
    "sonaton-groom-side-storytelling": ["সনাতন বরপক্ষ স্টোরিটেলিং"],
    "sonaton-wedding-day-signature": ["সনাতন বিয়ের দিন সিগনেচার"],
    "sonaton-wedding-day-prestige": ["সনাতন বিয়ের দিন প্রেস্টিজ"],
    "sonaton-wedding-day-storytelling": ["সনাতন বিয়ের দিন স্টোরিটেলিং"],
  };
  return catalog.find(item => {
    const candidates = [normalize(item.name), ...(aliases[item.id] || []).map(normalize)];
    return candidates.some(candidate => candidate && text.includes(candidate));
  }) || null;
}

function eventCount(message: string) {
  const match = message.match(/([0-9০-৯]{1,2})\s*(?:টি|টা)?\s*(?:(?:অতিরিক্ত|extra)\s*)?(?:অনুষ্ঠান|ইভেন্ট|event|events)/i);
  if (!match) return 1;
  const digits = match[1].replace(/[০-৯]/g, digit => String("০১২৩৪৫৬৭৮৯".indexOf(digit)));
  const count = Number(digits);
  return Number.isInteger(count) && count >= 1 && count <= 20 ? count : 1;
}

function wantsPrice(message: string) {
  return /দাম|দর|কত|টাকা|৳|price|cost|budget|calculate|calculation|হিসাব|খরচ|quote|মোট/i.test(message);
}

function taka(value: number) {
  return "৳" + value.toLocaleString("en-BD", { maximumFractionDigits: 2 });
}

function quoteReply(message: string, catalog: PackageInfo[], config: any) {
  const selected = findPackage(message, catalog);
  if (!selected || !wantsPrice(message)) return null;
  const requestedEvents = eventCount(message);
  const percentValue = Number(config?.fixed_discount_percent);
  const percent = Number.isFinite(percentValue) && percentValue >= 0 && percentValue <= 99 ? percentValue : null;
  const chargedEvents = perEventIds.has(selected.id) ? requestedEvents : 1;
  const gross = Number(selected.price) * chargedEvents;
  if (percent === null) {
    return {
      reply: `${selected.name} প্যাকেজের হিসাব: ${taka(Number(selected.price))}${chargedEvents > 1 ? ` × ${chargedEvents} অনুষ্ঠান = ${taka(gross)}` : ""}। বর্তমান অফিস-অনুমোদিত ডিসকাউন্ট যাচাই করা যাচ্ছে না, তাই ছাড়-সহ মোট বলছি না। লাইভ হিসাব দেখুন: /booking`,
    };
  }
  const discount = Math.round(gross * percent) / 100;
  const payable = Math.round((gross - discount) * 100) / 100;
  const base = chargedEvents > 1 ? `${taka(Number(selected.price))} × ${chargedEvents} অনুষ্ঠান = ${taka(gross)}` : taka(gross);
  const note = chargedEvents === 1 && requestedEvents > 1
    ? " এই প্যাকেজে তালিকাভুক্ত ইভেন্টগুলো অন্তর্ভুক্ত, তাই অতিরিক্ত ইভেন্ট দিয়ে দাম গুণ করা হয়নি।"
    : "";
  return {
    reply: `${selected.name}: ${base}। অফিস-নির্ধারিত ছাড় ${percent}% = ${taka(discount)}। ছাড়ের পর প্যাকেজ মোট ${taka(payable)}।${note} ছবি পোর্টফোলিওতে প্রকাশের অনুমতি না দিলে বুকিং ফর্মে ৳১০,০০০ অতিরিক্ত হতে পারে। তারিখ ও বুকিং অফিস যাচাই করে নিশ্চিত করবে। পূর্ণ হিসাব: /booking`,
  };
}

function packageList(catalog: PackageInfo[]) {
  const groups = [
    ["রেগুলার", catalog.filter(p => p.id.startsWith("regular-"))],
    ["আউটডোর", catalog.filter(p => p.id.startsWith("outdoor-"))],
    ["সনাতন বিয়ে", catalog.filter(p => p.id.startsWith("sonaton-"))],
  ] as const;
  return groups.map(([name, items]) => `${name}: ${items.map(p => `${p.name} ${taka(Number(p.price))}`).join(" · ")}`).join("\n");
}

function answerFAQ(message: string, catalog: PackageInfo[]) {
  const text = normalize(message);
  if (/প্যাকেজ|package|দাম|দর|price|খরচ|কত টাকা/.test(text)) {
    return `প্যাকেজের ধরন ও সাইটে প্রকাশিত দাম:\n${catalog.length ? packageList(catalog) : "সব প্যাকেজ /packages-এ দেখুন।"}\nআপনার আয়োজনের সঠিক হিসাব, ইভেন্ট সংখ্যা ও বর্তমান ছাড় দেখতে /booking খুলুন। কাস্টম ও ঘণ্টাভিত্তিক সিটি শুটের হিসাব ইনপুট অনুযায়ী বদলায়।`;
  }
  if (/ডিসকাউন্ট|ছাড়|discount/.test(text)) {
    return "নির্ধারিত প্যাকেজের বর্তমান অফিস-অনুমোদিত ছাড় /booking ফর্মে হাইলাইট করা থাকে। অতিরিক্ত ছাড় চাইলে অফিসের অনুমোদন লাগবে। কাস্টম প্যাকেজ, ঘণ্টাভিত্তিক শুট এবং পোর্টফোলিও প্রকাশ না করার ফি-তে এই ছাড় প্রযোজ্য নয়।";
  }
  if (/বুক|booking|reserve|তারিখ|date|availability|ফাঁকা আছে/.test(text)) {
    return "বুকিং /booking থেকে প্যাকেজ বা কাস্টম আয়োজন বেছে তারিখ, সময় ও লোকেশন দিয়ে হিসাব দেখুন। বুকিংয়ের আবেদন জমা দিলেই তারিখ নিশ্চিত হয় না; অফিস প্রাপ্যতা, শর্ত ও পেমেন্ট যাচাই করে নিশ্চিত করবে।";
  }
  if (/ফটো|ছবি|photograph|cinema|video|ভিডিও|drone|ড্রোন|album|অ্যালবাম/.test(text)) {
    return "বিয়ে, জন্মদিন, পরিবার ও আউটডোর আয়োজনের ফটোগ্রাফি ও সিনেমাটোগ্রাফি করা হয়। প্যাকেজে টিম, কভারেজ, ছবি-ভিডিও এবং অ্যালবামের সুবিধা মিলিয়ে দেখতে /packages, কাজের নমুনা দেখতে /portfolio খুলুন।";
  }
  if (/custom|কাস্টম|hour|ঘণ্টা|city|সিটি|ছোট শুট|travel|ট্রাভেল/.test(text)) {
    return "কাস্টম আয়োজন বা ঘণ্টাভিত্তিক সিটি ফটোশুটের দাম শহর, তারিখ, সময়, টিম ও ট্রাভেল অনুযায়ী বদলায়। সঠিক তথ্য দিয়ে /booking-এ হিসাব দেখুন।";
  }
  if (/delivery|ডেলিভারি|গ্যালারি|gallery|ছবি ডাউনলোড|download|face|মুখ/.test(text)) {
    return "নিজের ছবি দেখতে ক্লায়েন্ট গ্যালারি বা /delivery ব্যবহার করুন। ছবি খুঁজতে /face-search দেখুন। গ্যালারির ব্যক্তিগত ছবি বা ক্লায়েন্টের তথ্য এই চ্যাটে দেখানো হয় না।";
  }
  if (/হাসি|funny|মজার|রম্য|গল্প|portfolio|কাজের নমুনা/.test(text)) {
    return "আমাদের প্রকাশিত ছবি ও কাজের নমুনা /portfolio এবং /stories-এ দেখুন। নির্দিষ্ট কোনো কাজ বা ফটোগ্রাফি স্টাইল জানতে চাইলে সেটির নাম লিখুন।";
  }
  if (/যোগাযোগ|contact|মানুষ|human|whatsapp|ফোন|call/.test(text)) {
    return "মানুষের সঙ্গে কথা বলতে WhatsApp: https://wa.me/8801776044951 অথবা ফোন: 01776044951।";
  }
  return "আমি প্যাকেজ, বুকিং, হিসাব, ফটোগ্রাফি ও ছবি ডেলিভারি বিষয়ে সাইটের তথ্য দিয়ে সাহায্য করি। কোনটি জানতে চান? /packages · /booking · /portfolio · /delivery · মানুষের সহায়তা: https://wa.me/8801776044951";
}
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (origin && !originAllowed(origin)) return json({ error: "Origin not allowed" }, 403, null);
  if (req.method === "OPTIONS") {
    const headers = new Headers({
      "Access-Control-Allow-Origin": origin || "*",
      "Access-Control-Allow-Headers": "apikey, content-type, x-client-info",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin",
    });
    return new Response(null, { status: 204, headers });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);
  if (!req.headers.get("apikey")) return json({ error: "API key required" }, 401, origin);
  if (limited(req)) return json({ reply: "এক মিনিট পরে আবার চেষ্টা করুন।" }, 429, origin);
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400, origin); }
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message || message.length > 1200) return json({ error: "১–১২০০ অক্ষরের প্রশ্ন লিখুন।" }, 400, origin);
  const [catalogRaw, config] = await Promise.all([rpc("booking_package_catalog_list"), rpc("booking_custom_config")]);
  const catalog = Array.isArray(catalogRaw) ? catalogRaw as PackageInfo[] : [];
  const exact = quoteReply(message, catalog, config);
  return json({ reply: exact?.reply || answerFAQ(message, catalog) }, 200, origin);
});
