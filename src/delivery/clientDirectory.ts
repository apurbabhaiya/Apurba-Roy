import type { DeliveryAdminPortal } from '../services/deliveryPortalService';

export type DirectoryDateField = 'event_date' | 'final_delivery_at' | 'created_at';
export type DirectorySort = 'name' | 'newest' | 'oldest';

export function directoryDate(value?: string | null): string {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const part = (type: string) => parts.find(p => p.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function normalize(value: string) {
  return value.normalize('NFKC').toLocaleLowerCase().replace(/[০-৯]/g, digit => String('০১২৩৪৫৬৭৮৯'.indexOf(digit)));
}

export function filterClientDirectory(portals: DeliveryAdminPortal[], options: {
  query: string; date: string; dateField: DirectoryDateField; sort: DirectorySort;
}) {
  const terms = normalize(options.query).trim().split(/\s+/).filter(Boolean);
  return portals.filter(portal => {
    const text = normalize([portal.client_name, portal.event_name, portal.package_name, portal.client_phone, portal.whatsapp_number].filter(Boolean).join(' '));
    const phone = normalize([portal.client_phone, portal.whatsapp_number].filter(Boolean).join(' ')).replace(/[^\d+]/g, '');
    return terms.every(term => text.includes(term) || (/\d/.test(term) && /^[\d+()-]+$/.test(term) && phone.includes(term.replace(/[^\d+]/g, ''))))
      && (!options.date || directoryDate(portal[options.dateField]) === options.date);
  }).sort((a, b) => {
    if (options.sort !== 'name') {
      const left = directoryDate(a[options.dateField]);
      const right = directoryDate(b[options.dateField]);
      // Keep records with no saved date at the end in either direction.
      if (!left && right) return 1;
      if (left && !right) return -1;
      const comparison = left.localeCompare(right);
      if (comparison) return options.sort === 'newest' ? -comparison : comparison;
    }
    return a.client_name.localeCompare(b.client_name, 'bn', { sensitivity: 'base', numeric: true }) || a.id.localeCompare(b.id);
  });
}
