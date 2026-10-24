import { regularPackages, outdoorPackages, sonatonPackages } from './packageCatalog';

export type ChatQuoteInput = {
  packageName: string;
  eventCount?: number;
  approvedDiscountPercent: number;
};

const perEventPackageIds = new Set([
  'regular-basic',
  'regular-standard',
  'outdoor-essentials',
  'outdoor-cinematic',
]);

export function calculateChatQuote(input: ChatQuoteInput) {
  const catalog = [...regularPackages, ...outdoorPackages, ...Object.values(sonatonPackages).flat()];
  const selected = catalog.find(p => p.name.toLowerCase() === input.packageName.trim().toLowerCase());
  if (!selected) throw new Error('Unknown package');
  const eventCount = input.eventCount ?? 1;
  if (!Number.isInteger(eventCount) || eventCount < 1 || eventCount > 20) throw new Error('Invalid event count');
  if (!Number.isFinite(input.approvedDiscountPercent) || input.approvedDiscountPercent < 0 || input.approvedDiscountPercent > 99) throw new Error('Invalid discount');

  // The booking form multiplies only four fixed packages by the number of events.
  // The other fixed packages already cover their listed event set at one package price.
  const chargedEvents = perEventPackageIds.has(selected.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'))
    ? eventCount
    : 1;
  const gross = selected.price * chargedEvents;
  // Match FriendlyBooking's two-decimal taka rounding.
  const discount = Math.round(gross * input.approvedDiscountPercent) / 100;
  const payable = Math.round((gross - discount) * 100) / 100;
  return {
    packageName: selected.name,
    basePrice: selected.price,
    eventCount,
    chargedEvents,
    gross,
    approvedDiscountPercent: input.approvedDiscountPercent,
    discount,
    payable,
    note: chargedEvents === 1 && eventCount > 1
      ? 'This package covers its listed event set. Extra event multiplication is not applied.'
      : null,
  };
}
