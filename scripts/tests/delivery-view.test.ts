import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { deliveryView, deliveryPath, deliveryPreviews, deliveryFileAllowed, effectiveDeliveryExpiry, needsNativeBulkDownload } from '../../src/delivery/deliveryView';
import { countdownParts } from '../../src/delivery/countdown';
import DeliveryPreviewGallery from '../../src/delivery/DeliveryPreviewGallery';
import type { DeliveryPortalData, DeliveryFinalFile } from '../../src/services/deliveryPortalService';
const photo = { id: 'photo', file_type: 'PHOTO', file_name: 'Only photo' } as DeliveryFinalFile;
const video = { id: 'video', file_type: 'VIDEO', file_name: 'Only video' } as DeliveryFinalFile;
const document = { id: 'document', file_type: 'DOCUMENT' } as DeliveryFinalFile;
const portal = { delivery_files: [photo, video, document], preview_items: [{type:'image',url:'legacy-photo'},{type:'video',url:'legacy-video'}], download_status:'ENABLED', gallery_status:'ACTIVE', is_published:true, photo_download_permission:true, video_download_permission:false, document_download_permission:false } as DeliveryPortalData;
const now = Date.parse('2026-10-27T00:00:00Z');
test('existing delivery URLs stay main; photo/video/recovery paths stay separate and retain only admin preview intent', () => {
  assert.equal(deliveryView(undefined),'main'); assert.equal(deliveryView('unknown'),'main');
  assert.equal(deliveryPath('private','photos'),'/delivery/private/photos');
  assert.equal(deliveryPath('private','videos',true),'/delivery/private/videos?preview=admin');
  assert.equal(deliveryPath('private','recovery'),'/delivery/private/recovery');
});
test('photos never contain videos or documents, with typed legacy fallbacks preserved', () => {
  assert.deepEqual(deliveryPreviews(portal,'PHOTO').map(x=>x.file?.id),['photo']);
  assert.deepEqual(deliveryPreviews(portal,'VIDEO').map(x=>x.file?.id),['video']);
  assert.equal(deliveryPreviews({...portal,delivery_files:[]},'PHOTO')[0].source,'legacy-photo');
  assert.equal(deliveryPreviews({...portal,delivery_files:[]},'VIDEO')[0].source,'legacy-video');
});
test('temporary extension uses later access expiry, then honors download/storage hard limits', () => {
  assert.equal(effectiveDeliveryExpiry({free_access_expires_at:'2026-10-28',access_expires_at:'2026-10-30'}),'2026-10-30T00:00:00.000Z');
  assert.equal(effectiveDeliveryExpiry({free_access_expires_at:'2026-10-30',download_window_ends_at:'2026-10-29',storage_retention_until:'2026-10-28'}),'2026-10-28T00:00:00.000Z');
  assert.equal(effectiveDeliveryExpiry({free_access_expires_at:'bad'}),null);
});
test('downloads require existing type permission, publication and live access', () => {
  assert.equal(deliveryFileAllowed(photo,portal,now),true);
  assert.equal(deliveryFileAllowed(video,portal,now),false);
  assert.equal(deliveryFileAllowed(document,portal,now),false);
  for(const patch of [{is_published:false},{download_status:'LOCKED'},{gallery_status:'UNAVAILABLE'},{download_window_ends_at:'2026-10-27'}]) assert.equal(deliveryFileAllowed(photo,{...portal,...patch},now),false);
  assert.equal(deliveryFileAllowed(photo,{...portal,free_access_expires_at:'2026-10-28'},now),true);
});
test('countdown rolls through day/hour/minute/second boundaries and clamps expiry', () => {
  assert.deepEqual(countdownParts(new Date(now+90061000).toISOString(),now),[1,1,1,1]);
  assert.deepEqual(countdownParts(new Date(now+1000).toISOString(),now),[0,0,0,1]);
  assert.deepEqual(countdownParts(new Date(now).toISOString(),now),[0,0,0,0]);
  assert.deepEqual(countdownParts(new Date(now-1000).toISOString(),now),[0,0,0,0]);
});
test('rendered photo and video pages have distinct media and individual/bulk buttons', () => {
  const markup=(kind:'PHOTO'|'VIDEO')=>renderToStaticMarkup(React.createElement(DeliveryPreviewGallery,{kind,items:deliveryPreviews(portal,kind),backHref:'/delivery/private',source:()=>'/protected-preview',resolveSource:async()=>'/protected-preview',allowed:()=>true,onDownload:()=>{},onDownloadAll:()=>{},busy:false,error:'',previewEnabled:true}));
  const photos=markup('PHOTO'), videos=markup('VIDEO');
  assert.ok(photos.includes('Download All Photos')); assert.ok(photos.includes('Download Photo')); assert.ok(photos.includes('Only photo')); assert.ok(!photos.includes('<video')); assert.ok(!photos.includes('Only video'));
  assert.ok(videos.includes('Download All Videos')); assert.ok(videos.includes('Download Video')); assert.ok(videos.includes('<video')); assert.ok(!videos.includes('Only photo'));
});
test('disabled preview does not render media',()=>{
  const html=renderToStaticMarkup(React.createElement(DeliveryPreviewGallery,{kind:'PHOTO',items:deliveryPreviews(portal,'PHOTO'),backHref:'/',source:()=>'/protected',resolveSource:async()=>'/protected',allowed:()=>false,onDownload:()=>{},onDownloadAll:()=>{},busy:false,error:'',previewEnabled:false}));
  assert.ok(!html.includes('<img')); assert.ok(html.includes('disabled'));
});

test('multi-GB videos and large/unknown photo collections use native originals, not ZIP32',()=>{
  assert.equal(needsNativeBulkDownload([{...video,file_size_bytes:4522991390}]),true);
  assert.equal(needsNativeBulkDownload([{...photo,file_size_bytes:200*1024*1024}]),true);
  assert.equal(needsNativeBulkDownload([photo]),true);
  assert.equal(needsNativeBulkDownload([{...photo,file_size_bytes:1024}]),false);
});
