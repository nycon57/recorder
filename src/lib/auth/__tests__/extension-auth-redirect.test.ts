import { describe, expect, it } from '@jest/globals';

import {
  getAuthPagePathWithExtensionState,
  getExtensionAuthPath,
} from '@/lib/auth/extension-auth-redirect';

describe('extension auth redirect helpers', () => {
  it('builds the extension callback destination from extension auth state', () => {
    expect(
      getExtensionAuthPath(
        new URLSearchParams('extension_auth_state=nonce with spaces'),
      ),
    ).toBe('/extension/auth/callback?extension_auth_state=nonce%20with%20spaces');
  });

  it('falls back to dashboard when extension auth state is absent', () => {
    expect(getExtensionAuthPath(new URLSearchParams('source=extension'))).toBe(
      '/dashboard',
    );
  });

  it('preserves extension auth state when switching between auth pages', () => {
    const searchParams = new URLSearchParams('extension_auth_state=nonce/1');

    expect(
      getAuthPagePathWithExtensionState('/sign-up', searchParams),
    ).toBe('/sign-up?extension_auth_state=nonce%2F1');
    expect(
      getAuthPagePathWithExtensionState('/sign-in', searchParams),
    ).toBe('/sign-in?extension_auth_state=nonce%2F1');
  });

  it('leaves auth page links unchanged outside extension auth', () => {
    expect(
      getAuthPagePathWithExtensionState(
        '/sign-up',
        new URLSearchParams('source=web'),
      ),
    ).toBe('/sign-up');
  });
});
