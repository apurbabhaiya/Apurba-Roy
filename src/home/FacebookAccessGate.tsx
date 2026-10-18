import React, { useEffect, useState } from 'react';
import { facebookAuth, facebookLogin, galleryDestination } from '../services/facebookAccess';
import FacebookPageActions from './FacebookPageActions';

export default function FacebookAccessGate({ children, callback = false }: { children?: React.ReactNode; callback?: boolean }) {
  const [state, setState] = useState<'loading' | 'signed-out' | 'signed-in'>('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const destination = galleryDestination(callback ? new URLSearchParams(window.location.search).get('next') : window.location.pathname + window.location.search);
  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const { data, error: authError } = await facebookAuth.auth.getUser();
        if (!active) return;
        const authenticated = !authError && !data.user?.is_anonymous && data.user?.app_metadata?.provider === 'facebook';
        setState(authenticated ? 'signed-in' : 'signed-out');
        if (authenticated && callback) window.location.replace(destination);
      } catch { if (active) { setState('signed-out'); setError('লগইন যাচাই হয়নি। আবার চেষ্টা করুন।'); } }
    };
    const params = new URLSearchParams(window.location.hash.slice(1));
    if (params.has('error') || new URLSearchParams(window.location.search).has('error')) {
      setError('Facebook Login সম্পন্ন হয়নি। অনুমতি দিয়ে আবার চেষ্টা করুন।');
      window.history.replaceState(null, '', window.location.pathname + window.location.search.split('&error')[0]);
    }
    void check();
    // Do not call async auth methods inside the auth event callback.
    const { data: { subscription } } = facebookAuth.auth.onAuthStateChange(() => { setTimeout(() => { if (active) void check(); }, 0); });
    return () => { active = false; subscription.unsubscribe(); };
  }, [callback, destination]);

  if (state === 'loading') return <main className="grid min-h-screen place-items-center bg-stone-100" role="status">লগইন যাচাই হচ্ছে...</main>;
  if (state === 'signed-in' && !callback) return <><aside className="flex flex-wrap items-center justify-between gap-3 bg-stone-950 px-5 py-3 text-white"><FacebookPageActions /><button className="text-sm underline" onClick={async () => { try { const { error } = await facebookAuth.auth.signOut(); if (error) throw error; setState('signed-out'); } catch { setError('লগআউট হয়নি। আবার চেষ্টা করুন।'); } }}>Log out</button>{error && <p role="alert">{error}</p>}</aside>{children}</>;
  return <main className="grid min-h-screen place-items-center bg-[#f7f3ed] px-5 py-10 text-stone-950"><section className="w-full max-w-lg rounded-3xl border border-stone-200 bg-white p-7 shadow-lg"><a href="/" className="text-sm font-bold tracking-widest">RAMYACHOBI</a><h1 className="mt-6 text-3xl font-semibold">Continue with Facebook</h1><p className="mt-3 leading-7 text-stone-600">FACE SEARCH ও CLIENT GALLERY ব্যবহার করতে Facebook দিয়ে লগইন করুন। লগইনের পরে আপনার নির্বাচিত পেজ খুলবে।</p><button disabled={busy} onClick={async () => { setBusy(true); setError(''); try { await facebookLogin(destination); } catch (e) { setError(e instanceof Error ? e.message : 'লগইন হয়নি। আবার চেষ্টা করুন।'); setBusy(false); } }} className="mt-6 w-full rounded-xl bg-[#1877f2] px-5 py-4 font-bold text-white disabled:opacity-60">{busy ? 'Facebook খুলছে...' : 'Continue with Facebook'}</button>{error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}<p className="mt-5 text-sm leading-6 text-stone-500">Follow ও Review ঐচ্ছিক। এগুলো না করলেও লগইনের পরে প্রবেশ করতে পারবেন। রিভিউ Facebook-এ গিয়ে জমা দিতে হবে।</p><div className="mt-5"><FacebookPageActions /></div></section></main>;
}
