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
  sanitizePageContextForModel,
  sanitizePageContextForNetwork,
  type OverlayTarget,
  type PageElementSearchResult,
  type PageContext,
  type PageRegionInspectionResult,
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
import { isTrustedExtensionAuthCallbackRuntimeUrl } from '../../utils/auth-session.js';
import {
  buildPageInstanceId,
  type VoiceToolRouteMeta,
} from '../../utils/voice-tool-routing.js';

import { createWidget } from './widget';
import { createDomOverlay } from './dom-overlay';
import { createDomObserver, type DomObserver } from './dom-observer';
import {
  buildPageContext,
  inspectElementFromDom,
  inspectPageRegionFromDom,
  searchPageElementsFromDom,
} from './context-engine';

const LOG = '[Tribora content]';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',

  main() {
    console.log(`${LOG} Loaded on`, window.location.href);

    // ── Page context + SPA observer ───────────────────────────────────────────
    const contentInstanceId =
      typeof crypto?.randomUUID === 'function'
        ? `content_${crypto.randomUUID()}`
        : `content_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    let pageInstanceSeq = 1;
    let pageInstanceHref = window.location.href;
    let pageInstanceId = buildPageInstanceId({
      contentInstanceId,
      sequence: pageInstanceSeq,
      href: pageInstanceHref,
    });
    function updatePageInstance(): void {
      if (window.location.href === pageInstanceHref) return;
      pageInstanceHref = window.location.href;
      pageInstanceSeq += 1;
      pageInstanceId = buildPageInstanceId({
        contentInstanceId,
        sequence: pageInstanceSeq,
        href: pageInstanceHref,
      });
    }

    let latestContext: PageContext | null = null;
    let observer: DomObserver | null = null;
    let collectionActive = false;

    const publishPageContext = (context: PageContext): void => {
      updatePageInstance();
      const sanitizedContext = sanitizePageContextForNetwork(context);
      latestContext = sanitizedContext;
      chrome.runtime.sendMessage(
        {
          type: 'PAGE_CONTEXT_UPDATED',
          context: sanitizedContext,
          contentInstanceId,
          pageInstanceId,
        },
        () => {
          if (chrome.runtime.lastError) {
            console.warn(
              `${LOG} PAGE_CONTEXT_UPDATED delivery failed:`,
              chrome.runtime.lastError.message,
            );
          }
        },
      );
    };

    function startPageContextCollection(): void {
      if (collectionActive) return;
      collectionActive = true;

      const initialContext = buildPageContext(document, window);
      publishPageContext(initialContext);

      observer = createDomObserver((ctx: PageContext) => {
        if (!collectionActive) return;
        publishPageContext(ctx);
      });
      observer.start();
    }

    function stopPageContextCollection(): void {
      collectionActive = false;
      observer?.stop();
      observer = null;
      latestContext = null;
    }

    async function getFreshLatestContext(): Promise<PageContext | null> {
      if (!collectionActive || !observer) return latestContext;

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
        if (!collectionActive || !observer) return;
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
      if (!isTrustedExtensionAuthCallbackRuntimeUrl(window.location.href)) {
        return;
      }
      chrome.runtime.sendMessage(
        {
          type: 'AUTH_CALLBACK',
          state: event.data.state,
          session: event.data.session,
          callbackUrl: window.location.href,
        },
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
              isActiveTarget?: boolean;
              canCollectPageContext?: boolean;
            }
          | undefined;

        const bootstrapState = deriveWidgetBootstrapState({
          extensionEnabled: resp?.enabled === true,
          sessionActive: resp?.active === true,
          isActiveTarget: resp?.isActiveTarget === true,
        });

        if (!bootstrapState.visible) {
          widget.hide();
          return;
        }

        widget.show();
        if (resp?.canCollectPageContext === true) {
          startPageContextCollection();
        }

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
      if (!context) return 'No page context available.';
      const sanitizedContext = sanitizePageContextForModel(context);
      return JSON.stringify({
        ...sanitizedContext,
        appSignature:
          sanitizedContext.appSignature ??
          `${sanitizedContext.app}:${sanitizedContext.screen}`,
        interactiveElements: sanitizedContext.interactiveElements,
      });
    }

    async function execSearchPageElements(args: {
      query?: string;
      limit?: number;
    }): Promise<string> {
      const context = await getFreshLatestContext();
      if (!context) {
        return JSON.stringify({
          query: typeof args.query === 'string' ? args.query : '',
          matches: [],
          matchCount: 0,
          truncated: false,
        } satisfies PageElementSearchResult);
      }
      const query = typeof args.query === 'string' ? args.query : '';
      const limit =
        typeof args.limit === 'number' && Number.isFinite(args.limit)
          ? Math.min(Math.max(Math.round(args.limit), 1), 20)
          : 12;
      const matches = searchPageElementsFromDom(
        query,
        context,
        document,
        limit,
      );
      const result: PageElementSearchResult = {
        query,
        matches,
        matchCount: matches.length,
        truncated: matches.length >= limit,
      };
      return JSON.stringify(result);
    }

    async function execInspectElement(args: {
      selector?: string;
    }): Promise<string> {
      const context = await getFreshLatestContext();
      if (!context) return JSON.stringify({ element: null });
      const selector = typeof args.selector === 'string' ? args.selector : '';
      const inspection = selector
        ? inspectElementFromDom(selector, context, document)
        : null;
      return JSON.stringify({ element: inspection });
    }

    async function execInspectPageRegion(args: {
      selector?: string;
      regionId?: string;
    }): Promise<string> {
      const context = await getFreshLatestContext();
      if (!context) {
        return JSON.stringify({ region: null, snippets: [], elements: [] });
      }
      const selector =
        typeof args.regionId === 'string'
          ? args.regionId
          : typeof args.selector === 'string'
            ? args.selector
            : '';
      const result: PageRegionInspectionResult = selector
        ? inspectPageRegionFromDom(selector, context, document)
        : { region: null, snippets: [], elements: [] };
      return JSON.stringify(result);
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
      const context = latestContext;
      if (!context) return 'target unavailable: page context unavailable';
      const previousFingerprint = buildContextSemanticFingerprint(context);
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
      const context = latestContext;
      if (!context) return 'target unavailable: page context unavailable';
      const previousFingerprint = buildContextSemanticFingerprint(context);
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
      const context = latestContext;
      if (!context) return 'target unavailable: page context unavailable';
      const previousFingerprint = buildContextSemanticFingerprint(context);
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

      const context = latestContext;
      if (!context) return 'target unavailable: page context unavailable';
      cancelOverlayClear();
      const previousFingerprint = buildContextSemanticFingerprint(context);
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

    function replyTool(
      callId: string,
      route: VoiceToolRouteMeta | null,
      result?: string,
      error?: string,
    ): void {
      chrome.runtime.sendMessage(
        {
          type: 'TOOL_RESULT',
          callId,
          result,
          error,
          bindingEpoch: route?.bindingEpoch ?? null,
          pageInstanceId,
          contentInstanceId,
        },
        () => {
          if (chrome.runtime.lastError) {
            console.warn(
              `${LOG} TOOL_RESULT delivery failed:`,
              chrome.runtime.lastError.message,
            );
          }
        },
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
          stopPageContextCollection();
        }
        sendResponse({ ok: true });
        return false;
      }
      if (msg?.type === 'PAGE_CONTEXT_COLLECTION_START') {
        startPageContextCollection();
        sendResponse({ ok: true });
        return false;
      }
      if (msg?.type === 'PAGE_CONTEXT_COLLECTION_STOP') {
        stopPageContextCollection();
        overlay.clear();
        sendResponse({ ok: true });
        return false;
      }
      if (msg?.type === 'GET_PAGE_CONTEXT') {
        void getFreshLatestContext().then((context) => {
          updatePageInstance();
          sendResponse({
            type: 'PAGE_CONTEXT_RESPONSE',
            payload: context ? sanitizePageContextForNetwork(context) : null,
            bindingEpoch:
              typeof msg.route?.bindingEpoch === 'number'
                ? msg.route.bindingEpoch
                : null,
            pageInstanceId,
            contentInstanceId,
          });
        });
        return true;
      }
      if (msg?.type === 'PAGE_CONTEXT_ENRICHED' && msg.context) {
        latestContext = sanitizePageContextForNetwork(
          msg.context as PageContext,
        );
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
        const { callId, name, args, route } = msg as {
          callId: string;
          name: string;
          args: Record<string, unknown>;
          route?: VoiceToolRouteMeta;
        };
        void (async () => {
          try {
            updatePageInstance();
            const routeMeta = route ?? null;
            if (
              routeMeta?.pageInstanceId &&
              routeMeta.pageInstanceId !== pageInstanceId
            ) {
              replyTool(
                callId,
                routeMeta,
                undefined,
                'Page changed before the tool could run',
              );
              return;
            }

            let result = '';
            switch (name) {
              case 'get_page_context':
                result = await execGetPageContext();
                break;
              case 'search_page_elements':
                result = await execSearchPageElements(
                  args as { query?: string; limit?: number },
                );
                break;
              case 'inspect_element':
                result = await execInspectElement(
                  args as { selector?: string },
                );
                break;
              case 'inspect_page_region':
                result = await execInspectPageRegion(
                  args as { selector?: string; regionId?: string },
                );
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
                replyTool(
                  callId,
                  routeMeta,
                  undefined,
                  `Unknown tool: ${name}`,
                );
                return;
            }
            updatePageInstance();
            replyTool(callId, routeMeta, result);
          } catch (err) {
            replyTool(callId, route ?? null, undefined, (err as Error).message);
          }
        })();
        sendResponse({ ok: true });
        return false;
      }

      return false;
    });
  },
});
