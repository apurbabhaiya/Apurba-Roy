import { randomUUID } from 'node:crypto';
import { QueueClient } from '@vercel/queue';
import { authorizeFaceGallery, bodyOf, faceError, faceJson, faceRpc, FaceHttpError, MODEL_VERSION } from './_lib/faceIndex.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return faceJson(res, 405, { error: 'Use POST.' });
  try {
    const body = bodyOf(req);
    const action = body.action || 'status';
    if (!['status', 'start', 'retry', 'rebuild'].includes(action)) throw new FaceHttpError(400, 'Invalid face index action.');
    const access = await authorizeFaceGallery(req, body.galleryId, action !== 'status', body.pin);
    if (action !== 'status') {
      if (action === 'rebuild') await faceRpc('face_index_rebuild', { p_gallery: access.galleryId, p_model: MODEL_VERSION });
      else await faceRpc('face_index_prepare', { p_gallery: access.galleryId, p_model: MODEL_VERSION, p_retry: action === 'retry' });
      // Publishing a durable message is awaited before reporting success.
      await new QueueClient().send('face-index', { galleryId: access.galleryId }, { retentionSeconds: 604800, idempotencyKey: `face-start:${access.galleryId}:${randomUUID()}` });
    }
    const status = await faceRpc('face_index_status', { p_gallery: access.galleryId, p_model: MODEL_VERSION });
    return faceJson(res, 200, status);
  } catch (error) { return faceError(res, error); }
}
