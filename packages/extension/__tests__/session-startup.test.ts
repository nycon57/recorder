/* global describe, expect, it */

import {
  deriveWidgetBootstrapState,
  isSupportedVoiceTargetUrl,
  shouldCollectPageContext,
  shouldRegisterVoiceTarget,
} from '../utils/session-startup';

describe('voice session startup helpers', () => {
  it('restores the widget as connecting only on the active target', () => {
    expect(
      deriveWidgetBootstrapState({
        extensionEnabled: true,
        sessionActive: true,
        isActiveTarget: true,
      }),
    ).toEqual({ visible: true, mode: 'connecting' });

    expect(
      deriveWidgetBootstrapState({
        extensionEnabled: true,
        sessionActive: true,
        isActiveTarget: false,
      }),
    ).toEqual({ visible: true, mode: 'idle' });
  });

  it('recognizes normal web pages as supported voice targets', () => {
    expect(isSupportedVoiceTargetUrl('https://example.com/accounts')).toBe(
      true,
    );
    expect(isSupportedVoiceTargetUrl('http://localhost:3000')).toBe(true);
    expect(isSupportedVoiceTargetUrl('chrome://extensions')).toBe(false);
    expect(
      isSupportedVoiceTargetUrl('chrome-extension://abc/offscreen.html'),
    ).toBe(false);
    expect(isSupportedVoiceTargetUrl(undefined)).toBe(false);
  });

  it('allows enabled active pages to become the movable voice target', () => {
    const base = {
      extensionEnabled: true,
      sessionActive: true,
      candidateTabId: 42,
      candidateUrl: 'https://crm.example.com/leads',
    };

    expect(
      shouldRegisterVoiceTarget({
        ...base,
        activeTargetTabId: null,
        candidateTabActive: false,
      }),
    ).toBe(true);

    expect(
      shouldRegisterVoiceTarget({
        ...base,
        activeTargetTabId: 7,
        candidateTabActive: true,
      }),
    ).toBe(true);

    expect(
      shouldRegisterVoiceTarget({
        ...base,
        activeTargetTabId: 7,
        candidateTabActive: false,
      }),
    ).toBe(false);
  });

  it('does not register unsupported pages or inactive extension states', () => {
    expect(
      shouldRegisterVoiceTarget({
        extensionEnabled: false,
        sessionActive: true,
        activeTargetTabId: null,
        candidateTabId: 42,
        candidateTabActive: true,
        candidateUrl: 'https://example.com',
      }),
    ).toBe(false);

    expect(
      shouldRegisterVoiceTarget({
        extensionEnabled: true,
        sessionActive: false,
        activeTargetTabId: null,
        candidateTabId: 42,
        candidateTabActive: true,
        candidateUrl: 'https://example.com',
      }),
    ).toBe(false);

    expect(
      shouldRegisterVoiceTarget({
        extensionEnabled: true,
        sessionActive: true,
        activeTargetTabId: null,
        candidateTabId: 42,
        candidateTabActive: true,
        candidateUrl: 'chrome://settings',
      }),
    ).toBe(false);
  });

  it('collects page context only when extension, session, and target tab allow it', () => {
    expect(
      shouldCollectPageContext({
        extensionEnabled: true,
        sessionActive: true,
        isHomeTab: true,
      }),
    ).toBe(true);

    expect(
      shouldCollectPageContext({
        extensionEnabled: false,
        sessionActive: true,
        isHomeTab: true,
      }),
    ).toBe(false);

    expect(
      shouldCollectPageContext({
        extensionEnabled: true,
        sessionActive: false,
        isHomeTab: true,
      }),
    ).toBe(false);

    expect(
      shouldCollectPageContext({
        extensionEnabled: true,
        sessionActive: true,
        isHomeTab: false,
      }),
    ).toBe(false);
  });
});
