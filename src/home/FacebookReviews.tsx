import React from 'react';
import FacebookPageActions from './FacebookPageActions';

// Only studio-selected, public Facebook post permalinks can be embedded.
const posts = String(import.meta.env.VITE_FACEBOOK_REVIEW_POST_URLS || '').split(',').map(value => value.trim()).filter(value => {
  try { const url = new URL(value); return url.protocol === 'https:' && ['www.facebook.com', 'facebook.com'].includes(url.hostname) && (/\/posts\//.test(url.pathname) || ['/permalink.php', '/story.php'].includes(url.pathname)); } catch { return false; }
}).slice(0, 6);

export default function FacebookReviews() {
  return <div className="mt-0 rounded-3xl border border-stone-200 bg-[#faf8f4] p-4 text-center sm:p-6"><h3 className="text-xl font-semibold">Facebook Reviews</h3><p className="mx-auto my-4 max-w-xl text-sm leading-6 text-stone-600">আপনার অভিজ্ঞতা Facebook পেজে লিখুন। রিভিউ Facebook-এই জমা হবে। Follow ও Review করা ঐচ্ছিক।</p><FacebookPageActions />{posts.length > 0 ? <div className="mt-6 grid gap-5 lg:grid-cols-2">{posts.map((post, index) => <div key={post}><iframe title={`RamyaChobi Facebook review ${index + 1}`} src={`https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(post)}&show_text=true&width=500`} className="h-[520px] w-full border-0" loading="lazy" allow="encrypted-media; picture-in-picture; web-share" /><a href={post} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-700 underline">Facebook-এ মূল রিভিউ দেখুন ↗</a></div>)}</div> : <p className="mt-4 text-sm text-stone-500">রিভিউ পড়তে Facebook পেজ খুলুন।</p>}</div>;
}
