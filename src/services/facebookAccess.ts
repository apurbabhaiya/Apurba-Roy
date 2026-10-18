import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './supabase';

// Client login must not replace the studio's Google Drive or gallery claim session.
export const facebookAuth = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { storageKey: 'ramyachobi-facebook-client-v1', persistSession: true, autoRefreshToken: true, detectSessionInUrl: window.location.pathname === '/facebook-login' },
});

export function galleryDestination(value: string | null): string {
  if (!value || !/^\/(face-search|client-gallery|albums|album)(\/|\?|$)/.test(value) || /[\\\r\n]/.test(value)) return '/client-gallery';
  const url = new URL(value, window.location.origin);
  return url.origin === window.location.origin && /^\/(face-search|client-gallery|albums|album)(\/|$)/.test(url.pathname) ? url.pathname + url.search : '/client-gallery';
}

export async function facebookLogin(next: string): Promise<void> {
  const settings = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_PUBLISHABLE_KEY } });
  if (!settings.ok) throw new Error('লগইন সেবা পাওয়া যাচ্ছে না। আবার চেষ্টা করুন।');
  const configuration = await settings.json();
  if (!configuration.external?.facebook) throw new Error('Facebook Login এখনো চালু হয়নি। স্টুডিওকে জানান অথবা পরে চেষ্টা করুন।');
  const callback = new URL('/facebook-login', window.location.origin);
  callback.searchParams.set('next', galleryDestination(next));
  const { error } = await facebookAuth.auth.signInWithOAuth({ provider: 'facebook', options: { scopes: 'email', redirectTo: callback.toString() } });
  if (error) throw error;
}
