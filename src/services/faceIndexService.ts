import { supabase } from './supabase';

export interface FaceIndexStatus {
  total: number; ready: number; noFace: number; failed: number; pending: number; unindexed: number;
}
export async function faceRequest<T>(endpoint: string, body: unknown): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Reopen the gallery link to start a face search session.');
  const response = await fetch(`/api/${endpoint}`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(body), signal: AbortSignal.timeout(60000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || 'Face index could not be reached. Please retry.');
  return data;
}
export const getFaceIndexStatus = (galleryId: string, pin?: string) => faceRequest<FaceIndexStatus>('face-index', { galleryId, pin, action: 'status' });
export const startFaceIndex = (galleryId: string, retry = false, rebuild = false) => faceRequest<FaceIndexStatus>('face-index', { galleryId, action: rebuild ? 'rebuild' : retry ? 'retry' : 'start' });
