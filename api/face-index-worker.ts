import { randomUUID } from 'node:crypto';
import { QueueClient } from '@vercel/queue';
import { faceDb, faceRpc, MODEL_VERSION, uuid } from './_lib/faceIndex.js';
import { describeFaces, readAlbumPreview } from './_lib/faceRuntime.js';

const queue = new QueueClient();
export default queue.handleNodeCallback<{ galleryId: string }>(async message => {
  if (!uuid(message?.galleryId)) return;
  const lease = randomUUID();
  const claimed = await faceRpc<any>('face_index_claim_batch', { p_gallery: message.galleryId, p_model: MODEL_VERSION, p_lease: lease });
  if (claimed.busy) throw new Error('INDEX_BUSY');
  const jobs: any[] = claimed.jobs;
  if (!jobs.length) return;
  try {
    for (const job of jobs) {
      let descriptors: number[][] = [];
      let status = 'ready';
      let errorCode: string | null = null;
      try {
        descriptors = await describeFaces(await readAlbumPreview(job));
        if (!descriptors.length) status = 'no_face';
      } catch {
        // Never store upstream URLs, tokens, image bytes, or raw library errors.
        status = job.attempts < 3 ? 'pending' : 'failed';
        errorCode = 'PREVIEW_OR_INFERENCE_FAILED';
      }
      await faceDb(`face_photo_index?photo_id=eq.${job.photo_id}&generation=eq.${job.generation}&lease_id=eq.${lease}`, {
        method: 'PATCH', body: JSON.stringify({ status, descriptors, error_code: errorCode, indexed_at: new Date().toISOString() }),
      });
    }
    const status = await faceRpc<any>('face_index_status', { p_gallery: message.galleryId, p_model: MODEL_VERSION });
    if (status.pending > 0) {
      // One bounded batch at a time per gallery. A retry resumes durable DB work.
      const last = jobs[jobs.length - 1];
      await queue.send('face-index', message, { retentionSeconds: 604800, delaySeconds: 2,
        idempotencyKey: `face-next:${message.galleryId}:${last.generation}:${last.photo_id}:${last.attempts}` });
    }
  } finally {
    await faceRpc('face_index_release', { p_gallery: message.galleryId, p_lease: lease });
  }
}, { retry: (_error, metadata) => metadata.deliveryCount >= 10 ? { acknowledge: true } : { afterSeconds: 30 } });
