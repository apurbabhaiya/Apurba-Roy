type Faq = {question:string;answer:string;is_active?:boolean};
export type Reply = {reply:string;links?:{label:string;href:string}[]};
const money=(n:number)=>'৳'+n.toLocaleString('en-BD',{maximumFractionDigits:2});
const bn=(s:string)=>s.normalize('NFC').toLowerCase().replace(/[০-৯]/g,d=>String('০১২৩৪৫৬৭৮৯'.indexOf(d)));
const booking={label:'বুকিং ও অগ্রিমের হিসাব',href:'/booking'};
const discussion={label:'এই কোটেশন নিয়ে আলোচনা',href:'/booking?intent=discussion'};
const samples={label:'কাজের নমুনা',href:'/portfolio'};
export function salesReply(message:string,history:string[],config:any,chat:any):Reply|null{
 const current=bn(message),all=[...history.slice(-8),message].map(bn).join('\n');
 const turns=[...history.slice(-8),message].map(bn).reverse();
 const cityTurn=turns.find(t=>/ঢাকা|dhaka|ময়মনসিংহ|ময়মনসিংহ|mymensingh/.test(t))||'';
 const city=/ঢাকা|dhaka/.test(cityTurn)?'ঢাকা':/ময়মনসিংহ|ময়মনসিংহ|mymensingh/.test(cityTurn)?'ময়মনসিংহ':'';
 const kindTurn=turns.find(t=>/হিন্দু|সনাতন|hindu|sonaton|মুসলিম|muslim/.test(t))||'';
 const kind=/হিন্দু|সনাতন|hindu|sonaton/.test(kindTurn)?'হিন্দু':/মুসলিম|muslim/.test(kindTurn)?'মুসলিম':'';
 const hasDate=/\d{1,4}[\/-]\d{1,2}[\/-]\d{1,4}|জানুয়ারি|ফেব্রুয়ারি|মার্চ|এপ্রিল|মে মাস|জুন|জুলাই|আগস্ট|সেপ্টেম্বর|অক্টোবর|নভেম্বর|ডিসেম্বর|january|february|march|april|june|july|august|september|october|november|december/.test(all);
 const next=()=>!city?'আয়োজন কোন শহরে হবে?':!hasDate?'অনুষ্ঠানের তারিখ কবে?':'প্রতিটি অনুষ্ঠানের শুরু ও শেষের সময় কী?';
 const answer=(reply:string,links= [booking]):Reply=>({reply,links});
 const offer=(type:string)=>chat?.auto_reply_enabled===true?(chat.faqs as Faq[]||[]).find(f=>f.is_active!==false&&f.question===`ময়মনসিংহ ${type} বিয়ে · প্রাথমিক কোটেশন`)?.answer:null;
 if(/ডেলিভারি|delivery|কবে পাব|raw|র ফাইল|cancel|বাতিল|refund|রিফান্ড|date change|তারিখ বদল|তারিখ পরিবর্তন/.test(current))return null;
 const hourly=/ঘন্টা|ঘণ্টা|ঘণ্টাখানেক|ঘন্টাখানেক|hour|casual|ক্যাজুয়াল|ক্যাজুয়াল|ক্যাজুয়েল|ছোট শুট/.test(all);
 if(/^(hi|hello|hey|হাই|হ্যালো|নমস্কার|আসসালামু আলাইকুম)[! .🌸❤️]*$/.test(current))return answer('রম্যছবিতে স্বাগতম 🌸 কী আয়োজন হবে: বিয়ে, হলুদ নাকি ছোট ফটোশুট?',[]);
 if(/কম টাকা|বাজেট কম|budget.*low|low budget|দাম কম|টাকা কম|last price|লাস্ট প্রাইস|কম দিব|কম দেব|কম হবে/.test(current))return answer(`আপনার বাজেট মাথায় রেখে সময় ও টিম মিলিয়ে খরচ কমানোর চেষ্টা করব। ছাড় অফিস অনুমোদন করবে। দীর্ঘ সময় আগে প্রি-বুকিংয়ে ${money(Number(config?.prebook_amount)||2000)} মোট বিলের অংশ হিসেবে অগ্রিম; অনুষ্ঠান কাছাকাছি হলে ৫০% লাগতে পারে। আপনার বাজেট কত?`,[discussion,booking]);
 if(/অগ্রিম|advance|অ্যাডভান্স|২০০০|2000|pre.?book|প্রি.?বুক/.test(current))return answer(`নির্ধারিত প্যাকেজে দীর্ঘ সময় আগে প্রি-বুকিংয়ের অগ্রিম ${money(Number(config?.prebook_amount)||2000)}। এটি মোট বিলের অংশ। অনুষ্ঠানের ${Number(config?.half_due_days)||60} দিন আগে মোট ৫০%, বাকি কাজের দিনে। কাছের তারিখে এখনই ৫০% লাগতে পারে। ঘণ্টাভিত্তিক শুটের অগ্রিম শহর অনুযায়ী আলাদা। পেমেন্ট ও সময় অফিস যাচাই করলে বুকিং নিশ্চিত হবে।`,[booking]);
 if(/বুকিং|booking|book now|কনফার্ম|confirm/.test(current))return answer('প্যাকেজ, অনুষ্ঠান ও তারিখ বেছে ফর্মে অগ্রিমের হিসাব দেখুন। টাকা পাঠানোর পর ট্রানজেকশন আইডি বা ক্যাশ রসিদ দিন। অফিস পেমেন্ট ও টিম যাচাই করে নিশ্চিত করবে।',[booking,discussion]);
 if(/ডিসকাউন্ট|discount|ছাড়|ছাড়/.test(current)){const percent=Number(config?.fixed_discount_percent||0);return answer(`নির্ধারিত প্যাকেজে বর্তমান অফিস-অনুমোদিত ছাড় ${percent}%। কাস্টম, ঘণ্টাভিত্তিক শুট ও প্রকাশের অনুমতি না দেওয়ার ফিতে প্রযোজ্য নয়। বাড়তি ছাড় চাইলে অফিসে অনুরোধ করুন। আপনার বাজেট কত?`,[booking,discussion]);}
 if(/sample|নমুনা|স্যাম্পল|কাজ দেখ|portfolio/.test(current))return answer('আমাদের ছবি ও আয়োজনের গল্প এখানে দেখুন 📸 কোন স্টাইলটি পছন্দ বললে প্রয়োজন বুঝতে সুবিধা হবে।',[samples,{label:'সব গল্প',href:'/stories'}]);
 if(/ফাঁকা|available|availability|slot/.test(current))return answer('টিমের প্রাপ্যতা অফিস যাচাই করবে; এই চ্যাট থেকে তারিখ নিশ্চিত করা হয় না। '+next(),[discussion]);
 if(hourly&&!kind){
  if(!city)return answer('ছোট বা ক্যাজুয়াল ফটোশুট নেওয়া যায় 📸 ময়মনসিংহ নাকি ঢাকা?', [{label:'ঘণ্টাভিত্তিক শুটের হিসাব',href:'/booking/city'}]);
  const rate=config?.mini_city_rates?.[city];
  if(!rate||config?.mini_enabled!==true)return answer('এই শহরের ঘণ্টাভিত্তিক রেট এখন যাচাই করা যাচ্ছে না। অফিসে আলোচনা করে নিন।',[discussion]);
  const num=current.match(/(\d+(?:\.\d+)?)\s*(?:ঘণ্টা|ঘন্টা|hours?|hr)/)||all.match(/(\d+(?:\.\d+)?)\s*(?:ঘণ্টা|ঘন্টা|hours?|hr)/);const hours=num?Number(num[1]):/ঘণ্টাখানেক|ঘন্টাখানেক/.test(all)?1:null;
  const deposit=config?.mini_city_deposits?.[city];
  if(hours!==null&&(hours<1||hours>12||!Number.isInteger(hours)))return answer('ঘণ্টাভিত্তিক সহজ ফর্মে ১–১২ ঘণ্টা বাছতে পারবেন। অন্য সময়ের জন্য অফিসে আলোচনা করুন।',[{label:'শুটের হিসাব',href:'/booking/city'},discussion]);
  return answer(`${city}: ${money(Number(rate.hourly_rate))}/ঘণ্টা + প্রতিদিন ${money(Number(rate.travel))} ট্রাভেল।${hours?`\n${hours} ঘণ্টা × ${money(Number(rate.hourly_rate))} + ${money(Number(rate.travel))} = ${money(hours*Number(rate.hourly_rate)+Number(rate.travel))} (এক দিন, একজন ফটোগ্রাফার)।`:''}\nস্পেশাল এডিট ছবি চাইলে ${money(Number(config.photo_edit_rate))}/ছবি আলাদা।${deposit?` অগ্রিম ${money(Number(deposit))}, বাকি শুটের দিন।`:''}\n${hours?next():'কত ঘণ্টা শুট চান?'}`,[{label:'এই শুট বুকিং করুন',href:'/booking/city'}]);
 }
 if((/হলুদ|holud|রিসেপশন|reception/.test(current)&&/বিয়ে|বিয়ে|wedding/.test(current)||/দিনের.*বিয়ে|days?.*wedding/.test(current))&&kind){
  const count=/রিসেপশন|reception/.test(current)&&/হলুদ|holud/.test(current)?3:2;
  const cityOffer=city==='ময়মনসিংহ'&&kind==='মুসলিম'?offer(kind):null;
  const prices=cityOffer?[...bn(cityOffer).matchAll(/৳([0-9,]+)/g)].map(m=>Number(m[1].replaceAll(',',''))):[];
  if(prices.length===3)return answer(`ময়মনসিংহে ${count} অনুষ্ঠানের প্রাথমিক কোটেশন:\n${['Essential','Signature','Premium'].map((name,i)=>`${name}: ${money(prices[i])} × ${count} = ${money(prices[i]*count)}`).join('\n')}\nসময়, সুবিধা ও ট্রাভেল অফিস নিশ্চিত করবে। ${next()}`,[discussion,{label:'নির্ধারিত প্যাকেজ',href:'/packages'}]);
  return answer('প্রতিটি অনুষ্ঠানের সময় ও লোকেশন দেখে কোটেশন হবে। হিন্দু বিয়ের তালিকাভুক্ত সেটের দাম অনুষ্ঠানসংখ্যা দিয়ে স্বয়ংক্রিয়ভাবে গুণ হয় না। '+next(),[discussion,{label:'সব প্যাকেজ',href:'/packages'},booking]);
 }
 if(kind&&(/প্যাকেজ|package|দাম|কত|price|cost|essential|signature|premium/.test(current)||/^(হিন্দু|মুসলিম|hindu|muslim|সনাতন|sonaton)/.test(current)||/ময়মনসিংহ|ময়মনসিংহ|mymensingh|ঢাকা|dhaka/.test(current))){
  if(!city)return answer(`${kind} বিয়ের কভারেজ করা যাবে 📸 ${next()}`,[{label:'প্যাকেজ দেখুন',href:'/packages'}]);
  const customOffer=city==='ময়মনসিংহ'?offer(kind):null;
  return answer(customOffer?`${customOffer}\n${next()}`:`${city}-এ ${kind} বিয়ের সময়, অনুষ্ঠান ও টিম অনুযায়ী কোটেশন হবে। ${next()}`,[discussion,{label:'নির্ধারিত প্যাকেজ দেখুন',href:'/packages'}]);
 }
 if(!kind&&/প্যাকেজ|package|package price|দাম কত/.test(current))return answer('বিয়ে, হলুদ, আউটডোর বা ঘণ্টাভিত্তিক শুটের আলাদা অপশন আছে। কী ধরনের আয়োজন হবে?',[{label:'সব প্যাকেজ',href:'/packages'},booking]);
 if(/শুধু.*ফটো|only.*photo|photography only|ফটোগ্রাফি.*লাগবে/.test(current))return answer('শুধু ফটোগ্রাফি নেওয়া যাবে 📸 কয় ঘণ্টার কভারেজ লাগবে?',[discussion]);
 if(/ড্রোন|drone/.test(current))return answer('ড্রোনের প্রাথমিক অ্যাড-অন কোটেশন ৳৩,০০০। চূড়ান্ত রেট, অনুমতি ও প্রাপ্যতা লোকেশন দেখে অফিস নিশ্চিত করবে। কোন লোকেশনে হবে?',[discussion]);
 if(/ভিডিও|video|cinematic|সিনেমাটিক/.test(current))return answer('ফুল ভিডিও ও ট্রেলার নেওয়া যায় 🎥 কী কী থাকবে তা নির্বাচিত প্যাকেজে দেখুন। শুধু ভিডিও নাকি ছবি ও ভিডিও দুটো চান?',[{label:'ছবি ও ভিডিও প্যাকেজ',href:'/packages'},discussion]);
 if(/full day|ফুল ডে|সারাদিন|পুরো দিন/.test(current))return answer('পুরো দিনের জন্য অনুষ্ঠানভিত্তিক কভারেজ সাজানো যাবে। শুরু ও শেষের সময় কী হবে?',[discussion]);
 if(/বুক করব না|পরে জানাব|এখন না|not now|পরে বুক/.test(current))return answer('পরে সিদ্ধান্ত নিতে পারেন। প্যাকেজ বা নমুনা দেখে রাখুন; কোনো প্রশ্ন থাকলে এখানেই লিখুন।',[{label:'প্যাকেজ',href:'/packages'},samples]);
 if(kind&&(hasDate||city)&&current.length<100&&/^\d/.test(current))return answer('ধন্যবাদ, তথ্য পেয়েছি। '+next(),[discussion]);
 return null;
}
