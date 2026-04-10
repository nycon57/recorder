/**
 * dom-observer.ts — SPA navigation detection via MutationObserver + history events.
 *
 * Debounces navigation events to avoid re-scanning on every micro-mutation.
 * Detects URL changes that don't fire a history event (some SPAs use replaceState
 * without triggering popstate).
 */

import type { PageContext } from "@tribora/shared";
import { buildPageContext } from "./context-engine";

export interface DomObserverOptions {
  /** How long to wait after the last change before re-scanning (ms). Default: 250 */
  debounceMs?: number;
}

export interface DomObserver {
  start: () => void;
  stop: () => void;
}

/**
 * Create an observer that calls `onNavigate` with fresh PageContext whenever
 * the user navigates within a SPA.
 *
 * Call `.start()` to activate and `.stop()` to tear down.
 */
export function createDomObserver(
  onNavigate: (ctx: PageContext) => void,
  options: DomObserverOptions = {},
): DomObserver {
  const debounceMs = options.debounceMs ?? 250;

  let lastUrl = window.location.href;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let mutationObserver: MutationObserver | null = null;

  // -------------------------------------------------------------------------
  // Debounced scan trigger
  // -------------------------------------------------------------------------
  function scheduleRescan() {
    if (debounceTimer !== null) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      const ctx = buildPageContext(document, window);
      onNavigate(ctx);
    }, debounceMs);
  }

  // -------------------------------------------------------------------------
  // URL-change detection (catches replaceState / pushState without events)
  // -------------------------------------------------------------------------
  function checkUrlChange() {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      scheduleRescan();
    }
  }

  // -------------------------------------------------------------------------
  // Event listeners
  // -------------------------------------------------------------------------
  function onPopstate() {
    checkUrlChange();
    scheduleRescan();
  }

  function onHashchange() {
    checkUrlChange();
    scheduleRescan();
  }

  // -------------------------------------------------------------------------
  // MutationObserver callback
  // -------------------------------------------------------------------------
  function onMutation() {
    // Always check URL first — some SPAs mutate the DOM before firing events
    checkUrlChange();
    // Only debounce-scan if the URL changed; otherwise the mutation may be
    // cosmetic (tooltip, dropdown, etc.) and we don't want to spam re-scans.
    // We do still want to re-scan on URL changes detected via DOM mutations.
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------
  function start() {
    lastUrl = window.location.href;

    window.addEventListener("popstate", onPopstate);
    window.addEventListener("hashchange", onHashchange);

    mutationObserver = new MutationObserver(onMutation);
    mutationObserver.observe(document.body, {
      subtree: true,
      childList: true,
    });
  }

  function stop() {
    window.removeEventListener("popstate", onPopstate);
    window.removeEventListener("hashchange", onHashchange);

    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = null;
    }
  }

  return { start, stop };
}
