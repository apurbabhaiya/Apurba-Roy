import React, { useEffect, useState } from 'react';
import { ArrowLeft, Images, RefreshCw, Download, LockKeyhole } from 'lucide-react';
import { supabase } from '../services/supabase';
type Album = {id:string;title:string;event_date:string|null;photos:{id:string;download_enabled:boolean}[]};
const photoUrl = (album:string,file:string) => `/api/delivery-media?albumId=${encodeURIComponent(album)}&fileId=${encodeURIComponent(file)}`;
export default function PublicDeliveryAlbums({albumId}:{albumId?:string}) {
 const [albums,setAlbums] = useState<Album[]>([]),[loading,setLoading] = useState(true),[error,setError] = useState('');
 async function load() {
  setLoading(true);setError('');
  try {
   const {data,error} = await (supabase as any).rpc('public_delivery_albums',{p_album_id:albumId || null});
   if(error) throw error;
   setAlbums(Array.isArray(data)?data:[]);
  } catch {setError('অ্যালবাম লোড করা যায়নি। আবার চেষ্টা করুন।');setAlbums([]);}
  finally {setLoading(false);}
 }
 useEffect(()=>{void load();const refresh=()=>{if(!document.hidden)void load();};window.addEventListener('focus',refresh);return()=>window.removeEventListener('focus',refresh);},[albumId]);
 const selected = albumId ? albums[0] : null;
 return <main className="min-h-screen bg-stone-50 text-stone-900">
  <header className="border-b border-stone-200 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-5"><a href="/" className="font-bold tracking-widest">RAMYACHOBI</a><a href={albumId?'/delivery':'/'} className="inline-flex items-center gap-2 text-sm font-semibold"><ArrowLeft className="h-4 w-4"/>{albumId?'সব অ্যালবাম':'হোম'}</a></div></header>
  <div className="mx-auto max-w-6xl px-5 py-10"><div className="mb-8 flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-amber-700">Published albums</p><h1 className="mt-2 text-3xl font-bold">{selected?.title || (albumId?'অ্যালবাম':'প্রকাশিত অ্যালবাম')}</h1><p className="mt-2 text-sm text-stone-500">{albumId?'অনুষ্ঠানের ছবির প্রিভিউ':'আমাদের প্রকাশিত কাজগুলো দেখুন।'}</p></div><button type="button" disabled={loading} onClick={()=>void load()} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-semibold"><RefreshCw className={`h-4 w-4 ${loading?'animate-spin':''}`}/>রিফ্রেশ</button></div>
  {loading?<p role="status" className="rounded-2xl bg-white p-8">অ্যালবাম লোড হচ্ছে…</p>:error?<p role="alert" className="rounded-2xl bg-red-50 p-6 text-red-700">{error}</p>:!albums.length?<div className="rounded-3xl border border-dashed border-stone-300 bg-white p-12 text-center"><Images className="mx-auto h-10 w-10 text-stone-400"/><h2 className="mt-4 text-xl font-semibold">{albumId?'এই অ্যালবামটি এখন প্রকাশিত নেই':'এখনো কোনো অ্যালবাম প্রকাশ করা হয়নি'}</h2><p className="mt-2 text-sm text-stone-500">পরে আবার দেখুন।</p></div>:selected?<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{selected.photos.length?selected.photos.map((photo,i)=><figure key={photo.id} className="overflow-hidden rounded-2xl border border-stone-200 bg-white"><img src={photoUrl(selected.id,photo.id)} alt={`${selected.title} · ছবি ${i+1}`} loading="lazy" className="aspect-square w-full object-contain bg-stone-100"/><figcaption className="flex items-center justify-between gap-2 p-3"><span className="text-xs text-stone-500">ছবি {i+1}</span>{photo.download_enabled ? <a href={`${photoUrl(selected.id,photo.id)}&mode=ORIGINAL`} aria-label={`ছবি ${i+1} ডাউনলোড`} className="inline-flex items-center gap-2 rounded-xl bg-stone-950 px-3 py-2 text-xs font-bold text-white"><Download className="h-4 w-4"/>ডাউনলোড</a> : <span className="inline-flex items-center gap-1 text-xs text-stone-500"><LockKeyhole className="h-4 w-4"/>ডাউনলোড বন্ধ</span>}</figcaption></figure>):<p className="rounded-2xl bg-white p-6 text-stone-500">এই অ্যালবামে এখনো প্রকাশযোগ্য ছবি নেই।</p>}</div>:<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{albums.map(album=><a key={album.id} href={`/delivery/album/${album.id}`} className="group overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"><div className="aspect-[4/3] bg-stone-200">{album.photos[0]?<img src={photoUrl(album.id,album.photos[0].id)} alt={album.title} loading="lazy" className="h-full w-full object-cover"/>:<div className="grid h-full place-items-center"><Images className="h-12 w-12 text-stone-400"/></div>}</div><div className="p-5"><h2 className="text-xl font-semibold">{album.title}</h2><p className="mt-2 text-sm text-stone-500">{album.event_date || 'তারিখ উল্লেখ নেই'} · {album.photos.length} ছবি</p><span className="mt-4 inline-block text-sm font-bold text-amber-700">অ্যালবাম দেখুন →</span></div></a>)}</div>}
  </div>
 </main>;
}
