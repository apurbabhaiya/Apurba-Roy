import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

export const DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.file',
];

const STORAGE_PROVIDER_TOKEN = 'rommochobi_gdrive_provider_token_v1';
const STORAGE_PROVIDER_REFRESH_TOKEN = 'rommochobi_gdrive_provider_refresh_token_v1';

function persistProviderTokens(session: Session | null) {
  if (!session) return;
  try {
    if (session.provider_token) {
      localStorage.setItem(STORAGE_PROVIDER_TOKEN, session.provider_token);
    }
    if (session.provider_refresh_token) {
      localStorage.setItem(
        STORAGE_PROVIDER_REFRESH_TOKEN,
        session.provider_refresh_token
      );
    }
  } catch {
    // Local storage can be unavailable in privacy modes; auth still works.
  }
}

export function clearProviderTokens() {
  try {
    localStorage.removeItem(STORAGE_PROVIDER_TOKEN);
    localStorage.removeItem(STORAGE_PROVIDER_REFRESH_TOKEN);
  } catch {}
}

export function getGoogleDriveAccessToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_PROVIDER_TOKEN);
  } catch {
    return null;
  }
}

export function getGoogleDriveRefreshToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_PROVIDER_REFRESH_TOKEN);
  } catch {
    return null;
  }
}

export async function ensureAnonymousSupabaseAuth(): Promise<User | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.user) return session.user;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data.user;
}

export function isAnonymousSupabaseUser(user?: User | null): boolean {
  return Boolean(user?.is_anonymous);
}

export function initSupabaseAuth(
  onPermanentUser?: (user: User, session: Session) => void,
  onAnonymousOrSignedOut?: (user?: User | null) => void
) {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    persistProviderTokens(session);

    const user = session?.user ?? null;
    if (user && !user.is_anonymous && session) {
      onPermanentUser?.(user, session);
      return;
    }

    onAnonymousOrSignedOut?.(user);
  });

  void supabase.auth.getSession().then(({ data }) => {
    persistProviderTokens(data.session);
    const user = data.session?.user ?? null;
    if (user && !user.is_anonymous && data.session) {
      onPermanentUser?.(user, data.session);
    } else {
      onAnonymousOrSignedOut?.(user);
    }
  });

  return () => subscription.unsubscribe();
}

export async function googleSupabaseSignIn(
  forceAccountSelect = false
): Promise<void> {
  const prompt = forceAccountSelect ? 'consent select_account' : 'consent';

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      scopes: DRIVE_SCOPES.join(' '),
      redirectTo: window.location.origin,
      queryParams: {
        access_type: 'offline',
        prompt,
      },
    },
  });

  if (error) throw error;
}

export async function supabaseLogout(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  clearProviderTokens();
  if (error) throw error;
}
