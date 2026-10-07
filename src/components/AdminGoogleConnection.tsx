import React, { useEffect, useState } from 'react';
import { googleSupabaseSignIn, initSupabaseAuth, getGoogleDriveAccessToken } from '../services/supabaseAuth';

// Google identity and Drive consent do not grant booking/delivery admin privileges.
export default function AdminGoogleConnection() {
  const [email, setEmail] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => initSupabaseAuth(
    user => { setEmail(user.email || null); setConnected(Boolean(getGoogleDriveAccessToken())); },
    () => { setEmail(null); setConnected(false); }
  ), []);

  async function connect() {
    setBusy(true);
    setError('');
    try { await googleSupabaseSignIn(true); }
    catch (err) { setError(err instanceof Error ? err.message : 'Google connection failed. Try again.'); setBusy(false); }
  }

  return (
    <div className="rounded-xl border border-stone-300 bg-white p-3 text-stone-900">
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-sm">
          <div className="font-semibold">Google Drive {connected ? 'connected' : 'not connected'}</div>
          {email && <div className="break-all text-xs text-stone-600">{email}</div>}
        </div>
        <button type="button" onClick={connect} disabled={busy} className="rounded-lg bg-stone-950 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? 'Connecting…' : connected ? 'Reconnect / Change Google account' : 'Sign in with Google & Connect Drive'}
        </button>
      </div>
      <p className="mt-2 text-xs text-stone-600">Connect the Google account containing your delivery files. Admin access is verified separately.</p>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
