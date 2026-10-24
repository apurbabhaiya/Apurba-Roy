import React, { useEffect, useRef, useState } from 'react';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../services/supabase';

type Message = { role: 'assistant' | 'user'; text: string };
const suggestions = ['প্যাকেজের দাম কত?', '২টি অতিরিক্ত অনুষ্ঠানের বিল', 'ডিসকাউন্ট কীভাবে পাব?'];

export default function RamyaChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', text: 'স্বাগতম! 📸 প্যাকেজ, বুকিং, হিসাব ও ফটোগ্রাফি নিয়ে বাংলায় বা English-এ প্রশ্ন করুন।' },
  ]);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, busy]);

  useEffect(() => () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }, []);

  function startVoice() {
    const browser = window as any;
    const Recognition = browser.SpeechRecognition || browser.webkitSpeechRecognition;
    if (!Recognition) {
      setMessages(previous => [...previous, { role: 'assistant', text: 'এই ব্রাউজারে ভয়েস ইনপুট নেই। লিখে প্রশ্ন করুন অথবা WhatsApp-এ ভয়েস মেসেজ পাঠান।' }]);
      return;
    }
    const recognition = new Recognition();
    recognition.lang = 'bn-BD';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event: any) => {
      const transcript = String(event.results?.[0]?.[0]?.transcript || '').trim();
      if (transcript) setInput(transcript);
      setListening(false);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    setListening(true);
    try { recognition.start(); } catch { setListening(false); }
  }

  function speak(text: string) {
    if (!('speechSynthesis' in window)) {
      setMessages(previous => [...previous, { role: 'assistant', text: 'এই ব্রাউজারে উত্তর পড়ে শোনানোর সুবিধা নেই।' }]);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = /[\u0980-\u09FF]/.test(text) ? 'bn-BD' : 'en-US';
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }

  async function send(value = input) {
    const question = value.trim();
    if (!question || busy) return;
    const history = [...messages, { role: 'user' as const, text: question }];
    setMessages(history);
    setInput('');
    setBusy(true);
    try {
      const response = await fetch(SUPABASE_URL + '/functions/v1/public-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ message: question }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.reply || 'Chat unavailable');
      setMessages(previous => [...previous, { role: 'assistant', text: String(data.reply || 'দুঃখিত, এই মুহূর্তে উত্তর পাওয়া যাচ্ছে না।') }]);
    } catch {
      setMessages(previous => [...previous, { role: 'assistant', text: 'এই মুহূর্তে উত্তর পাওয়া যাচ্ছে না। /booking-এ হিসাব দেখুন অথবা WhatsApp-এ কথা বলুন।' }]);
    } finally {
      setBusy(false);
    }
  }

  return <div className="ramya-chat-widget-dock">
    {open && <section aria-label="রম্যছবি চ্যাট সহায়তা" style={{ width: 'min(370px, calc(100vw - 32px))', height: 'min(540px, calc(100dvh - 100px))', background: '#fff', color: '#172033', borderRadius: 18, boxShadow: '0 12px 48px #0003', display: 'flex', flexDirection: 'column', overflow: 'hidden', marginBottom: 12 }}>
      <header style={{ padding: 14, background: '#193e32', color: '#fff', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span aria-hidden="true">📸</span><span style={{ flex: 1 }}>রম্যছবি চ্যাট সহায়তা<small style={{ display: 'block', fontSize: 11, fontWeight: 400, opacity: .8 }}>স্বয়ংক্রিয় উত্তর · বাংলা / English</small></span>
        <button type="button" onClick={() => setOpen(false)} aria-label="চ্যাট বন্ধ করুন" style={{ color: 'white', background: 'none', border: 0, cursor: 'pointer', fontSize: 18 }}>×</button>
      </header>
      <div aria-live="polite" aria-relevant="additions text" style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {messages.map((message, index) => <div key={index} style={{ background: message.role === 'user' ? '#e3eee7' : '#f4f2ec', margin: '8px 0', marginLeft: message.role === 'user' ? 36 : 0, marginRight: message.role === 'assistant' ? 30 : 0, padding: 11, borderRadius: 12, whiteSpace: 'pre-wrap', lineHeight: 1.55, fontSize: 14 }}>
          {message.text}
          {message.role === 'assistant' && <button type="button" onClick={() => speak(message.text)} aria-label="উত্তরটি শুনুন" title="উত্তরটি শুনুন" style={{ display: 'block', marginTop: 8, border: 0, background: 'transparent', color: '#193e32', padding: 0, cursor: 'pointer', fontSize: 12 }}>🔊 {speaking ? 'আবার শুনুন' : 'উত্তর শুনুন'}</button>}
        </div>)}
        {busy && <p role="status" style={{ fontSize: 13, color: '#666' }}>উত্তর তৈরি হচ্ছে…</p>}
        <div ref={endRef} />
      </div>
      <div style={{ padding: '4px 10px 8px', display: 'flex', gap: 5, flexWrap: 'wrap' }}>{suggestions.map(s => <button type="button" key={s} onClick={() => void send(s)} disabled={busy} style={{ fontSize: 11, padding: '7px 9px', borderRadius: 20, border: '1px solid #ddd', background: '#fff' }}>{s}</button>)}</div>
      <p style={{ margin: '0 12px 6px', fontSize: 10, color: '#6c6c66', lineHeight: 1.4 }}>মাইক্রোফোন চাপলে ব্রাউজারের ভয়েস সেবা কথার লিখিত রূপ তৈরি করতে পারে। পাঠালে সেই লেখা এই সাইটে পাঠানো হয়। চ্যাট সংরক্ষণ করা হয় না।</p>
      <div style={{ padding: '4px 12px 8px', display: 'flex', gap: 12, fontSize: 12 }}>
        <a href="https://wa.me/8801776044951" target="_blank" rel="noopener noreferrer">মানুষের সহায়তা · WhatsApp</a>
        <a href="tel:+8801776044951">📞 01776044951</a>
      </div>
      <form onSubmit={event => { event.preventDefault(); void send(); }} style={{ padding: '8px 10px 12px', display: 'flex', gap: 7 }}>
        <input aria-label="আপনার প্রশ্ন" value={input} onChange={event => setInput(event.target.value)} placeholder="বাংলা বা English-এ লিখুন" style={{ flex: 1, minWidth: 0, padding: '10px 9px', border: '1px solid #ddd', borderRadius: 8, fontSize: 16 }} />
        <button type="button" aria-label={listening ? 'শুনছি' : 'ভয়েসে প্রশ্ন বলুন'} onClick={startVoice} disabled={busy || listening} title="কথা বলুন" style={{ border: '1px solid #ddd', borderRadius: 8, padding: '0 10px', background: listening ? '#e9eee5' : '#fff' }}>{listening ? 'শুনছি…' : '🎙️'}</button>
        <button type="submit" disabled={busy || !input.trim()} style={{ background: '#193e32', color: '#fff', border: 0, borderRadius: 8, padding: '0 12px', fontWeight: 700 }}>পাঠান</button>
      </form>
    </section>}
    <button type="button" onClick={() => setOpen(previous => !previous)} aria-expanded={open} style={{ background: '#193e32', color: 'white', border: 0, borderRadius: 32, padding: '14px 19px', boxShadow: '0 4px 16px #0003', cursor: 'pointer', fontWeight: 700 }}>💬 {open ? 'বন্ধ করুন' : 'চ্যাট সহায়তা'}</button>
  </div>;
}
