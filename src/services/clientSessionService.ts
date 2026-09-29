import { supabase } from './supabase';
import { ensureAnonymousSupabaseAuth } from './supabaseAuth';
import {
  clearAllProjectSelections,
  generateSecureToken,
  updateCustomerSelections,
} from './customerGalleryService';
import {
  AutoSaveStatus,
  ClientGallerySession,
  ClientSessionStatus,
  CustomerGallery,
} from '../types';

const LOCAL_STORAGE_SESSION_PREFIX = 'rcfoto_client_session_';
const OFFLINE_QUEUE_PREFIX = 'rcfoto_offline_queue_';

interface OfflineAction {
  id: string;
  galleryToken: string;
  sessionId: string;
  selectedPhotoIds: string[];
  action: 'save' | 'submit';
  createdAt: string;
}

const isOnline = () =>
  typeof navigator === 'undefined' ? true : navigator.onLine;

const readQueue = (galleryToken: string): OfflineAction[] => {
  try {
    const raw = localStorage.getItem(`${OFFLINE_QUEUE_PREFIX}${galleryToken}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const writeQueue = (galleryToken: string, queue: OfflineAction[]) => {
  try {
    if (queue.length) {
      localStorage.setItem(
        `${OFFLINE_QUEUE_PREFIX}${galleryToken}`,
        JSON.stringify(queue.slice(-25))
      );
    } else {
      localStorage.removeItem(`${OFFLINE_QUEUE_PREFIX}${galleryToken}`);
    }
  } catch {}
};

const addOfflineAction = (action: OfflineAction) => {
  const queue = readQueue(action.galleryToken);
  queue.push(action);
  writeQueue(action.galleryToken, queue);
};

const fetchCurrentSelectionIds = async (
  galleryId: string,
  userId: string
): Promise<string[]> => {
  const { data, error } = await supabase
    .from('selections')
    .select('drive_file_id,photo_id')
    .eq('gallery_id', galleryId)
    .eq('user_id', userId)
    .eq('selected', true)
    .order('selection_order', { ascending: true });

  if (error) throw error;
  return (data || []).map((row: any) => row.drive_file_id || row.photo_id);
};

const mapRowToSession = (
  row: any,
  galleryToken: string,
  selectedPhotoIds: string[],
  accessToken: string
): ClientGallerySession => ({
  sessionId: row.id,
  galleryId: row.gallery_id,
  galleryToken,
  sessionAccessToken: accessToken,
  recoveryCode: row.recovery_code || '',
  customerName: row.client_name || undefined,
  customerPhone: row.client_phone || undefined,
  selectedPhotoIds,
  selectedCount: selectedPhotoIds.length,
  status: (row.status || 'active') as ClientSessionStatus,
  createdAt: row.created_at || new Date().toISOString(),
  lastActivityAt: row.last_seen_at || new Date().toISOString(),
  submittedAt: row.submitted_at || undefined,
  deviceInfoOptional: row.device_info || undefined,
  notes: row.notes || undefined,
});

export async function saveLocalSession(session: ClientGallerySession): Promise<void> {
  try {
    localStorage.setItem(
      `${LOCAL_STORAGE_SESSION_PREFIX}${session.galleryToken}`,
      JSON.stringify(session)
    );
  } catch (err) {
    console.warn('Could not save local gallery session:', err);
  }
}

export async function getLocalSession(
  galleryToken: string
): Promise<ClientGallerySession | null> {
  try {
    const raw = localStorage.getItem(
      `${LOCAL_STORAGE_SESSION_PREFIX}${galleryToken}`
    );
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function generateRecoveryCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function getOrCreateClientSession(
  galleryToken: string,
  gallery: CustomerGallery,
  customerName?: string,
  customerPhone?: string
): Promise<ClientGallerySession> {
  const cleanToken = galleryToken.trim();
  const user = await ensureAnonymousSupabaseAuth();
  if (!user) throw new Error('Could not create a secure client session.');

  const {
    data: { session: authSession },
  } = await supabase.auth.getSession();
  const accessToken = authSession?.access_token || '';

  const { error: claimError } = await supabase.rpc('claim_gallery_access', {
    p_identifier: cleanToken || gallery.secureToken || gallery.id,
  });
  if (claimError) throw claimError;

  const local = await getLocalSession(cleanToken);
  if (local?.sessionId) {
    const { data: existing, error } = await supabase
      .from('client_sessions')
      .select('*')
      .eq('id', local.sessionId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!error && existing) {
      const selectedPhotoIds = await fetchCurrentSelectionIds(gallery.id, user.id);
      const merged = mapRowToSession(
        existing,
        cleanToken,
        selectedPhotoIds,
        accessToken
      );
      await saveLocalSession(merged);
      return merged;
    }
  }

  const { data: existingForUser, error: lookupError } = await supabase
    .from('client_sessions')
    .select('*')
    .eq('gallery_id', gallery.id)
    .eq('user_id', user.id)
    .order('last_seen_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lookupError) {
    console.warn('Client session lookup notice:', lookupError.message);
  }

  if (existingForUser) {
    const selectedPhotoIds = await fetchCurrentSelectionIds(gallery.id, user.id);
    const existingSession = mapRowToSession(
      existingForUser,
      cleanToken,
      selectedPhotoIds,
      accessToken
    );
    await saveLocalSession(existingSession);
    return existingSession;
  }

  const nowIso = new Date().toISOString();
  const recoveryCode = generateRecoveryCode();
  const sessionToken = generateSecureToken(28);

  const { data: created, error: createError } = await supabase
    .from('client_sessions')
    .insert({
      gallery_id: gallery.id,
      user_id: user.id,
      session_token: sessionToken,
      recovery_code: recoveryCode,
      client_name: customerName || null,
      client_phone: customerPhone || null,
      selected_count: gallery.selectedPhotoIds?.length || 0,
      status: 'active',
      device_info:
        typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 500) : null,
      last_seen_at: nowIso,
    })
    .select('*')
    .single();

  if (createError) throw createError;

  const newSession = mapRowToSession(
    created,
    cleanToken,
    gallery.selectedPhotoIds || [],
    accessToken
  );

  await saveLocalSession(newSession);
  return newSession;
}

export async function recoverSessionByCode(
  galleryToken: string,
  recoveryCode: string
): Promise<{ success: boolean; session?: ClientGallerySession; error?: string }> {
  const cleanToken = galleryToken.trim();
  const cleanCode = recoveryCode.trim();

  if (!/^\d{6}$/.test(cleanCode)) {
    return {
      success: false,
      error: 'Please enter the 6-digit recovery code.',
    };
  }

  try {
    const user = await ensureAnonymousSupabaseAuth();
    if (!user) throw new Error('Could not start a client session.');

    const { data, error } = await supabase.rpc('recover_client_session', {
      p_identifier: cleanToken,
      p_recovery_code: cleanCode,
    });
    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      return {
        success: false,
        error: 'Recovery code was not found for this gallery.',
      };
    }

    const {
      data: { session: authSession },
    } = await supabase.auth.getSession();

    const selectedPhotoIds = await fetchCurrentSelectionIds(
      row.gallery_id,
      user.id
    );
    const recovered = mapRowToSession(
      row,
      cleanToken,
      selectedPhotoIds,
      authSession?.access_token || ''
    );

    await saveLocalSession(recovered);
    return { success: true, session: recovered };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Session recovery failed.',
    };
  }
}

export async function saveSelectionAction(
  session: ClientGallerySession,
  selectedPhotoIds: string[],
  gallery: CustomerGallery,
  isSubmitting = false
): Promise<{
  success: boolean;
  status: AutoSaveStatus;
  updatedSession: ClientGallerySession;
}> {
  const nowIso = new Date().toISOString();
  const nextStatus: ClientSessionStatus = isSubmitting
    ? 'submitted'
    : session.status === 'submitted'
    ? 'submitted'
    : 'active';

  const updatedSession: ClientGallerySession = {
    ...session,
    selectedPhotoIds,
    selectedCount: selectedPhotoIds.length,
    status: nextStatus,
    lastActivityAt: nowIso,
    submittedAt: isSubmitting ? nowIso : session.submittedAt,
  };

  await saveLocalSession(updatedSession);

  if (!isOnline()) {
    addOfflineAction({
      id: generateSecureToken(12),
      galleryToken: session.galleryToken,
      sessionId: session.sessionId,
      selectedPhotoIds,
      action: isSubmitting ? 'submit' : 'save',
      createdAt: nowIso,
    });
    return {
      success: true,
      status: 'offline',
      updatedSession,
    };
  }

  try {
    const { error: sessionError } = await supabase
      .from('client_sessions')
      .update({
        selected_count: selectedPhotoIds.length,
        status: nextStatus,
        last_seen_at: nowIso,
        submitted_at: isSubmitting ? nowIso : null,
      })
      .eq('id', session.sessionId);

    if (sessionError) throw sessionError;

    const result = await updateCustomerSelections(
      gallery.secureToken || gallery.id,
      selectedPhotoIds,
      isSubmitting
    );
    if (!result.success) throw new Error(result.error || 'Selection sync failed');

    return {
      success: true,
      status: 'saved',
      updatedSession,
    };
  } catch (err) {
    console.warn('Selection cloud sync deferred:', err);
    addOfflineAction({
      id: generateSecureToken(12),
      galleryToken: session.galleryToken,
      sessionId: session.sessionId,
      selectedPhotoIds,
      action: isSubmitting ? 'submit' : 'save',
      createdAt: nowIso,
    });
    return {
      success: true,
      status: 'offline',
      updatedSession,
    };
  }
}

export async function processOfflineQueue(
  galleryToken: string,
  gallery: CustomerGallery,
  onStatusChange?: (status: AutoSaveStatus) => void
): Promise<void> {
  const queue = readQueue(galleryToken);
  if (!queue.length || !isOnline()) return;

  onStatusChange?.('syncing');

  try {
    const latest = queue[queue.length - 1];
    const local = await getLocalSession(galleryToken);
    if (!local) {
      writeQueue(galleryToken, []);
      onStatusChange?.('saved');
      return;
    }

    const result = await saveSelectionAction(
      local,
      latest.selectedPhotoIds,
      gallery,
      latest.action === 'submit'
    );

    if (result.status === 'saved') {
      writeQueue(galleryToken, []);
      onStatusChange?.('saved');
    } else {
      onStatusChange?.('offline');
    }
  } catch {
    onStatusChange?.('offline');
  }
}

export async function startSelectionAgain(
  session: ClientGallerySession,
  gallery: CustomerGallery
): Promise<{ success: boolean; updatedSession: ClientGallerySession }> {
  const nowIso = new Date().toISOString();
  const updatedSession: ClientGallerySession = {
    ...session,
    selectedPhotoIds: [],
    selectedCount: 0,
    status: 'active',
    lastActivityAt: nowIso,
    submittedAt: undefined,
  };

  await saveLocalSession(updatedSession);

  try {
    const clearResult = await clearAllProjectSelections(gallery.id);
    if (!clearResult.success) {
      throw new Error(clearResult.error || 'Could not reset selections');
    }

    const { error } = await supabase
      .from('client_sessions')
      .update({
        selected_count: 0,
        status: 'active',
        last_seen_at: nowIso,
        submitted_at: null,
      })
      .eq('id', session.sessionId);
    if (error) throw error;

    writeQueue(session.galleryToken, []);
    return { success: true, updatedSession };
  } catch (err) {
    console.warn('Reset selection will retry when online:', err);
    addOfflineAction({
      id: generateSecureToken(12),
      galleryToken: session.galleryToken,
      sessionId: session.sessionId,
      selectedPhotoIds: [],
      action: 'save',
      createdAt: nowIso,
    });
    return { success: false, updatedSession };
  }
}

export async function updateSessionCustomerInfo(
  sessionId: string,
  name?: string,
  phone?: string
): Promise<void> {
  const { error } = await supabase
    .from('client_sessions')
    .update({
      client_name: name || '',
      client_phone: phone || '',
      last_seen_at: new Date().toISOString(),
    })
    .eq('id', sessionId);

  if (error) {
    console.warn('Could not update client session information:', error.message);
  }
}
