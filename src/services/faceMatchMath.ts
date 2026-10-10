export function descriptorDistance(a: ArrayLike<number>, b: ArrayLike<number>): number {
  if (a.length !== 128 || b.length !== 128) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    if (!Number.isFinite(a[i]) || !Number.isFinite(b[i])) return Infinity;
    sum += (a[i] - b[i]) ** 2;
  }
  return Math.sqrt(sum);
}
