import React from 'react';
export const paymentLabels:Record<string,string>={BKASH:'bKash',NAGAD:'Nagad',ROCKET:'Rocket',DBBL:'ব্যাংক / NexusPay'};
const icons:Record<string,string>={BKASH:'bkash.png',NAGAD:'nagad.png',ROCKET:'rocket.png',DBBL:'bank.jpg'};
export default function PaymentMethodMark({method}:{method:string}){return <span className="inline-flex items-center gap-2"><img src={`/payment-logos/${icons[method]||'bank.jpg'}`} alt="" className="h-9 w-12 rounded-lg bg-white object-contain"/><span>{paymentLabels[method]||method}</span></span>;}
