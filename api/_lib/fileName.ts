export function safeFileName(value: string, fallback = 'ramyachobi-file') {
  const name = value.replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, '_').trim().slice(0, 180);
  return name && name !== '.' && name !== '..' ? name : fallback;
}

export function attachmentHeader(value: string) {
  const name = safeFileName(value);
  const ascii = name.replace(/[^\x20-\x7e]/g, '_');
  const encoded = encodeURIComponent(name).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

export function uniqueZipName(value: string, used: Set<string>) {
  const base = safeFileName(value);
  const dot = base.lastIndexOf('.');
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const extension = dot > 0 ? base.slice(dot) : '';
  let name = base;
  for (let n = 2; used.has(name); n++) name = `${stem}_${n}${extension}`;
  used.add(name);
  return name;
}
