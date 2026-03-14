import { apiFetch, refreshAuthSession } from '../api/client';
import {
  clearAuthSession,
  getAuthSession,
  persistAuthSession,
} from './auth-session';

export interface LoginWithPasswordInput {
  email: string;
  password: string;
}

export interface RegisterWithPasswordInput {
  email: string;
  name?: string;
  password: string;
}

interface GoogleCredentialResponse {
  credential?: string;
}

interface GooglePromptMomentNotification {
  isNotDisplayed(): boolean;
  isSkippedMoment(): boolean;
}

interface GoogleAccountsIdApi {
  initialize(config: {
    callback: (response: GoogleCredentialResponse) => void;
    client_id: string;
  }): void;
  prompt(
    momentListener?: (notification: GooglePromptMomentNotification) => void,
  ): void;
}

interface GoogleWindow {
  google?: {
    accounts?: {
      id?: GoogleAccountsIdApi;
    };
  };
}

const GOOGLE_IDENTITY_SCRIPT_ID = 'irontrack-google-identity-client';
const GOOGLE_IDENTITY_SCRIPT_URL = 'https://accounts.google.com/gsi/client';
const GOOGLE_SIGN_IN_TIMEOUT_MS = 15_000;
let googleIdentityClientPromise: Promise<GoogleAccountsIdApi> | null = null;

export async function loginWithPassword(input: LoginWithPasswordInput) {
  const authSession = await apiFetch('/auth/login', {
    method: 'POST',
    credentials: 'include',
    body: input as unknown as BodyInit,
  });

  return persistAuthSessionFromPayload(authSession);
}

export async function registerWithPassword(input: RegisterWithPasswordInput) {
  const authSession = await apiFetch('/auth/register', {
    method: 'POST',
    credentials: 'include',
    body: input as unknown as BodyInit,
  });

  return persistAuthSessionFromPayload(authSession);
}

export async function exchangeGoogleIdToken(idToken: string) {
  const authSession = await apiFetch('/auth/google', {
    method: 'POST',
    credentials: 'include',
    body: { idToken } as unknown as BodyInit,
  });

  return persistAuthSessionFromPayload(authSession);
}

export async function signInWithGoogle() {
  const clientId = resolveGoogleClientId();
  const googleAccountsId = await loadGoogleAccountsId();
  const idToken = await requestGoogleIdToken(googleAccountsId, clientId);

  return exchangeGoogleIdToken(idToken);
}

export async function refreshStoredSession() {
  return refreshAuthSession();
}

export async function logoutCurrentSession() {
  const session = getAuthSession();
  if (!session?.accessToken) {
    clearAuthSession();
    return { success: true };
  }

  const result = await apiFetch('/auth/logout', {
    method: 'POST',
    credentials: 'include',
    skipAuthRefresh: true,
  });
  clearAuthSession();
  return result ?? { success: true };
}

function persistAuthSessionFromPayload(payload: unknown) {
  if (
    !payload ||
    typeof payload !== 'object' ||
    typeof (payload as { accessToken?: unknown }).accessToken !== 'string'
  ) {
    throw new Error('Auth response did not include a valid session');
  }

  return persistAuthSession({
    accessToken: (payload as { accessToken: string }).accessToken,
  });
}

function resolveGoogleClientId(): string {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
  if (!clientId) {
    throw new Error('Google sign-in is not configured');
  }

  return clientId;
}

async function loadGoogleAccountsId(): Promise<GoogleAccountsIdApi> {
  const existingApi = readGoogleAccountsId();
  if (existingApi) {
    return existingApi;
  }

  if (googleIdentityClientPromise) {
    return googleIdentityClientPromise;
  }

  googleIdentityClientPromise = new Promise<GoogleAccountsIdApi>(
    (resolve, reject) => {
      const availableApi = readGoogleAccountsId();
      if (availableApi) {
        resolve(availableApi);
        return;
      }

      if (typeof document === 'undefined') {
        reject(new Error('Google sign-in is only available in the browser'));
        return;
      }

      const existingScript = document.getElementById(
        GOOGLE_IDENTITY_SCRIPT_ID,
      ) as HTMLScriptElement | null;
      const script = existingScript ?? document.createElement('script');

      const handleReady = () => {
        script.dataset.loaded = 'true';
        const googleAccountsId = readGoogleAccountsId();
        if (!googleAccountsId) {
          reject(new Error('Google sign-in client failed to initialize'));
          return;
        }

        resolve(googleAccountsId);
      };

      if (existingScript?.dataset.loaded === 'true') {
        handleReady();
        return;
      }

      if (!existingScript) {
        script.id = GOOGLE_IDENTITY_SCRIPT_ID;
        script.src = GOOGLE_IDENTITY_SCRIPT_URL;
        script.async = true;
        script.defer = true;
        script.addEventListener('load', handleReady, { once: true });
        script.addEventListener(
          'error',
          () => {
            reject(new Error('Failed to load Google sign-in client'));
          },
          { once: true },
        );
        document.head.appendChild(script);
        return;
      }

      existingScript.addEventListener('load', handleReady, { once: true });
      existingScript.addEventListener(
        'error',
        () => {
          reject(new Error('Failed to load Google sign-in client'));
        },
        { once: true },
      );
    },
  ).catch((error: unknown) => {
    googleIdentityClientPromise = null;
    throw error;
  });

  return googleIdentityClientPromise;
}

function readGoogleAccountsId(): GoogleAccountsIdApi | undefined {
  return (
    (globalThis as typeof globalThis & GoogleWindow).google?.accounts?.id ??
    undefined
  );
}

function requestGoogleIdToken(
  googleAccountsId: GoogleAccountsIdApi,
  clientId: string,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let settled = false;
    const timeoutId = setTimeout(() => {
      rejectOnce(new Error('Google sign-in timed out'));
    }, GOOGLE_SIGN_IN_TIMEOUT_MS);

    const resolveOnce = (credential: string) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeoutId);
      resolve(credential);
    };

    const rejectOnce = (error: Error) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeoutId);
      reject(error);
    };

    googleAccountsId.initialize({
      client_id: clientId,
      callback: (response) => {
        const credential = response.credential?.trim();
        if (!credential) {
          rejectOnce(new Error('Google sign-in did not return an ID token'));
          return;
        }

        resolveOnce(credential);
      },
    });

    googleAccountsId.prompt((notification) => {
      if (settled) {
        return;
      }

      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        rejectOnce(new Error('Google sign-in was not completed'));
      }
    });
  });
}
