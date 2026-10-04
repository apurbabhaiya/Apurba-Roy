import React, { useState } from 'react';
import { ImagePlus, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '../services/supabase';

export const WatermarkSettingsPanel: React.FC = () => {
  const [logoUrl, setLogoUrl] = useState(() => localStorage.getItem('rcfoto_global_watermark_logo') || '');
  const [position, setPosition] = useState(() => localStorage.getItem('rcfoto_watermark_position') || 'top-right');
  const [opacity, setOpacity] = useState(() => Number(localStorage.getItem('rcfoto_watermark_opacity') || 72));
  const [size, setSize] = useState(() => Number(localStorage.getItem('rcfoto_watermark_size') || 18));
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function uploadLogo(file?: File) {
    if (!file) return;
    if (!file.type.includes('png') && !file.type.includes('jpeg') && !file.type.includes('webp')) { setStatus('Use PNG, JPG or WebP.'); return; }
    setBusy(true); setStatus('Uploading logo...');
    const path = `ramyachobi-logo-${Date.now()}.${file.name.split('.').pop()}`;
    const { error } = await supabase.storage.from('branding-assets').upload(path, file, { upsert: true, contentType: file.type });
    if (error) { setStatus(error.message); setBusy(false); return; }
    const { data } = supabase.storage.from('branding-assets').getPublicUrl(path);
    setLogoUrl(data.publicUrl); localStorage.setItem('rcfoto_global_watermark_logo', data.publicUrl); setStatus('Logo uploaded and saved.'); setBusy(false);
  }
  function save() { localStorage.setItem('rcfoto_watermark_position', position); localStorage.setItem('rcfoto_watermark_opacity', String(opacity)); localStorage.setItem('rcfoto_watermark_size', String(size)); setStatus('Watermark settings saved.'); }
  return <div className="rounded-3xl border border-stone-800 bg-stone-900 p-6 text-stone-100 space-y-5">
    <div><div className="text-xs uppercase tracking-[.2em] text-amber-400">Watermark & Logo</div><h2 className="mt-1 text-xl font-serif">Ramyachobi download branding</h2><p className="mt-1 text-xs text-stone-400">Upload a transparent PNG logo and configure its position for watermarked downloads.</p></div>
    <div className="grid gap-5 md:grid-cols-[1fr_220px]">
      <div className="space-y-4">
        <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-stone-700 bg-stone-950 p-4"><Upload className="h-5 w-5 text-amber-400"/><span className="flex-1 text-sm">{busy ? 'Uploading...' : 'Upload / replace logo'}</span><input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e=>uploadLogo(e.target.files?.[0])}/><span className="rounded-xl bg-amber-400 px-3 py-2 text-xs font-bold text-stone-950">Choose file</span></label>
        <div className="grid gap-3 sm:grid-cols-3"><label className="text-xs text-stone-400">Position<select value={position} onChange={e=>setPosition(e.target.value)} className="mt-1 w-full rounded-xl border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100"><option value="top-left">Top left</option><option value="top-right">Top right</option><option value="bottom-left">Bottom left</option><option value="bottom-right">Bottom right</option><option value="center">Center</option></select></label><label className="text-xs text-stone-400">Size {size}%<input type="range" min="8" max="35" value={size} onChange={e=>setSize(Number(e.target.value))} className="mt-3 w-full"/></label><label className="text-xs text-stone-400">Opacity {opacity}%<input type="range" min="20" max="100" value={opacity} onChange={e=>setOpacity(Number(e.target.value))} className="mt-3 w-full"/></label></div>
        <button onClick={save} className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-bold text-stone-950">Save global settings</button>
        {status && <div className="flex items-center gap-2 text-xs text-stone-300"><CheckCircle2 className="h-4 w-4 text-emerald-400"/>{status}</div>}
      </div>
      <div className="flex min-h-44 items-center justify-center rounded-2xl border border-stone-700 bg-stone-800 p-4" style={{backgroundImage:'linear-gradient(135deg,#334155 25%,#475569 25%,#475569 50%,#334155 50%,#334155 75%,#475569 75%)',backgroundSize:'24px 24px'}}>{logoUrl ? <img src={logoUrl} alt="Ramyachobi watermark preview" style={{width:`${size*3}%`,opacity:opacity/100}} className="max-w-[80%]"/> : <div className="text-center text-xs text-stone-300"><ImagePlus className="mx-auto mb-2 h-7 w-7"/>Upload logo to preview</div>}</div>
    </div>
  </div>;
};
