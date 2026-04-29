/**
 * content/index.ts — Main content script for the Tribora extension.
 *
 * Thin view layer: page context observation, DOM overlay, floating widget,
 * and DOM tool execution on behalf of the offscreen-hosted agent session.
 * The ElevenLabs Conversation itself lives in the offscreen document so
 * it survives page navigations.
 */

/* global chrome, defineContentScript */

import {
  buildContextSemanticFingerprint,
  type OverlayTarget,
  type PageContext,
} from '@tribora/shared';

import {
  clickElement,
  hoverElement,
  scrollElementIntoView,
} from '../../utils/dom-actions.js';
import { runVerifiedAction } from '../../utils/action-verification.js';
import { typeIntoElement } from '../../utils/dom-input.js';
import { pressKey } from '../../utils/dom-keyboard.js';
import { deriveWidgetBootstrapState } from '../../utils/session-startup.js';
import { shouldClearOverlayForSessionEvent } from '../../utils/session-visuals.js';

import { createWidget } from './widget';
import { createDomOverlay } from './dom-overlay';
import { createDomObserver } from './dom-observer';
import { buildPageContext } from './context-engine';

const LOG = '[Tribora content]';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',

  main() {
    console.log(`${LOG} Loaded on`, window.location.href);

    // ── Page context + SPA observer ───────────────────────────────────────────
    const initialContext: PageContext = buildPageContext(document, window);
    let latestContext: PageContext = initialContext;
    const publishPageContext = (context: PageContext): void => {
      latestContext = context;
      chrome.runtime.sendMessage(
        { type: 'PAGE_CONTEXT_UPDATED', context },
        () => void chrome.runtime.lastError,
      );
    };

    publishPageContext(initialContext);

    const observer = createDomObserver((ctx: PageContext) => {
      publishPageContext(ctx);
    });
    observer.start();

    async function getFreshLatestContext(): Promise<PageContext> {
      const refreshed = await observer.flush();
      if (refreshed) {
        latestContext = refreshed;
      }
      return latestContext;
    }

    async function refreshContextAfterAction(args: {
      previousFingerprint: string;
      previousUrl: string;
      timeoutMs?: number;
      intervalMs?: number;
    }): Promise<void> {
      const timeoutMs = args.timeoutMs ?? 900;
      const intervalMs = args.intervalMs ?? 120;
      const deadline = Date.now() + timeoutMs;

      while (Date.now() <= deadline) {
        const refreshed = await observer.forceRescan();
        latestContext = refreshed;

        const nextFingerprint = buildContextSemanticFingerprint(refreshed);
        if (
          nextFingerprint !== args.previousFingerprint ||
          window.location.href !== args.previousUrl
        ) {
          return;
        }

        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, intervalMs);
        });
      }
    }

    // ── DOM overlay ───────────────────────────────────────────────────────────
    const overlay = createDomOverlay();

    let overlayClearTimer: number | null = null;
    function scheduleOverlayClear(delayMs = 3000): void {
      if (overlayClearTimer !== null) window.clearTimeout(overlayClearTimer);
      overlayClearTimer = window.setTimeout(() => {
        overlay.clear();
        overlayClearTimer = null;
      }, delayMs);
    }
    function cancelOverlayClear(): void {
      if (overlayClearTimer !== null) {
        window.clearTimeout(overlayClearTimer);
        overlayClearTimer = null;
      }
    }

    // ── Auth bridge (from web sign-in page via window.postMessage) ────────────
    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      if (event.data?.type !== 'TRIBORA_AUTH_SUCCESS') return;
      chrome.runtime.sendMessage(
        { type: 'AUTH_CALLBACK', session: event.data.session },
        () => void chrome.runtime.lastError,
      );
    });

    // ── Widget ────────────────────────────────────────────────────────────────
    const widget = createWidget({
      onStartClick: () => {
        widget.setConnecting();
        chrome.runtime.sendMessage(
          { type: 'START_AGENT_SESSION' },
          (resp: { ok?: boolean; error?: string } | undefined) => {
            void chrome.runtime.lastError;
            if (!resp?.ok) {
              console.error(
                `${LOG} START_AGENT_SESSION failed:`,
                resp?.error ?? chrome.runtime.lastError?.message,
              );
              widget.setIdle();
            }
          },
        );
      },
      onStopClick: () => {
        chrome.runtime.sendMessage(
          { type: 'END_AGENT_SESSION' },
          () => void chrome.runtime.lastError,
        );
        widget.setIdle();
        overlay.clear();
      },
    });

    // Restore widget visibility + session state on content script load.
    void (async () => {
      try {
        const resp = (await chrome.runtime.sendMessage({
          type: 'GET_EXTENSION_STATE',
        })) as
          | {
              enabled?: boolean;
              active?: boolean;
              isHomeTab?: boolean;
            }
          | undefined;

        const bootstrapState = deriveWidgetBootstrapState({
          extensionEnabled: resp?.enabled === true,
          sessionActive: resp?.active === true,
          isHomeTab: resp?.isHomeTab === true,
        });

        if (!bootstrapState.visible) {
          widget.hide();
          return;
        }

        widget.show();

        if (bootstrapState.mode === 'connecting') {
          widget.setConnecting();
          return;
        }

        widget.setIdle();
      } catch (err) {
        console.warn(`${LOG} Widget restore failed:`, (err as Error).message);
      }
    })();

    // ── Tool execution helpers ────────────────────────────────────────────────
    async function execGetPageContext(): Promise<string> {
      const context = await getFreshLatestContext();
      return JSON.stringify({
        ...context,
        appSignature:
          context.appSignature ?? `${context.app}:${context.screen}`,
        interactiveElements: context.interactiveElements,
      });
    }

    function execHighlightElement(args: {
      selector: string;
      label?: string;
      action?: string;
    }): string {
      cancelOverlayClear();
      const el = document.querySelector(args.selector);
      if (!el) return 'target unavailable: element not found';
      if (args.action === 'highlight') overlay.highlight(args.selector);
      else if (args.action === 'pulse') overlay.pulse(args.selector);
      else overlay.pointAt(args.selector, args.label ?? '');
      scheduleOverlayClear(6000);
      return 'highlighted';
    }

    function execHighlightElements(args: { targets: OverlayTarget[] }): string {
      cancelOverlayClear();
      const targets = (args.targets ?? []).filter((target) => {
        if (typeof target?.selector !== 'string') return false;
        try {
          return !!document.querySelector(target.selector);
        } catch {
          return false;
        }
      });
      if (targets.length === 0) return 'target unavailable: element not found';
      overlay.showTargets(targets);
      scheduleOverlayClear(8000);
      return 'highlighted';
    }

    async function execClickElement(args: {
      selector: string;
    }): Promise<string> {
      cancelOverlayClear();
      const el = document.querySelector<HTMLElement>(args.selector);
      if (!el) return 'target unavailable: element not found';
      const previousFingerprint =
        buildContextSemanticFingerprint(latestContext);
      const previousUrl = window.location.href;
      overlay.pointAt(args.selector);
      scheduleOverlayClear(1500);
      const result = await runVerifiedAction({
        kind: 'click',
        windowObject: window,
        element: el,
        action: () => {
          scrollElementIntoView(el);
          return clickElement(el);
        },
      });
      await refreshContextAfterAction({ previousFingerprint, previousUrl });
      return result;
    }

    async function execHoverElement(args: {
      selector: string;
    }): Promise<string> {
      cancelOverlayClear();
      const el = document.querySelector<HTMLElement>(args.selector);
      if (!el) return 'target unavailable: element not found';
      const previousFingerprint =
        buildContextSemanticFingerprint(latestContext);
      const previousUrl = window.location.href;
      overlay.pointAt(args.selector);
      scheduleOverlayClear(2500);
      const result = await runVerifiedAction({
        kind: 'hover',
        windowObject: window,
        element: el,
        action: () => {
          scrollElementIntoView(el);
          return hoverElement(el);
        },
      });
      await refreshContextAfterAction({
        previousFingerprint,
        previousUrl,
        timeoutMs: 600,
      });
      return result;
    }

    async function execTypeInElement(args: {
      selector: string;
      text: string;
      clear?: boolean;
    }): Promise<string> {
      cancelOverlayClear();
      const el = document.querySelector<HTMLElement>(args.selector);
      if (!el) return 'target unavailable: element not found';
      const previousFingerprint =
        buildContextSemanticFingerprint(latestContext);
      const previousUrl = window.location.href;
      overlay.pointAt(args.selector);
      scheduleOverlayClear(2500);
      const result = await runVerifiedAction({
        kind: 'type',
        windowObject: window,
        element: el,
        action: () => {
          scrollElementIntoView(el);
          el.focus();
          return typeIntoElement(el, args);
        },
      });
      await refreshContextAfterAction({
        previousFingerprint,
        previousUrl,
        timeoutMs: 500,
      });
      return result;
    }

    async function execScrollToElement(args: {
      selector: string;
    }): Promise<string> {
      cancelOverlayClear();
      const el = document.querySelector<HTMLElement>(args.selector);
      if (!el) return 'target unavailable: element not found';
      overlay.pointAt(args.selector);
      scheduleOverlayClear(3000);
      return runVerifiedAction({
        kind: 'scroll',
        windowObject: window,
        element: el,
        action: () => scrollElementIntoView(el),
      });
    }

    async function execPressKey(args: {
      key: string;
      selector?: string;
      modifiers?: string[];
      repeat?: number;
    }): Promise<string> {
      const target = args.selector
        ? document.querySelector<HTMLElement>(args.selector)
        : ((document.activeElement as HTMLElement | null) ?? document.body);

      if (!(target instanceof HTMLElement)) {
        return 'target unavailable: element not found';
      }

      cancelOverlayClear();
      const previousFingerprint =
        buildContextSemanticFingerprint(latestContext);
      const previousUrl = window.location.href;
      if (args.selector) {
        overlay.pointAt(args.selector);
        scheduleOverlayClear(2500);
      }

      const result = await runVerifiedAction({
        kind: 'keyboard',
        windowObject: window,
        element: target,
        actionLabel: [args.modifiers ?? [], args.key].flat().join('+'),
        action: () => {
          scrollElementIntoView(target);
          return pressKey({
            key: args.key,
            target,
            modifiers: args.modifiers,
            repeat: args.repeat,
          });
        },
      });
      await refreshContextAfterAction({ previousFingerprint, previousUrl });
      return result;
    }

    function replyTool(callId: string, result?: string, error?: string): void {
      chrome.runtime.sendMessage(
        { type: 'TOOL_RESULT', callId, result, error },
        () => void chrome.runtime.lastError,
      );
    }

    // ── Message listeners ─────────────────────────────────────────────────────
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg?.type === 'QUERY_WIDGET_STATE') {
        sendResponse({ visible: widget.isVisible() });
        return false;
      }
      if (msg?.type === 'TOGGLE_WIDGET') {
        if (msg.visible) {
          widget.show();
        } else {
          widget.hide();
          overlay.clear();
        }
        sendResponse({ ok: true });
        return false;
      }
      if (msg?.type === 'GET_PAGE_CONTEXT') {
        void getFreshLatestContext().then((context) =>
          sendResponse({ type: 'PAGE_CONTEXT_RESPONSE', payload: context }),
        );
        return true;
      }
      if (msg?.type === 'PAGE_CONTEXT_ENRICHED' && msg.context) {
        latestContext = msg.context as PageContext;
        sendResponse({ ok: true });
        return false;
      }

      // Overlay messages kept for any external callers (e.g. query SSE flow
      // that uses overlay hints). Safe no-ops if unused.
      if (msg?.type === 'OVERLAY_POINT') {
        overlay.pointAt(
          msg.selector as string,
          msg.label as string | undefined,
        );
        sendResponse({ ok: true });
        return false;
      }
      if (msg?.type === 'OVERLAY_HIGHLIGHT') {
        overlay.highlight(msg.selector as string);
        sendResponse({ ok: true });
        return false;
      }
      if (msg?.type === 'OVERLAY_PULSE') {
        overlay.pulse(msg.selector as string);
        sendResponse({ ok: true });
        return false;
      }
      if (msg?.type === 'OVERLAY_CLEAR') {
        overlay.clear();
        sendResponse({ ok: true });
        return false;
      }

      // Session events from offscreen (forwarded by background)
      if (msg?.type === 'SESSION_EVENT') {
        const { kind, payload } = msg as {
          kind: string;
          payload: Record<string, unknown>;
        };
        switch (kind) {
          case 'connected':
            widget.setListening();
            break;
          case 'disconnected':
          case 'error':
            if (kind === 'error' && payload?.error) {
              console.error(`${LOG} Session error:`, payload.error);
            }
            widget.setIdle();
            if (shouldClearOverlayForSessionEvent(kind)) {
              overlay.clear();
            }
            break;
          case 'mode_change': {
            const mode = payload?.mode as 'listening' | 'speaking' | undefined;
            if (mode === 'listening') {
              widget.setListening();
            } else if (mode === 'speaking') {
              widget.setSpeaking();
            }
            break;
          }
          case 'message':
            // Text/transcript log if ever needed — no-op for now
            break;
          default:
            break;
        }
        sendResponse({ ok: true });
        return false;
      }

      // Tool calls from background (offscreen-originated)
      if (msg?.type === 'TOOL_CALL') {
        const { callId, name, args } = msg as {
          callId: string;
          name: string;
          args: Record<string, unknown>;
        };
        void (async () => {
          try {
            let result = '';
            switch (name) {
              case 'get_page_context':
                result = await execGetPageContext();
                break;
              case 'highlight_element':
                result = execHighlightElement(
                  args as { selector: string; label?: string; action?: string },
                );
                break;
              case 'highlight_elements':
                result = execHighlightElements(
                  args as { targets: OverlayTarget[] },
                );
                break;
              case 'click_element':
                result = await execClickElement(args as { selector: string });
                break;
              case 'hover_element':
                result = await execHoverElement(args as { selector: string });
                break;
              case 'type_in_element':
                result = await execTypeInElement(
                  args as { selector: string; text: string; clear?: boolean },
                );
                break;
              case 'scroll_to_element':
                result = await execScrollToElement(
                  args as { selector: string },
                );
                break;
              case 'press_key':
                result = await execPressKey(
                  args as {
                    key: string;
                    selector?: string;
                    modifiers?: string[];
                    repeat?: number;
                  },
                );
                break;
              default:
                replyTool(callId, undefined, `Unknown tool: ${name}`);
                return;
            }
            replyTool(callId, result);
          } catch (err) {
            replyTool(callId, undefined, (err as Error).message);
          }
        })();
        sendResponse({ ok: true });
        return false;
      }

      return false;
    });
  },
});
