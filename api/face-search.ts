import { authorizeFaceGallery, bodyOf, faceDb, faceError, faceJson, faceRpc, FaceHttpError, MODEL_VERSION } from './_lib/faceIndex.js';
import { descriptorDistance } from '../src/services/faceMatchMath.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return faceJson(res, 405, { error: 'Use POST.' });
  try {
    const body = bodyOf(req);
    const access = await authorizeFaceGallery(req, body.galleryId, false, body.pin);
    const reference = body.descriptor;
    if (!Array.isArray(reference) || reference.length !== 128 || reference.some(n => typeof n !== 'number' || !Number.isFinite(n) || Math.abs(n) > 2)) {
      throw new FaceHttpError(400, 'Invalid face features. Upload a new reference portrait.');
    }
    if (!await faceRpc('face_index_rate_limit', { p_user: access.userId })) throw new FaceHttpError(429, 'Please wait a minute before searching again.');
    const coverage = await faceRpc<any>('face_index_status', { p_gallery: access.galleryId, p_model: MODEL_VERSION });
    if (coverage.pending || coverage.unindexed) return faceJson(res, 409, { error: `Album face index is not ready: ${coverage.ready + coverage.noFace}/${coverage.total} photos processed. Ask the photographer to finish indexing.`, coverage });
    if (!coverage.ready) return faceJson(res, 422, { error: coverage.failed ? 'Album images could not be analyzed. This is not a no-match result.' : 'No faces are indexed in this album.', coverage });
    const matches: { photoId: string; similarity: number }[] = [];
    for (let offset = 0; ; offset += 100) {
      const rows = await faceDb<any[]>(`face_photo_index?gallery_id=eq.${access.galleryId}&model_version=eq.${MODEL_VERSION}&status=eq.ready&select=descriptors,photos!inner(drive_file_id)&order=photo_id&limit=100&offset=${offset}`);
      for (const row of rows) {
        const distance = Math.min(...row.descriptors.map((d: number[]) => descriptorDistance(reference, d)));
        if (distance <= 0.5) matches.push({ photoId: row.photos.drive_file_id, similarity: Math.round((1 - distance) * 100) });
      }
      if (rows.length < 100) break;
    }
    matches.sort((a, b) => b.similarity - a.similarity);
    // Reference features exist only in this request. No selfie or query index is saved.
    return faceJson(res, 200, { matches, coverage });
  } catch (error) { return faceError(res, error); }
}
