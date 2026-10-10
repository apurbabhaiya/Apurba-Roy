import type { ReferenceFaceChoice } from '../services/faceSearchService';

export function ReferenceFacePicker({ faces, onSelect, onCancel }: {
  faces: ReferenceFaceChoice[]; onSelect: (index: number) => void; onCancel: () => void;
}) {
  return <section className="my-4 rounded-2xl border border-amber-400/50 p-4" aria-label="Choose reference face">
    <p className="mb-3 text-sm font-semibold">যে মুখটি খুঁজবেন সেটি নির্বাচন করুন</p>
    <div className="flex flex-wrap gap-3">{faces.map(face => <button key={face.index} type="button"
      onClick={() => onSelect(face.index)} aria-label={`মুখ ${face.index + 1} নির্বাচন করুন`}
      className="rounded-xl border border-stone-400 p-1 focus:ring-2 focus:ring-amber-400">
      <img src={face.preview} alt={`মুখ ${face.index + 1}`} className="h-20 w-20 rounded-lg object-cover" />
    </button>)}</div>
    <button type="button" onClick={onCancel} className="mt-3 text-sm underline">অন্য ছবি দিন</button>
  </section>;
}
