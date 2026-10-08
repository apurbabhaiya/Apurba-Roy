import React, { useEffect, useState } from 'react';
import { ArrowLeft, Check, File, FileImage, FileText, Folder, Loader2, RefreshCw, Video, X } from 'lucide-react';

type DriveItem = { id: string; name: string; mimeType: string; size?: string; modifiedTime?: string; thumbnailLink?: string };
type Props = { isOpen: boolean; adminToken: string; onClose: () => void; onSelect: (item: DriveItem) => void };

function kind(item: DriveItem) {
  if (item.mimeType === 'application/vnd.google-apps.folder') return 'folder';
  if (item.mimeType.startsWith('image/')) return 'photo';
  if (item.mimeType.startsWith('video/')) return 'video';
  return 'document';
}

function formatSize(value?: string) {
  const bytes = Number(value || 0);
  if (!bytes) return '';
  const units = ['B','KB','MB','GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`;
}

export default function DriveDeliveryPickerModal({ isOpen, adminToken, onClose, onSelect }: Props) {
  const [parentId, setParentId] = useState('root');
  const [items, setItems] = useState<DriveItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function load(folder = 'root') {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/drive-list', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ adminToken, parentId: folder }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Google Drive items could not be loaded.');
      setItems(Array.isArray(data.files) ? data.files : []);
      setParentId(folder);
    } catch (e: any) { setError(e?.message || 'Google Drive items could not be loaded.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (isOpen) void load('root'); }, [isOpen]);
  useEffect(() => { if (!isOpen) { setItems([]); setParentId('root'); setError(''); } }, [isOpen]);
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-stone-950/70 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Browse private Google Drive">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-stone-200 bg-[#fbf8f2] shadow-2xl">
        <header className="flex items-center justify-between gap-4 border-b border-stone-200 px-5 py-4 sm:px-6">
          <div><p className="text-xs font-bold uppercase tracking-[.18em] text-amber-700">Private Google Drive</p><h2 className="mt-1 text-lg font-semibold">Choose a file or folder</h2></div>
          <div className="flex items-center gap-2">
            <button onClick={() => void load(parentId)} aria-label="Refresh" className="rounded-xl border border-stone-300 p-2"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
            <button onClick={onClose} aria-label="Close" className="rounded-xl border border-stone-300 p-2"><X className="h-4 w-4" /></button>
          </div>
        </header>
        {parentId !== 'root' && <button onClick={() => void load('root')} className="flex items-center gap-2 px-5 pt-4 text-sm font-semibold text-stone-600"><ArrowLeft className="h-4 w-4" /> Back to My Drive</button>}
        {error && <div className="mx-5 mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {loading ? <div className="flex min-h-40 items-center justify-center gap-3 text-sm text-stone-500"><Loader2 className="h-5 w-5 animate-spin" />Checking the connected Drive account…</div> : items.length ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {items.map((item) => {
                const type = kind(item);
                const Icon = type === 'folder' ? Folder : type === 'photo' ? FileImage : type === 'video' ? Video : FileText;
                return <div key={item.id} className="flex min-w-0 items-center gap-3 rounded-2xl border border-stone-200 bg-white p-3">
                  <span className={`rounded-xl p-2 ${type === 'folder' ? 'bg-amber-50 text-amber-700' : 'bg-stone-100 text-stone-600'}`}><Icon className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold" title={item.name}>{item.name}</div><div className="mt-0.5 text-xs capitalize text-stone-500">{type}{item.size ? ` · ${formatSize(item.size)}` : ''}</div></div>
                  {type === 'folder' && <button onClick={() => void load(item.id)} className="rounded-lg border border-stone-300 px-2.5 py-2 text-xs font-bold">Open</button>}
                  <button onClick={() => onSelect(item)} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-stone-950 px-3 py-2 text-xs font-bold text-white"><Check className="h-3.5 w-3.5" /> Select</button>
                </div>;
              })}
            </div>
          ) : <div className="flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-white/60 p-6 text-center text-sm text-stone-500"><File className="mr-2 h-4 w-4" />This folder has no files.</div>}
        </div>
        <footer className="border-t border-stone-200 bg-white/70 px-5 py-3 text-xs leading-5 text-stone-500">Private Drive files remain private. The server reads them only after verifying the delivery admin session.</footer>
      </div>
    </div>
  );
}
