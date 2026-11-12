/** Cosine score is a ranking signal, never a probability of identity. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== 512 || b.length !== 512) throw new Error('Invalid face embedding');
  let dot = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i++) {
    if (!Number.isFinite(a[i]) || !Number.isFinite(b[i])) throw new Error('Invalid face embedding');
    dot += a[i] * b[i]; aa += a[i] ** 2; bb += b[i] ** 2;
  }
  if (!aa || !bb) throw new Error('Empty face embedding');
  return Math.max(-1, Math.min(1, dot / Math.sqrt(aa * bb)));
}
