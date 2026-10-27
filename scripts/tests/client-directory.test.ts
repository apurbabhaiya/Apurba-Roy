import assert from 'node:assert/strict';
import test from 'node:test';
import { directoryDate, filterClientDirectory } from '../../src/delivery/clientDirectory';
import type { DeliveryAdminPortal } from '../../src/services/deliveryPortalService';

const client = (id: string, name: string, fields: Partial<DeliveryAdminPortal> = {}) => ({
  id, client_name: name, ...fields,
} as DeliveryAdminPortal);
const options = { query: '', date: '', dateField: 'event_date' as const, sort: 'name' as const };
const clients = [
  client('b', 'Bob', { client_phone: '01712-345678', event_name: 'Wedding', event_date: '2026-10-27', final_delivery_at: '2026-10-27T19:00:00Z' }),
  client('a', 'Alice', { whatsapp_number: '01812345678', event_name: 'Birthday', event_date: '2026-10-28' }),
  client('c', 'Charlie'),
];

test('name order is deterministic and does not mutate input', () => {
  assert.deepEqual(filterClientDirectory(clients, options).map(p => p.id), ['a', 'b', 'c']);
  assert.deepEqual(clients.map(p => p.id), ['b', 'a', 'c']);
});
test('search matches client and event together, case insensitive', () => {
  assert.deepEqual(filterClientDirectory(clients, { ...options, query: 'BOB wedding' }).map(p => p.id), ['b']);
});
test('Bengali phone digits match a saved formatted phone', () => {
  assert.deepEqual(filterClientDirectory(clients, { ...options, query: '০১৭১২৩৪৫৬৭৮' }).map(p => p.id), ['b']);
});
test('WhatsApp search and no results', () => {
  assert.equal(filterClientDirectory(clients, { ...options, query: '01812345678' })[0].id, 'a');
  assert.equal(filterClientDirectory(clients, { ...options, query: 'nobody' }).length, 0);
});
test('event date and search intersect and missing dates are excluded', () => {
  assert.deepEqual(filterClientDirectory(clients, { ...options, date: '2026-10-27' }).map(p => p.id), ['b']);
  assert.equal(filterClientDirectory(clients, { ...options, date: '2026-10-27', query: 'Alice' }).length, 0);
});
test('timestamp filtering uses Bangladesh calendar day', () => {
  assert.equal(directoryDate('2026-10-27T19:00:00Z'), '2026-10-28');
  assert.deepEqual(filterClientDirectory(clients, { ...options, dateField: 'final_delivery_at', date: '2026-10-28' }).map(p => p.id), ['b']);
});
test('date ordering keeps undated clients last in both directions', () => {
  assert.deepEqual(filterClientDirectory(clients, { ...options, sort: 'newest' }).map(p => p.id), ['a', 'b', 'c']);
  assert.deepEqual(filterClientDirectory(clients, { ...options, sort: 'oldest' }).map(p => p.id), ['b', 'a', 'c']);
});
test('missing and invalid date values are safe', () => {
  assert.equal(directoryDate(null), '');
  assert.equal(directoryDate('invalid'), '');
  assert.equal(directoryDate('2026-10-27'), '2026-10-27');
  assert.deepEqual(filterClientDirectory([], options), []);
});
