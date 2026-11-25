import { AtpSessionData } from '@atproto/api';

export const BSKY_PUBLIC_API = 'https://bsky.app';
export const BSKY_PDS_HOST = 'https://bsky.social';
const SESSION_STORAGE_KEY = 'dits_bsky_session';
const BSKY_MOD_LABELER = 'did:plc:ar7c4by46qjdydhdevvrndac;redact';

let activeRefreshPromise: Promise<AtpSessionData | null> | null = null;

export async function loginWithAppPassword(identifier: string, password: string) {
  const res = await fetch(`${BSKY_PDS_HOST}/xrpc/com.atproto.server.createSession`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: identifier.replace(/^@/, '').trim(),
      password: password.trim(),
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Invalid handle or App Password');
  }

  const session: AtpSessionData = await res.json();
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  return session;
}

export function getSavedSession(): AtpSessionData | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(SESSION_STORAGE_KEY);
  return raw ? (JSON.parse(raw) as AtpSessionData) : null;
}

export function logoutSession() {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

export async function refreshStoredSession(
  currentSession: AtpSessionData
): Promise<AtpSessionData | null> {
  if (activeRefreshPromise) return activeRefreshPromise;

  activeRefreshPromise = (async () => {
    try {
      const res = await fetch(`${BSKY_PDS_HOST}/xrpc/com.atproto.server.refreshSession`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${currentSession.refreshJwt}` },
      });

      if (!res.ok) {
        logoutSession();
        window.dispatchEvent(new Event('dits-session-expired'));
        return null;
      }

      const data = await res.json();
      const updatedSession: AtpSessionData = {
        ...currentSession,
        accessJwt: data.accessJwt,
        refreshJwt: data.refreshJwt,
        handle: data.handle || currentSession.handle,
        did: data.did || currentSession.did,
      };

      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updatedSession));
      window.dispatchEvent(new CustomEvent('dits-session-updated', { detail: updatedSession }));
      return updatedSession;
    } catch {
      return null;
    } finally {
      activeRefreshPromise = null;
    }
  })();

  return activeRefreshPromise;
}

export async function authorizedFetch(
  url: string,
  init: RequestInit = {},
  explicitSession?: AtpSessionData | null
): Promise<Response> {
  const session = explicitSession !== undefined ? explicitSession : getSavedSession();
  const baseHeaders = {
    'atproto-accept-labelers': BSKY_MOD_LABELER,
    ...init.headers,
  };

  if (!session) {
    return fetch(url, { ...init, headers: baseHeaders });
  }

  const makeRequest = (token: string) =>
    fetch(url, {
      ...init,
      headers: { ...baseHeaders, Authorization: `Bearer ${token}` },
    });

  let res = await makeRequest(session.accessJwt);

  if (res.status === 400 || res.status === 401) {
    const errBody = await res.clone().json().catch(() => ({}));
    if (res.status === 401 || errBody?.error === 'ExpiredToken') {
      const refreshed = await refreshStoredSession(session);
      if (refreshed) {
        res = await makeRequest(refreshed.accessJwt);
      }
    }
  }

  return res;
}
