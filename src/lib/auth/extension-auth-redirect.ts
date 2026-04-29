const EXTENSION_AUTH_STATE_PARAM = 'extension_auth_state';
const EXTENSION_AUTH_CALLBACK_PATH = '/extension/auth/callback';
const DEFAULT_AUTH_DESTINATION = '/dashboard';

type SearchParamReader = Pick<URLSearchParams, 'get'>;

function getSearchParams(
  searchParams?: SearchParamReader | string | null,
): SearchParamReader | null {
  if (typeof searchParams === 'string') {
    return new URLSearchParams(searchParams);
  }

  if (searchParams) {
    return searchParams;
  }

  if (typeof window === 'undefined') {
    return null;
  }

  return new URLSearchParams(window.location.search);
}

function readExtensionAuthState(
  searchParams?: SearchParamReader | string | null,
): string | null {
  return getSearchParams(searchParams)?.get(EXTENSION_AUTH_STATE_PARAM) ?? null;
}

export function getExtensionAuthPath(
  searchParams?: SearchParamReader | string | null,
): string {
  const extensionAuthState = readExtensionAuthState(searchParams);

  return extensionAuthState
    ? `${EXTENSION_AUTH_CALLBACK_PATH}?${EXTENSION_AUTH_STATE_PARAM}=${encodeURIComponent(
        extensionAuthState,
      )}`
    : DEFAULT_AUTH_DESTINATION;
}

export function getAuthPagePathWithExtensionState(
  pathname: '/sign-in' | '/sign-up',
  searchParams?: SearchParamReader | string | null,
): string {
  const extensionAuthState = readExtensionAuthState(searchParams);

  return extensionAuthState
    ? `${pathname}?${EXTENSION_AUTH_STATE_PARAM}=${encodeURIComponent(
        extensionAuthState,
      )}`
    : pathname;
}
