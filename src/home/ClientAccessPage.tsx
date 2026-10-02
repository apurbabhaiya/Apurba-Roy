import React, { useState } from 'react';
import { ArrowRight, Camera, FolderHeart, KeyRound, ShieldCheck } from 'lucide-react';

function extractGalleryToken(value: string) {
  const raw = value.trim();
  if (!raw) return '';

  try {
    const url = new URL(raw);
    const galleryMatch = url.pathname.match(/\/(?:gallery|select)\/([^/?#]+)/);
    if (galleryMatch?.[1]) return decodeURIComponent(galleryMatch[1]);
  } catch {}

  const pathMatch = raw.match(/\/(?:gallery|select)\/([^/?#]+)/);
  if (pathMatch?.[1]) return decodeURIComponent(pathMatch[1]);

  return raw.replace(/^\s+|\s+$/g, '');
}

export default function ClientAccessPage({ mode }: { mode: 'face' | 'gallery' }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const faceMode = mode === 'face';

  function openGallery(e: React.FormEvent) {
    e.preventDefault();
    const token = extractGalleryToken(value);
    if (!token) {
      setError('Enter your private gallery token or client gallery link.');
      return;
    }
    window.location.href = `/gallery/${encodeURIComponent(token)}`;
  }

  const Icon = faceMode ? Camera : FolderHeart;

  return (
    <main className="min-h-screen bg-[#f7f3ed] px-5 py-14 text-stone-950">
      <div className="mx-auto max-w-3xl">
        <a href="/" className="text-sm font-semibold tracking-[0.16em]">RAMYACHOBI</a>

        <div className="mt-10 rounded-[2rem] border border-stone-300 bg-white p-7 shadow-sm sm:p-10">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-950 text-amber-300">
            <Icon className="h-7 w-7" />
          </div>

          <div className="mt-6 text-xs font-bold uppercase tracking-[0.22em] text-amber-800">
            {faceMode ? 'Face Search' : 'Client Gallery'}
          </div>
          <h1 className="mt-2 font-serif text-4xl">
            {faceMode ? 'Find your photos inside your private gallery.' : 'Open your private RamyaChobi gallery.'}
          </h1>
          <p className="mt-4 max-w-2xl leading-7 text-stone-600">
            {faceMode
              ? 'Face Search works inside an assigned client gallery because it needs access to that gallery’s photo set. Enter your private gallery link or token first, then use the Face Search tool in the gallery.'
              : 'Enter the private gallery link or token provided by RamyaChobi. Client galleries are not publicly searchable.'}
          </p>

          <form onSubmit={openGallery} className="mt-8">
            <label className="block text-sm font-semibold">Private gallery link or token</label>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              <input
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setError('');
                }}
                placeholder="Paste /gallery/... link or gallery token"
                className="min-w-0 flex-1 rounded-xl border border-stone-300 px-4 py-3 outline-none focus:border-stone-950"
              />
              <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-stone-950 px-5 py-3 font-bold text-white">
                Open Gallery <ArrowRight className="h-4 w-4" />
              </button>
            </div>
            {error && <div className="mt-3 text-sm font-medium text-red-700">{error}</div>}
          </form>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-stone-50 p-4">
              <ShieldCheck className="h-5 w-5 text-amber-700" />
              <div className="mt-2 font-semibold">Private access</div>
              <div className="mt-1 text-sm leading-6 text-stone-500">Only the gallery link or token assigned to the client should open the project.</div>
            </div>
            <div className="rounded-2xl bg-stone-50 p-4">
              <KeyRound className="h-5 w-5 text-amber-700" />
              <div className="mt-2 font-semibold">Need your link?</div>
              <div className="mt-1 text-sm leading-6 text-stone-500">Use the link sent by RamyaChobi or contact the studio for the correct client gallery access.</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
