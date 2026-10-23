import React, { useState } from 'react';

type Message = { role: 'assistant' | 'user'; text: string };
const suggestions = ['প্যাকেজের দাম কত?', '২টি অতিরিক্ত অনুষ্ঠানের বিল', 'ডিসকাউন্ট কীভাবে পাব?'];

export default function RamyaChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', text: 'স্বাগতম! 📸 Ramya Chobi-এর প্যাকেজ, বুকিং ও ফটোগ্রাফি নিয়ে প্রশ্ন করুন।' },
  ]);
  const [busy, setBusy] = useState(false);

  async function send(value = input) {
    const question = value.trim();
    if (!question || busy) return;
    const history = [...messages, { role: 'user' as const, text: question }];
    setMessages(history);
    setInput('');
    setBusy(true);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: question, history: history.slice(-8) }),
      });
      if (!response.ok) throw new Error('Chat unavailable');
      const data = await response.json();
      setMessages(previous => [...previous, { role: 'assistant', text: String(data.reply || 'দুঃখিত, এই মুহূর্তে উত্তর পাওয়া যাচ্ছে না।') }]);
    } catch {
      setMessages(previous => [...previous, { role: 'assistant', text: 'এই মুহূর্তে AI সেবা পাওয়া যাচ্ছে না। বুকিং পেজ থেকে প্যাকেজ ও দাম যাচাই করুন।' }]);
    } finally {
      setBusy(false);
    }
  }

  return <div style={{ position: 'fixed', right: 18, bottom: 18, zIndex: 10000, fontFamily: 'inherit' }}>
    {open && <section aria-label="Ramya Chobi AI Support" style={{ width: 'min(350px, calc(100vw - 36px))', height: 470, background: '#fff', color: '#172033', borderRadius: 18, boxShadow: '0 12px 48px #0003', display: 'flex', flexDirection: 'column', overflow: 'hidden', marginBottom: 12 }}>
      <header style={{ padding: 16, background: '#192b43', color: '#fff', fontWeight: 700 }}>📸 Ramya Chobi AI Support <button onClick={() => setOpen(false)} aria-label="Close chat" style={{ float: 'right', color: 'white', background: 'none', border: 0, cursor: 'pointer' }}>✕</button></header>
      <div aria-live="polite" style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {messages.map((message, index) => <div key={index} style={{ background: message.role === 'user' ? '#dceafe' : '#f2f4f7', margin: '8px 0', marginLeft: message.role === 'user' ? 35 : 0, marginRight: message.role === 'assistant' ? 35 : 0, padding: 10, borderRadius: 12, whiteSpace: 'pre-wrap' }}>{message.text}</div>)}
        {busy && <p>উত্তর তৈরি হচ্ছে...</p>}
      </div>
      <div style={{ padding: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>{suggestions.map(s => <button key={s} onClick={() => void send(s)} disabled={busy} style={{ fontSize: 11, padding: 6, borderRadius: 20, border: '1px solid #ddd', background: '#fff' }}>{s}</button>)}</div>
      <form onSubmit={event => { event.preventDefault(); void send(); }} style={{ padding: 10, display: 'flex', gap: 8 }}>
        <input aria-label="Your question" value={input} onChange={event => setInput(event.target.value)} placeholder="বাংলা বা English-এ লিখুন" style={{ flex: 1, minWidth: 0, padding: 9, border: '1px solid #ddd', borderRadius: 8 }} />
        <button type="submit" disabled={busy || !input.trim()} style={{ background: '#192b43', color: '#fff', border: 0, borderRadius: 8, padding: '0 14px' }}>পাঠান</button>
      </form>
    </section>}
    <button onClick={() => setOpen(previous => !previous)} aria-expanded={open} style={{ background: '#192b43', color: 'white', border: 0, borderRadius: 32, padding: '14px 20px', boxShadow: '0 4px 16px #0003', cursor: 'pointer' }}>💬 {open ? 'বন্ধ করুন' : 'AI Live Chat'}</button>
  </div>;
}
