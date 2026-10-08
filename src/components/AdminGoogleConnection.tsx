import React, { useEffect, useState } from 'react';
import { googleSupabaseSignIn, initSupabaseAuth, getGoogleDriveAccessToken } from '../services/supabaseAuth';

// Google identity and Drive consent do not grant booking/delivery admin privileges.
export default function AdminGoogleConnection() {
  const [email, setEmail] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let currentCheck = 0;
    const stop = initSupabaseAuth(
      user => {
        const check = ++currentCheck;
        setEmail(user.email || null);
        setConnected(false);
        const token = getGoogleDriveAccessToken();
        if (!token) { setChecking(false); return; }
        setChecking(true);
        void fetch('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)', {
          headers: { Authorization: `Bearer ${token}` },
        }).then(async response => {
          if (!response.ok) throw new Error(response.status === 401 ? 'Google Drive authorization expired. Reconnect your account.' : 'Drive access could not be verified. Check Google permissions and reconnect.');
          const data = await response.json();
          if (check !== currentCheck) return;
          setEmail(data.user?.emailAddress || user.email || null);
          setConnected(true);
          setError('');
        }).catch(err => {
          if (check === currentCheck) setError(err instanceof Error ? err.message : 'Drive connection check failed.');
        }).finally(() => { if (check === currentCheck) setChecking(false); });
      },
      () => { ++currentCheck; setEmail(null); setConnected(false); setChecking(false); }
    );
    return () => { ++currentCheck; stop(); };
  }, []);

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
          <div className="font-semibold">Google Drive {checking ? 'checking access…' : connected ? 'access verified in this browser' : 'not connected'}</div>
          {email && <div className="break-all text-xs text-stone-600">{email}</div>}
        </div>
        <button type="button" onClick={connect} disabled={busy} className="rounded-lg bg-stone-950 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? 'Connecting…' : connected ? 'Reconnect / Change Google account' : 'Sign in with Google & Connect Drive'}
        </button>
      </div>
      <p className="mt-2 text-xs text-stone-600">Connect the account containing your files. Client downloads also require the studio server connection.</p>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
