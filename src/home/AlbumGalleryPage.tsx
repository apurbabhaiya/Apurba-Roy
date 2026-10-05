import React, { useEffect, useMemo, useState } from 'react';
import { Camera, Download, Image as ImageIcon, Search, Upload, X } from 'lucide-react';
import { getCustomerGalleries, getCustomerGalleryByToken, generateDriveThumbnailUrl } from '../services/customerGalleryService';
import { searchFaceInAlbum } from '../services/faceSearchService';
import type { CustomerGallery, CustomerGalleryPhoto, DrivePhoto } from '../types';

const toDrivePhoto = (p: CustomerGalleryPhoto): DrivePhoto => ({
  id: p.driveFileId, name: p.name, mimeType: p.mimeType || 'image/jpeg',
  thumbnailLink: p.thumbnailUrl, webContentLink: p.originalUrl,
  size: p.size, createdTime: p.createdTime,
});

function PhotoCard({ photo, onDownload }: { photo: CustomerGalleryPhoto; onDownload: () => void }) {
  const src = generateDriveThumbnailUrl(photo.driveFileId, photo.thumbnailUrl || photo.previewUrl);
  return <article className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
    <img src={src} alt={photo.name} className="aspect-square w-full object-cover" loading="lazy" />
    <div className="flex items-center justify-between gap-2 p-2.5">
      <span className="min-w-0 truncate text-xs text-stone-600">{photo.name}</span>
      <button onClick={onDownload} className="shrink-0 rounded-lg bg-rose-600 p-2 text-white" title="Download"><Download className="h-4 w-4" /></button>
    </div>
  </article>;
}

export default function AlbumGalleryPage({ token }: { token?: string }) {
  const [gallery, setGallery] = useState<CustomerGallery | null>(null);
  const [galleries, setGalleries] = useState<CustomerGallery[]>([]);
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<CustomerGalleryPhoto[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (token) getCustomerGalleryByToken(token).then(setGallery).catch(e => setError(e.message));
    else getCustomerGalleries().then(setGalleries).catch(e => setError(e.message));
  }, [token]);

  const photos = useMemo(() => matches || gallery?.photos || [], [matches, gallery]);
  const download = (photo: CustomerGalleryPhoto) => {
    const src = photo.originalUrl || photo.previewUrl || photo.thumbnailUrl;
    const a = document.createElement('a'); a.href = src; a.download = photo.name || 'photo.jpg'; a.target = '_blank'; a.click();
  };

  const runFaceSearch = async (file: File) => {
    if (!gallery?.photos?.length) return;
    setSearching(true); setError('');
    try {
      const reader = new FileReader();
      const data = await new Promise<string>((resolve, reject) => { reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
      const result = await searchFaceInAlbum(data, gallery.photos!.map(toDrivePhoto));
      const ids = new Set(result.map(r => r.photoId));
      setMatches(gallery.photos!.filter(p => ids.has(p.driveFileId)));
    } catch (e: any) { setError(e.message || 'Face search failed.'); }
    finally { setSearching(false); }
  };

  if (!token) return <main className="min-h-screen bg-[#f7f3ed] px-5 py-10"><div className="mx-auto max-w-6xl">
    <header className="mb-8 flex items-end justify-between"><div><a href="/" className="font-semibold tracking-[.18em]">RAMYACHOBI</a><h1 className="mt-5 font-serif text-5xl">All Album <span className="text-rose-600">Gallery</span></h1><p className="mt-2 text-stone-600">Browse published client albums.</p></div><a href="/face-search" className="rounded-xl bg-stone-950 px-4 py-3 text-sm font-semibold text-white">Face Search</a></header>
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{galleries.map(g => <article key={g.id} className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"><img src={g.coverPhotoUrl || g.photos?.[0]?.thumbnailUrl} className="aspect-[4/3] w-full object-cover" /><div className="p-4"><h2 className="font-semibold">{g.customerName || g.galleryName}</h2><p className="text-xs text-stone-500">{g.eventName} · {g.totalPhotos} Photos</p><a href={'/album/' + encodeURIComponent(g.secureToken)} className="mt-4 block rounded-xl bg-rose-600 px-4 py-2 text-center text-sm font-bold text-white">Open Gallery</a></div></article>)}</div>
    {error && <p className="mt-6 text-red-700">{error}</p>}
  </div></main>;

  if (!gallery) return <div className="min-h-screen grid place-items-center bg-[#f7f3ed]">Loading album...</div>;
  return <main className="min-h-screen bg-[#f7f3ed] px-4 py-6 text-stone-950"><div className="mx-auto max-w-7xl">
    <header className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><a href="/albums" className="text-sm font-semibold tracking-[.16em]">RAMYACHOBI / ALBUMS</a><h1 className="mt-2 font-serif text-3xl">{gallery.galleryName || gallery.eventName}</h1><p className="text-sm text-stone-500">{photos.length} photos shown</p></div>{matches && <button onClick={() => setMatches(null)} className="flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm"><X className="h-4 w-4" /> All photos</button>}</header>
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-3xl bg-stone-950 p-5 text-white shadow-lg"><div className="flex items-center gap-3"><div className="rounded-2xl bg-rose-600 p-3"><Camera /></div><div><h2 className="text-2xl font-semibold">Face Search</h2><p className="text-sm text-stone-400">Upload a face photo to find matching photos.</p></div></div><label className="mt-6 flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 font-bold">{searching ? 'Searching album...' : <><Upload className="h-5 w-5" /> Upload face photo</>}<input type="file" accept="image/*" className="hidden" disabled={searching} onChange={e => e.target.files?.[0] && runFaceSearch(e.target.files[0])} /></label><div className="mt-4 rounded-2xl border border-stone-800 p-4 text-sm text-stone-400">Only this album's {gallery.totalPhotos || gallery.photos?.length || 0} photos are searched. Photo Selection is not available in this gallery.</div>{error && <p className="mt-4 text-rose-300">{error}</p>}</section>
      <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><div className="rounded-2xl bg-blue-600 p-3 text-white"><ImageIcon /></div><div><h2 className="text-2xl font-semibold">{matches ? 'Matched Photos' : 'All Photos'}</h2><p className="text-sm text-stone-500">Preview and download photos</p></div></div><div className="mt-5 grid max-h-[70vh] grid-cols-2 gap-3 overflow-auto sm:grid-cols-3">{photos.map(p => <PhotoCard key={p.driveFileId} photo={p} onDownload={() => download(p)} />)}</div></section>
    </div>
  </div></main>;
}
