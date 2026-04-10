/**
 * dom-observer.ts — SPA navigation detection via MutationObserver + history events.
 *
 * Hardened for complex SPA environments (TRIB-51):
 * - Shadow DOM piercing (open roots only; closed roots are inaccessible to content scripts)
 * - Same-origin iframe observation
 * - requestIdleCallback for non-blocking rescans
 * - document.body null-safety with deferred start
 * - Overlay mutation filtering to prevent infinite loops with TRIB-24's DOM overlay
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

// ---------------------------------------------------------------------------
// Shadow DOM helpers
// ---------------------------------------------------------------------------

/**
 * Recursively walk open shadow roots and collect them for observation.
 * Salesforce Lightning and similar frameworks heavily use Shadow DOM.
 *
 * NOTE: Only OPEN shadow roots are accessible from content scripts.
 * Closed shadow roots are intentionally hidden — this is by design.
 */
export function findShadowRoots(root: Node): ShadowRoot[] {
  const roots: ShadowRoot[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let node: Node | null = walker.currentNode;
  while (node) {
    if (node instanceof Element && node.shadowRoot) {
      roots.push(node.shadowRoot);
      roots.push(...findShadowRoots(node.shadowRoot));
    }
    node = walker.nextNode();
  }
  return roots;
}

// ---------------------------------------------------------------------------
// Same-origin iframe helpers
// ---------------------------------------------------------------------------

/**
 * Find all same-origin iframes within a root document or shadow root.
 * Cross-origin iframes throw on `contentDocument` access — we filter those out.
 */
export function findSameOriginIframes(
  root: Document | ShadowRoot,
): HTMLIFrameElement[] {
  const iframes = Array.from(
    root.querySelectorAll("iframe"),
  ) as HTMLIFrameElement[];
  return iframes.filter((iframe) => {
    try {
      // Accessing contentDocument throws a SecurityError for cross-origin frames
      return iframe.contentDocument !== null;
    } catch {
      return false;
    }
  });
}

// ---------------------------------------------------------------------------
// Overlay mutation filter (TRIB-24 coordination)
// ---------------------------------------------------------------------------

/**
 * Returns true if ALL mutations in the batch are targeting the Tribora overlay
 * element or its descendants. When this is the case we skip the rescan to
 * avoid an infinite feedback loop:
 *   observer fires → rescan → overlay updates → observer fires → ...
 */
function isOverlayOnlyMutation(mutations: MutationRecord[]): boolean {
  for (const mutation of mutations) {
    const target = mutation.target;
    if (target.nodeType === Node.ELEMENT_NODE) {
      const el = target as Element;
      if (el.id === "tribora-overlay" || el.closest?.("#tribora-overlay")) {
        // This mutation is inside the overlay — keep checking others
        continue;
      }
      // Found at least one mutation NOT in the overlay
      return false;
    }
    // Non-element nodes (e.g. text nodes) — treat as non-overlay
    return false;
  }
  // Every mutation was overlay-related (or the list was empty)
  return true;
}

// ---------------------------------------------------------------------------
// Idle-callback scheduler
// ---------------------------------------------------------------------------

/**
 * Schedule a callback using requestIdleCallback when available, falling back
 * to setTimeout(fn, 0) to avoid blocking the main thread.
 */
function scheduleIdle(fn: () => void): void {
  if (typeof requestIdleCallback !== "undefined") {
    requestIdleCallback(fn);
  } else {
    setTimeout(fn, 0);
  }
}

// ---------------------------------------------------------------------------
// createDomObserver
// ---------------------------------------------------------------------------

/**
 * Create an observer that calls `onNavigate` with fresh PageContext whenever
 * the user navigates within a SPA.
 *
 * Call `.start()` to activate and `.stop()` to tear down.
 *
 * The exported API (function signature + DomObserver return shape) is stable
 * and must not be changed — index.ts depends on it.
 */
export function createDomObserver(
  onNavigate: (ctx: PageContext) => void,
  options: DomObserverOptions = {},
): DomObserver {
  const debounceMs = options.debounceMs ?? 250;

  let lastUrl = window.location.href;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let mutationObserver: MutationObserver | null = null;

  /** Tracks shadow roots already being observed to avoid double-observation. */
  const observedShadowRoots = new WeakSet<ShadowRoot>();

  /** Tracks iframes already being observed. */
  const observedIframes = new WeakSet<HTMLIFrameElement>();

  // -------------------------------------------------------------------------
  // Observer config (reused for body, shadow roots, and iframe bodies)
  // -------------------------------------------------------------------------
  const observerOptions: MutationObserverInit = {
    subtree: true,
    childList: true,
  };

  // -------------------------------------------------------------------------
  // Debounced scan trigger
  // -------------------------------------------------------------------------
  function scheduleRescan() {
    if (debounceTimer !== null) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      scheduleIdle(() => {
        const ctx = buildPageContext(document, window);
        onNavigate(ctx);
        // After every rescan, pick up any new shadow roots or iframes
        // that may have been rendered since we last looked.
        observeNewShadowRoots();
        observeNewIframes();
      });
    }, debounceMs);
  }

  // -------------------------------------------------------------------------
  // Shadow root observation
  // -------------------------------------------------------------------------
  function observeNewShadowRoots() {
    if (!mutationObserver || !document.body) return;
    const roots = findShadowRoots(document.body);
    for (const root of roots) {
      if (!observedShadowRoots.has(root)) {
        observedShadowRoots.add(root);
        mutationObserver.observe(root, observerOptions);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Same-origin iframe observation
  // -------------------------------------------------------------------------
  function observeNewIframes() {
    if (!mutationObserver || !document.body) return;
    const iframes = findSameOriginIframes(document);
    for (const iframe of iframes) {
      if (!observedIframes.has(iframe) && iframe.contentDocument?.body) {
        observedIframes.add(iframe);
        mutationObserver.observe(iframe.contentDocument.body, observerOptions);
      }
    }
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

  function onWindowLoad() {
    // Catch initial hash state that may already be set when the page loads
    checkUrlChange();
  }

  // -------------------------------------------------------------------------
  // MutationObserver callback
  // -------------------------------------------------------------------------
  function onMutation(mutations: MutationRecord[]) {
    // Skip mutations that are entirely within the Tribora overlay element to
    // prevent an infinite feedback loop once TRIB-24's DOM overlay is merged.
    if (isOverlayOnlyMutation(mutations)) return;

    // Always check URL first — some SPAs mutate the DOM before firing events
    checkUrlChange();

    // Eagerly pick up any new shadow roots added in this mutation batch.
    // We do this immediately (not debounced) so the observer is attached
    // before the next mutation fires inside the new shadow tree.
    if (mutationObserver) {
      for (const mutation of mutations) {
        for (const node of Array.from(mutation.addedNodes)) {
          if (node instanceof Element) {
            const newRoots = findShadowRoots(node);
            for (const root of newRoots) {
              if (!observedShadowRoots.has(root)) {
                observedShadowRoots.add(root);
                mutationObserver.observe(root, observerOptions);
              }
            }
          }
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /**
   * Begin observing. Deferred safely if document.body is not yet available
   * (content scripts that run at document_start may call start() too early).
   */
  function startObserving() {
    if (!document.body) {
      // document.body isn't available yet — wait for it
      new MutationObserver((_mutations, obs) => {
        if (document.body) {
          obs.disconnect();
          startObserving();
        }
      }).observe(document.documentElement, { childList: true });
      return;
    }

    mutationObserver = new MutationObserver(onMutation);
    mutationObserver.observe(document.body, observerOptions);

    // Observe any shadow roots already present in the initial DOM
    observeNewShadowRoots();

    // Observe any same-origin iframes already present in the initial DOM
    observeNewIframes();
  }

  function start() {
    lastUrl = window.location.href;

    window.addEventListener("popstate", onPopstate);
    window.addEventListener("hashchange", onHashchange);
    window.addEventListener("load", onWindowLoad);

    startObserving();
  }

  function stop() {
    window.removeEventListener("popstate", onPopstate);
    window.removeEventListener("hashchange", onHashchange);
    window.removeEventListener("load", onWindowLoad);

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
