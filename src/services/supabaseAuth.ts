import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

export const DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.file',
];

const STORAGE_PROVIDER_TOKEN = 'rommochobi_gdrive_provider_token_v1';

function persistProviderToken(session: Session | null) {
  if (!session?.provider_token) return;
  try {
    sessionStorage.setItem(STORAGE_PROVIDER_TOKEN, session.provider_token);
  } catch {
    // Session storage can be unavailable in privacy modes; auth still works.
  }
}

export function clearProviderTokens() {
  try {
    sessionStorage.removeItem(STORAGE_PROVIDER_TOKEN);
    localStorage.removeItem(STORAGE_PROVIDER_TOKEN);
    localStorage.removeItem('rommochobi_gdrive_provider_refresh_token_v1');
  } catch {}
}

export function getGoogleDriveAccessToken(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_PROVIDER_TOKEN);
  } catch {
    return null;
  }
}

// Kept for compatibility only. Long-lived Google refresh tokens are not stored in the browser.
export function getGoogleDriveRefreshToken(): string | null {
  return null;
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
    persistProviderToken(session);

    const user = session?.user ?? null;
    if (user && !user.is_anonymous && session) {
      onPermanentUser?.(user, session);
      return;
    }

    onAnonymousOrSignedOut?.(user);
  });

  void supabase.auth.getSession().then(({ data }) => {
    persistProviderToken(data.session);
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
  // Never reuse a stale Google provider token when reconnecting.
  clearProviderTokens();

  const prompt = forceAccountSelect ? 'consent select_account' : 'consent';

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      scopes: DRIVE_SCOPES.join(' '),
      redirectTo: window.location.origin,
      queryParams: {
        access_type: 'offline',
        prompt,
        include_granted_scopes: 'true',
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
