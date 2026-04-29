/* global describe, expect, it */

import {
  isTrustedExtensionAuthCallbackUrl,
  readValidatedExtensionAuthCallbackToken,
} from '../utils/auth-callback';

describe('extension auth callback hardening', () => {
  const apiBaseUrl = 'http://localhost:3000';

  it('trusts only the configured Tribora extension callback route', () => {
    expect(
      isTrustedExtensionAuthCallbackUrl(
        'http://localhost:3000/extension/auth/callback?extension_auth_state=abc',
        apiBaseUrl,
      ),
    ).toBe(true);
    expect(
      isTrustedExtensionAuthCallbackUrl(
        'http://localhost:3000/dashboard?extension_auth_state=abc',
        apiBaseUrl,
      ),
    ).toBe(false);
    expect(
      isTrustedExtensionAuthCallbackUrl(
        'https://attacker.example/extension/auth/callback?extension_auth_state=abc',
        apiBaseUrl,
      ),
    ).toBe(false);
  });

  it('accepts only a matching one-time state and returns the callback token', () => {
    expect(
      readValidatedExtensionAuthCallbackToken({
        state: 'nonce-1',
        now: 500,
        apiBaseUrl,
        pending: {
          state: 'nonce-1',
          expiresAt: 1_000,
        },
        callbackUrl:
          'http://localhost:3000/extension/auth/callback?extension_auth_state=nonce-1',
        session: {
          status: 'authenticated',
          token: 'callback-token',
        },
      }),
    ).toBe('callback-token');
  });

  it('rejects spoofed callbacks before backend validation or persistence', () => {
    expect(() =>
      readValidatedExtensionAuthCallbackToken({
        state: 'nonce-1',
        now: 500,
        apiBaseUrl,
        pending: {
          state: 'nonce-1',
          expiresAt: 1_000,
        },
        callbackUrl: 'https://attacker.example/extension/auth/callback',
        session: { token: 'callback-token' },
      }),
    ).toThrow('Auth callback URL is not trusted');
  });

  it('rejects stale or mismatched one-time auth state', () => {
    expect(() =>
      readValidatedExtensionAuthCallbackToken({
        state: 'nonce-2',
        now: 600,
        apiBaseUrl,
        pending: {
          state: 'nonce-1',
          expiresAt: 500,
        },
        callbackUrl: 'http://localhost:3000/extension/auth/callback',
        session: { token: 'callback-token' },
      }),
    ).toThrow('Auth callback state is invalid or expired');
  });
});
