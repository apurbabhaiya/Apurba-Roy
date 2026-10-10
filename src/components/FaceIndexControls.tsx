import React, { useEffect, useState } from 'react';
import { getFaceIndexStatus, startFaceIndex, type FaceIndexStatus } from '../services/faceIndexService';

export function FaceIndexControls({ galleryId }: { galleryId: string }) {
  const [status, setStatus] = useState<FaceIndexStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const refresh = () => getFaceIndexStatus(galleryId).then(value => { if (active) setStatus(value); })
      .catch(() => { if (active) setError('Face index status unavailable. Refresh to retry.'); });
    void refresh();
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 15000);
    return () => { active = false; clearInterval(timer); };
  }, [galleryId]);
  async function run(retry: boolean, rebuild = false) {
    setBusy(true); setError('');
    try { setStatus(await startFaceIndex(galleryId, retry, rebuild)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Index could not start.'); }
    finally { setBusy(false); }
  }
  return <div className="w-full rounded-xl border border-stone-700 p-3 text-xs text-stone-300">
    <p className="font-semibold text-amber-300">Face search index</p>
    {status && <p className="mt-1" role="status">{status.ready + status.noFace}/{status.total} processed · {status.pending + status.unindexed} pending · {status.failed} unreadable · {status.noFace} no face</p>}
    <div className="mt-2 flex flex-wrap gap-2">
      <button disabled={busy} onClick={() => void run(false)} className="rounded-lg bg-amber-400 px-3 py-2 font-semibold text-stone-950 disabled:opacity-50">{busy ? 'Starting…' : 'Start / Resume Index'}</button>
      {!!status?.failed && <button disabled={busy} onClick={() => void run(true)} className="rounded-lg border border-stone-600 px-3 py-2">Retry unreadable</button>}
      <button disabled={busy} onClick={() => { if (confirm('Rebuild this album’s face index? Search pauses until processing finishes. Original photos and selections stay unchanged.')) void run(false, true); }} className="rounded-lg border border-stone-600 px-3 py-2">Rebuild index</button>
      <button disabled={busy} onClick={() => { setError(''); void getFaceIndexStatus(galleryId).then(setStatus).catch(e => setError(e.message)); }} className="rounded-lg border border-stone-600 px-3 py-2">Refresh status</button>
    </div>
    <p className="mt-2 text-stone-400">Runs in the background. Original Drive files remain unchanged. Failed previews need accessible Photo Selection thumbnails before retrying.</p>
    {error && <p className="mt-2 text-rose-300" role="alert">{error}</p>}
  </div>;
}
