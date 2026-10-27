import assert from 'node:assert/strict';
import test from 'node:test';
import { manualClientPayload, type ManualClientDraft } from '../../src/delivery/manualClient';
const draft: ManualClientDraft = { client_name: ' Test Client ', phone: '০১৭১২-৩৪৫৬৭৮', event_date: '2025-01-01', event_name: '', total: '1000', paid: '250', delivered: false };
test('normalizes a historical client and preserves the opening payment', () => {
  const p = manualClientPayload(draft, 'request');
  assert.equal(p.client_name, 'Test Client'); assert.equal(p.phone, '01712345678'); assert.equal(p.total-p.paid,750); assert.equal(p.request_id,'request');
});
test('fully paid and zero cost clients are supported', () => {
  assert.equal(manualClientPayload({...draft,paid:'1000',delivered:true},'id').delivered,true);
  assert.equal(manualClientPayload({...draft,total:'0',paid:'0'},'id').total,0);
});
test('rejects invalid identity and dates', () => {
  for(const patch of [{client_name:''},{phone:'123'},{event_date:''}]) assert.throws(()=>manualClientPayload({...draft,...patch},'id'));
});
test('rejects overpayment, negatives, missing amounts, NaN and extra decimals', () => {
  for(const patch of [{paid:'1001'},{total:'-1'},{paid:'-1'},{total:''},{paid:''},{total:'NaN'},{total:'Infinity'},{paid:'1.001'}]) assert.throws(()=>manualClientPayload({...draft,...patch},'id'));
});
test('cannot mark a client with an unpaid balance fully delivered', () => {
  assert.throws(()=>manualClientPayload({...draft,delivered:true},'id'));
});
