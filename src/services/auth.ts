import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from './supabase';
import {
  DRIVE_SCOPES,
  clearProviderTokens,
  ensureAnonymousSupabaseAuth,
  getGoogleDriveAccessToken,
  googleSupabaseSignIn,
  initSupabaseAuth,
  supabaseLogout,
} from './supabaseAuth';

export interface AppUser {
  uid: string;
  id: string;
  email: string | null;
  displayName: string | null;
  isAnonymous: boolean;
  raw: SupabaseUser;
}

export interface PhotographerDriveConnection {
  uid: string;
  email: string | null;
  displayName: string | null;
  driveConnected: boolean;
  lastConnectedAt: string;
  scopes: string[];
}

export const SCOPES = DRIVE_SCOPES;

const STORAGE_PROVIDER_TOKEN = 'rommochobi_gdrive_provider_token_v1';
let cachedUser: AppUser | null = null;

const mapUser = (user: SupabaseUser | null): AppUser | null => {
  if (!user) return null;
  const metadata = user.user_metadata || {};
  return {
    uid: user.id,
    id: user.id,
    email: user.email || null,
    displayName:
      metadata.full_name ||
      metadata.name ||
      metadata.display_name ||
      user.email ||
      null,
    isAnonymous: !!user.is_anonymous,
    raw: user,
  };
};

export const auth = {
  get currentUser(): AppUser | null {
    return cachedUser;
  },
};

export class TokenExpiredError extends Error {
  constructor(message = 'Google Drive access token has expired or is invalid. Please reconnect.') {
    super(message);
    this.name = 'TokenExpiredError';
  }
}

export const createGoogleProvider = (forceAccountSelect = false) => ({
  scopes: SCOPES,
  forceAccountSelect,
});

export const googleProvider = createGoogleProvider();

export const persistAccessToken = (
  token: string,
  _expiresInSeconds = 3500,
  _email?: string | null
) => {
  try {
    localStorage.setItem(STORAGE_PROVIDER_TOKEN, token);
  } catch {}
};

export const clearSavedAccessToken = () => {
  clearProviderTokens();
};

export const getSavedAccessToken = (): { token: string; expiresAt: number } | null => {
  const token = getGoogleDriveAccessToken();
  if (!token) return null;
  return { token, expiresAt: Number.MAX_SAFE_INTEGER };
};

export const isTokenExpired = (): boolean => !getGoogleDriveAccessToken();

export const getAccessToken = (): string | null => getGoogleDriveAccessToken();

export const setAccessToken = (token: string | null) => {
  if (token) persistAccessToken(token);
  else clearSavedAccessToken();
};

export const ensureAnonymousAuth = async (): Promise<AppUser | null> => {
  const user = await ensureAnonymousSupabaseAuth();
  cachedUser = mapUser(user);
  return cachedUser;
};

export const signInClientAnonymously = ensureAnonymousAuth;

export const isAnonymousClient = (): boolean => !!cachedUser?.isAnonymous;

export const savePhotographerDriveConnection = async (
  user: AppUser,
  _accessToken?: string,
  _expiresInSeconds = 3500
): Promise<void> => {
  const { error } = await supabase.from('photographer_profiles').upsert({
    user_id: user.uid,
    email: user.email,
    display_name: user.displayName,
    drive_connected: true,
    last_connected_at: new Date().toISOString(),
    scopes: SCOPES,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    console.warn('Could not save photographer profile:', error.message);
  }
};

export const getPhotographerDriveConnection = async (
  uid: string
): Promise<PhotographerDriveConnection | null> => {
  const { data, error } = await supabase
    .from('photographer_profiles')
    .select('*')
    .eq('user_id', uid)
    .maybeSingle();

  if (error || !data) return null;

  return {
    uid: data.user_id,
    email: data.email || null,
    displayName: data.display_name || null,
    driveConnected: !!data.drive_connected,
    lastConnectedAt: data.last_connected_at || '',
    scopes: data.scopes || [],
  };
};

export const initAuth = (
  onAuthSuccess?: (user: AppUser, token: string) => void,
  onAuthFailure?: (user?: AppUser | null) => void
) => {
  return initSupabaseAuth(
    async (user) => {
      const mapped = mapUser(user);
      cachedUser = mapped;
      if (!mapped) {
        onAuthFailure?.(null);
        return;
      }

      const token = getGoogleDriveAccessToken() || '';
      await savePhotographerDriveConnection(mapped, token).catch(() => {});
      onAuthSuccess?.(mapped, token);
    },
    (user) => {
      const mapped = mapUser(user || null);
      cachedUser = mapped;
      if (mapped?.isAnonymous) onAuthFailure?.(mapped);
      else onAuthFailure?.(null);
    }
  );
};

export const googleSignIn = async (
  forceAccountSelect = false
): Promise<{ user: AppUser; accessToken: string } | null> => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.user && !session.user.is_anonymous) {
    const mapped = mapUser(session.user);
    const token = getGoogleDriveAccessToken();
    if (mapped && token) {
      cachedUser = mapped;
      return { user: mapped, accessToken: token };
    }
  }

  await googleSupabaseSignIn(forceAccountSelect);
  return null;
};

export const logout = async () => {
  await supabaseLogout();
  cachedUser = null;
  try {
    await ensureAnonymousAuth();
  } catch (err) {
    console.warn('Anonymous session restart notice:', err);
  }
};
