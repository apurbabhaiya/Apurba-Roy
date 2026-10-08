import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Cloud, Loader2, RefreshCw } from 'lucide-react';

type DriveStatus = { status: 'connected' | 'disconnected' | 'reconnect_required' | 'error'; email?: string | null; displayName?: string; connectedAt?: string | null; error?: string };

export default function DriveConnectionCard({ adminToken }: { adminToken: string }) {
  const [data, setData] = useState<DriveStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/drive-status', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ adminToken }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error || 'Drive connection status could not be checked.');
      setData(result);
    } catch (e: any) { setData({ status: 'error' }); setError(e?.message || 'Drive status check failed.'); }
    finally { setLoading(false); }
  }, [adminToken]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get('drive') === 'connected' || query.get('drive') === 'error') {
      if (query.get('drive') === 'error') setError(query.get('driveError') || 'Google Drive connection failed.');
      void refresh();
      query.delete('drive'); query.delete('driveError');
      const next = `${window.location.pathname}${query.size ? `?${query}` : ''}${window.location.hash}`;
      window.history.replaceState({}, '', next);
    }
  }, [refresh]);

  async function connect() {
    setConnecting(true); setError('');
    try {
      const response = await fetch('/api/drive-oauth-start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ adminToken }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.authorizationUrl) throw new Error(result?.error || 'Google authorization could not start.');
      window.location.assign(result.authorizationUrl);
    } catch (e: any) { setError(e?.message || 'Google authorization could not start.'); setConnecting(false); }
  }

  const connected = data?.status === 'connected';
  const reconnect = data?.status === 'reconnect_required';
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`rounded-xl p-2.5 ${connected ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-600'}`}><Cloud className="h-5 w-5" /></span>
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-[.16em] text-stone-500">Google Drive · Server connection</div>
            {loading ? <div className="mt-1 flex items-center gap-2 text-sm text-stone-500"><Loader2 className="h-4 w-4 animate-spin" />Checking Google authorization…</div> : connected ? <div className="mt-1 flex flex-wrap items-center gap-2 text-sm font-semibold text-stone-900"><CheckCircle2 className="h-4 w-4 text-emerald-600" />{data?.displayName || data?.email}<span className="font-normal text-stone-500">{data?.email}</span></div> : <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-stone-700"><AlertCircle className="h-4 w-4 text-amber-600" />{reconnect ? `Reconnect required · ${data?.email || ''}` : 'Not connected'}</div>}
            {error && <div className="mt-1 text-xs text-red-700">{error}</div>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => void refresh()} disabled={loading || connecting} className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 px-3 py-2 text-sm font-semibold"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh</button>
          <button onClick={() => void connect()} disabled={connecting} className="rounded-xl bg-stone-950 px-3.5 py-2 text-sm font-bold text-white disabled:opacity-50">{connecting ? 'Connecting…' : connected ? 'Reconnect / Change Account' : 'Connect Google'}</button>
        </div>
      </div>
    </section>
  );
}
