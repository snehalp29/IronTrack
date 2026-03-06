import { apiFetch } from '../api/client';
import { persistAuthSession } from './auth-session';

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
let googleIdentityClientPromise: Promise<GoogleAccountsIdApi> | null = null;

export async function loginWithPassword(input: LoginWithPasswordInput) {
  const authSession = await apiFetch('/auth/login', {
    method: 'POST',
    body: input as unknown as BodyInit,
  });

  return persistAuthSessionFromPayload(authSession);
}

export async function registerWithPassword(input: RegisterWithPasswordInput) {
  const authSession = await apiFetch('/auth/register', {
    method: 'POST',
    body: input as unknown as BodyInit,
  });

  return persistAuthSessionFromPayload(authSession);
}

export async function exchangeGoogleIdToken(idToken: string) {
  const authSession = await apiFetch('/auth/google', {
    method: 'POST',
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

function persistAuthSessionFromPayload(payload: unknown) {
  if (
    !payload ||
    typeof payload !== 'object' ||
    typeof (payload as { accessToken?: unknown }).accessToken !== 'string' ||
    typeof (payload as { refreshToken?: unknown }).refreshToken !== 'string'
  ) {
    throw new Error('Auth response did not include a valid session');
  }

  return persistAuthSession({
    accessToken: (payload as { accessToken: string }).accessToken,
    refreshToken: (payload as { refreshToken: string }).refreshToken,
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
  if (googleIdentityClientPromise) {
    return googleIdentityClientPromise;
  }

  googleIdentityClientPromise = new Promise<GoogleAccountsIdApi>(
    (resolve, reject) => {
      if (typeof document === 'undefined') {
        reject(new Error('Google sign-in is only available in the browser'));
        return;
      }

      const existingApi = readGoogleAccountsId();
      if (existingApi) {
        resolve(existingApi);
        return;
      }

      const existingScript = document.getElementById(
        GOOGLE_IDENTITY_SCRIPT_ID,
      ) as HTMLScriptElement | null;
      const script = existingScript ?? document.createElement('script');

      const handleReady = () => {
        const googleAccountsId = readGoogleAccountsId();
        if (!googleAccountsId) {
          reject(new Error('Google sign-in client failed to initialize'));
          return;
        }

        resolve(googleAccountsId);
      };

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

    googleAccountsId.initialize({
      client_id: clientId,
      callback: (response) => {
        const credential = response.credential?.trim();
        if (!credential) {
          reject(new Error('Google sign-in did not return an ID token'));
          return;
        }

        settled = true;
        resolve(credential);
      },
    });

    googleAccountsId.prompt((notification) => {
      if (settled) {
        return;
      }

      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        reject(new Error('Google sign-in was not completed'));
      }
    });
  });
}
