/** Auth session state shared between extension popup, content script, and background */
export interface SessionState {
  status: 'unauthenticated' | 'authenticating' | 'authenticated' | 'expired';
  user?: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
  };
  activeOrg?: {
    id: string;
    name: string;
    slug: string;
  };
  /** Session token stored in chrome.storage.session */
  token?: string;
  /** Unix ms timestamp */
  expiresAt?: number;
  lastError?: string;
}

export interface AuthMessage {
  type:
    | 'AUTH_STATE_REQUEST'
    | 'AUTH_STATE_UPDATE'
    | 'AUTH_SIGN_IN'
    | 'AUTH_SIGN_OUT'
    | 'AUTH_REFRESH_TOKEN';
  state?: SessionState;
}
