import React, { useEffect, useState } from 'react';
import { getCustomerGalleryByToken } from '../services/customerGalleryService';
import type { CustomerGallery } from '../types';
export default function GalleryFollowGatePage({ token }: { token: string }) {
 const [gallery,setGallery]=useState<CustomerGallery|null>(null); const [error,setError]=useState(''); const [fb,setFb]=useState(false); const [ig,setIg]=useState(false);
 const next='/client-gallery/'+encodeURIComponent(token);
 useEffect(()=>{getCustomerGalleryByToken(token).then(g=>{if(!g){setError('Album পাওয়া যায়নি');return;}setGallery(g);if(!g.requireSocialFollow)window.location.replace(next);}).catch(()=>setError('Album load হয়নি'));},[token]);
 if(error)return <main>{error}</main>; if(!gallery)return <main>Loading album...</main>;
 return <main className="min-h-screen grid place-items-center bg-stone-100 p-5"><section className="max-w-lg rounded-3xl bg-white p-8 shadow-xl"><h1 className="text-3xl font-bold">Follow Gate</h1><p className="my-4">Facebook ও Instagram follow করে confirmation দিন। এটি আপনার confirmation, automatic verification নয়।</p><div className="flex gap-4"><a className="text-blue-600" href="https://www.facebook.com/RamyaChobi/" target="_blank" rel="noreferrer">Open Facebook</a><a className="text-pink-600" href="https://www.instagram.com/romochobi/" target="_blank" rel="noreferrer">Open Instagram</a></div><label className="block my-5"><input type="checkbox" checked={fb} onChange={e=>setFb(e.target.checked)}/> I Have Followed Facebook</label><label className="block my-5"><input type="checkbox" checked={ig} onChange={e=>setIg(e.target.checked)}/> I Have Followed Instagram</label><button disabled={!fb||!ig} className="rounded-xl bg-stone-950 text-white p-4 disabled:opacity-40" onClick={()=>{sessionStorage.setItem('album_follow_'+gallery.id,'confirmed');window.location.href=next;}}>Continue to Gallery</button></section></main>;
}
