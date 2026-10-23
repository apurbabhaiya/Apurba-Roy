import { regularPackages, outdoorPackages, sonatonPackages } from './packageCatalog';

export type ChatQuoteInput = {
  packageName: string;
  extraEvents: number;
  approvedDiscountPercent: number;
  confirmedAdvance?: number;
};

export function calculateChatQuote(input: ChatQuoteInput) {
  const catalog = [...regularPackages, ...outdoorPackages, ...Object.values(sonatonPackages).flat()];
  const selected = catalog.find(p => p.name.toLowerCase() === input.packageName.trim().toLowerCase());
  if (!selected) throw new Error('Unknown package');
  if (!Number.isInteger(input.extraEvents) || input.extraEvents < 0 || input.extraEvents > 20) throw new Error('Invalid extra event count');
  if (!Number.isFinite(input.approvedDiscountPercent) || input.approvedDiscountPercent < 0 || input.approvedDiscountPercent > 100) throw new Error('Invalid discount');
  const advance = input.confirmedAdvance ?? 0;
  if (!Number.isFinite(advance) || advance < 0) throw new Error('Invalid advance');
  const gross = selected.price * (1 + input.extraEvents);
  const discount = Math.round(gross * input.approvedDiscountPercent / 100);
  const payable = gross - discount;
  if (advance > payable) throw new Error('Advance exceeds payable');
  return { packageName: selected.name, basePrice: selected.price, totalEvents: 1 + input.extraEvents, gross, approvedDiscountPercent: input.approvedDiscountPercent, discount, payable, confirmedAdvance: advance, balance: payable - advance };
}
