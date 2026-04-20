/**
 * dom-overlay.ts — Visual teaching layer for the Tribora Chrome extension.
 *
 * Injects a fixed-position overlay container into every page that can:
 * - Animate a cursor to any DOM element identified by CSS selector
 * - Draw a highlight ring around elements
 * - Pulse-animate a highlight ring for emphasis
 * - Handle scroll/resize by recalculating positions
 * - Gracefully no-op on missing or invisible elements
 *
 * TRIB-24 — Part of Phase 1: Chrome Extension + Voice Foundation (TRIB-17)
 */

import type { OverlayTarget } from '@tribora/shared';
import { TRIBORA_EXTENSION_THEME } from '../../utils/tribora-theme.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const OVERLAY_ID = 'tribora-overlay';
const CURSOR_ID = 'tribora-cursor';
const HIGHLIGHT_ID = 'tribora-highlight';
const LABEL_ID = 'tribora-label';
const MULTI_LAYER_ID = 'tribora-multi-layer';
const STYLE_ID = 'tribora-keyframes';

// Warm Amber accent used across the Tribora extension.
const ACCENT = '#f5be4d';
const ACCENT_RGBA = 'rgba(245, 190, 77, 0.24)';
const ACCENT_PULSE = 'rgba(245, 190, 77, 0.42)';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DomOverlay {
  /** Animate cursor to the element and optionally show a label */
  pointAt(selector: string, label?: string): void;
  /** Draw a static highlight ring around the element */
  highlight(selector: string): void;
  /** Draw a pulsing highlight ring around the element */
  pulse(selector: string): void;
  /** Draw multiple highlights at once, optionally with per-target labels */
  showTargets(targets: OverlayTarget[]): void;
  /** Hide cursor, highlight, and label */
  clear(): void;
  /** Remove the overlay from the DOM and clean up all event listeners */
  destroy(): void;
}

// ─── Internal state ───────────────────────────────────────────────────────────

type OverlayMode = 'cursor' | 'highlight' | 'pulse' | 'multi';

interface OverlayState {
  currentSelector: string | null;
  currentLabel: string | null;
  currentTargets: OverlayTarget[];
  rafHandle: number | null;
  mode: OverlayMode | null;
}

// ─── SVG cursor builder ───────────────────────────────────────────────────────

/**
 * Build an SVG cursor element using safe DOM methods (no innerHTML).
 * Returns a ready-to-append SVGSVGElement.
 */
function buildCursorSvg(): SVGSVGElement {
  const NS = 'http://www.w3.org/2000/svg';

  const svg = document.createElementNS(NS, 'svg') as SVGSVGElement;
  svg.setAttribute('width', '24');
  svg.setAttribute('height', '24');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.style.cssText =
    'filter: drop-shadow(0 2px 6px rgba(245,190,77,0.5)); display: block;';

  // Outer ring
  const outerCircle = document.createElementNS(NS, 'circle');
  outerCircle.setAttribute('cx', '12');
  outerCircle.setAttribute('cy', '12');
  outerCircle.setAttribute('r', '10');
  outerCircle.setAttribute('fill', ACCENT);
  outerCircle.setAttribute('opacity', '0.9');

  // Inner dot
  const innerCircle = document.createElementNS(NS, 'circle');
  innerCircle.setAttribute('cx', '12');
  innerCircle.setAttribute('cy', '12');
  innerCircle.setAttribute('r', '4');
  innerCircle.setAttribute('fill', 'white');
  innerCircle.setAttribute('opacity', '0.9');

  svg.appendChild(outerCircle);
  svg.appendChild(innerCircle);

  return svg;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create and inject the Tribora overlay into the current page.
 * Safe to call multiple times — returns a new instance each time but will
 * replace any existing overlay with the same ID.
 */
export function createDomOverlay(): DomOverlay {
  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches;

  // ── Inject keyframe styles (once per page) ──────────────────────────────────
  injectKeyframesIfNeeded();

  // ── Build the overlay container ─────────────────────────────────────────────
  // Remove any stale overlay from a previous call (e.g. extension hot-reload)
  document.getElementById(OVERLAY_ID)?.remove();

  const container = document.createElement('div');
  container.id = OVERLAY_ID;
  // Mark every tribora-owned element so we can distinguish our nodes from
  // host-page nodes that happen to share these IDs.
  container.setAttribute('data-tribora-owner', 'true');
  applyStyles(container, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100vw',
    height: '100vh',
    pointerEvents: 'none',
    zIndex: '2147483647',
    overflow: 'visible',
  });

  // ── Cursor element (24×24 SVG circle) ───────────────────────────────────────
  const cursor = document.createElement('div');
  cursor.id = CURSOR_ID;
  cursor.setAttribute('data-tribora-owner', 'true');
  applyStyles(cursor, {
    position: 'absolute',
    width: '24px',
    height: '24px',
    // Start off-screen
    transform: 'translate(-9999px, -9999px) translate(-50%, -50%)',
    transition: `transform ${TRIBORA_EXTENSION_THEME.motion.medium} ${TRIBORA_EXTENSION_THEME.motion.ease}`,
    display: 'none',
    pointerEvents: 'none',
  });

  cursor.appendChild(buildCursorSvg());

  // ── Label tooltip ────────────────────────────────────────────────────────────
  const labelEl = document.createElement('div');
  labelEl.id = LABEL_ID;
  labelEl.setAttribute('data-tribora-owner', 'true');
  applyStyles(labelEl, {
    position: 'absolute',
    display: 'none',
    background: 'rgba(24, 22, 18, 0.96)',
    border: `1px solid ${TRIBORA_EXTENSION_THEME.color.signalEdge}`,
    color: TRIBORA_EXTENSION_THEME.color.ink,
    fontSize: '11px',
    fontFamily: TRIBORA_EXTENSION_THEME.font.mono,
    fontWeight: '500',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    lineHeight: '1.4',
    padding: '4px 8px',
    borderRadius: '4px',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    boxShadow: '0 8px 22px rgba(0,0,0,0.34)',
  });

  // ── Highlight ring ───────────────────────────────────────────────────────────
  const highlight = document.createElement('div');
  highlight.id = HIGHLIGHT_ID;
  highlight.setAttribute('data-tribora-owner', 'true');
  applyStyles(highlight, {
    position: 'absolute',
    display: 'none',
    border: `2px solid ${ACCENT}`,
    borderRadius: '4px',
    boxShadow: `0 0 0 4px ${ACCENT_RGBA}`,
    pointerEvents: 'none',
    transition: `all ${TRIBORA_EXTENSION_THEME.motion.fast} ${TRIBORA_EXTENSION_THEME.motion.ease}`,
  });

  container.appendChild(highlight);
  container.appendChild(cursor);
  container.appendChild(labelEl);

  const multiLayer = document.createElement('div');
  multiLayer.id = MULTI_LAYER_ID;
  multiLayer.setAttribute('data-tribora-owner', 'true');
  applyStyles(multiLayer, {
    position: 'absolute',
    inset: '0',
    pointerEvents: 'none',
  });
  container.appendChild(multiLayer);

  // Attach to document root (not body — more resistant to page CSS resets)
  document.documentElement.appendChild(container);

  // ── Module-scoped state ──────────────────────────────────────────────────────
  const state: OverlayState = {
    currentSelector: null,
    currentLabel: null,
    currentTargets: [],
    rafHandle: null,
    mode: null,
  };

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function getTargetRect(selector: string): DOMRect | null {
    let el: Element | null = null;

    try {
      el = document.querySelector(selector);
    } catch {
      // Invalid selector — no-op
      console.warn('[Tribora] Invalid CSS selector:', selector);
      return null;
    }

    if (!el) {
      // Element not found — no-op
      return null;
    }

    // Reject elements that are effectively invisible. getBoundingClientRect()
    // can return a non-zero rect for display:block elements whose parents set
    // visibility:hidden or opacity:0, and single-axis-zero rects are common
    // for flex-column collapsed items. Any of these should no-op the overlay.
    if (el instanceof HTMLElement || el instanceof SVGElement) {
      const computed = window.getComputedStyle(el);
      if (
        computed.visibility === 'hidden' ||
        computed.display === 'none' ||
        computed.opacity === '0'
      ) {
        return null;
      }
    }

    const rect = el.getBoundingClientRect();

    if (rect.width === 0 || rect.height === 0) {
      // Element exists but has zero bounding area on at least one axis —
      // treat as hidden/detached rather than drawing a zero-width ring.
      return null;
    }

    return rect;
  }

  function positionCursor(rect: DOMRect, labelText?: string): void {
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    applyStyles(cursor, {
      display: 'block',
      transform: `translate(${cx}px, ${cy}px) translate(-50%, -50%)`,
    });

    if (labelText) {
      // Use textContent (never innerHTML) to prevent XSS
      labelEl.textContent = labelText;
      applyStyles(labelEl, {
        display: 'block',
        transform: `translate(${cx + 12}px, ${cy - 36}px)`,
      });
    } else {
      applyStyles(labelEl, { display: 'none' });
    }
  }

  function positionHighlight(rect: DOMRect): void {
    const PADDING = 4; // px gap between element edge and ring
    applyStyles(highlight, {
      display: 'block',
      left: `${rect.left - PADDING}px`,
      top: `${rect.top - PADDING}px`,
      width: `${rect.width + PADDING * 2}px`,
      height: `${rect.height + PADDING * 2}px`,
    });
  }

  function clearMultiLayer(): void {
    multiLayer.replaceChildren();
  }

  function renderTargets(targets: OverlayTarget[]): void {
    clearMultiLayer();

    for (const target of targets) {
      const rect = getTargetRect(target.selector);
      if (!rect) continue;

      const ring = document.createElement('div');
      ring.setAttribute('data-tribora-multi-highlight', 'true');
      ring.setAttribute('data-tribora-owner', 'true');
      applyStyles(ring, {
        position: 'absolute',
        left: `${rect.left - 4}px`,
        top: `${rect.top - 4}px`,
        width: `${rect.width + 8}px`,
        height: `${rect.height + 8}px`,
        border: `2px solid ${ACCENT}`,
        borderRadius: '4px',
        boxShadow:
          target.action === 'pulse'
            ? `0 0 0 0 ${ACCENT_PULSE}`
            : `0 0 0 4px ${ACCENT_RGBA}`,
        animation:
          target.action === 'pulse' && !prefersReducedMotion
            ? 'tribora-pulse 1s cubic-bezier(0, 0, 0.2, 1) infinite'
            : 'none',
      });
      multiLayer.appendChild(ring);

      if (target.label) {
        const label = document.createElement('div');
        label.setAttribute('data-tribora-multi-label', 'true');
        label.setAttribute('data-tribora-owner', 'true');
        label.textContent = target.label;
        applyStyles(label, {
          position: 'absolute',
          left: `${rect.left + 8}px`,
          top: `${Math.max(0, rect.top - 28)}px`,
          background: 'rgba(24, 22, 18, 0.96)',
          border: `1px solid ${TRIBORA_EXTENSION_THEME.color.signalEdge}`,
          color: TRIBORA_EXTENSION_THEME.color.ink,
          fontSize: '11px',
          fontFamily: TRIBORA_EXTENSION_THEME.font.mono,
          fontWeight: '500',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          lineHeight: '1.4',
          padding: '4px 8px',
          borderRadius: '4px',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          boxShadow: '0 8px 22px rgba(0,0,0,0.34)',
        });
        multiLayer.appendChild(label);
      }
    }
  }

  function recalculate(): void {
    if (!state.currentSelector || !state.mode) return;

    if (state.mode === 'multi') {
      renderTargets(state.currentTargets);
      return;
    }

    const rect = getTargetRect(state.currentSelector);
    if (!rect) return;

    // Preserve whatever mode the overlay was in when scroll/resize fires.
    // Previously this unconditionally called positionCursor(), which re-set
    // display:block on the cursor and overwrote the pulse animation on the
    // highlight ring — making the first scroll effectively flip highlight /
    // pulse back into cursor mode.
    if (state.mode === 'cursor') {
      positionCursor(rect, state.currentLabel ?? undefined);
      positionHighlight(rect);
      return;
    }

    // highlight and pulse modes: keep the cursor hidden and just reposition
    // the highlight ring. The animation styles on the highlight element are
    // left untouched so pulse continues to animate across scrolls.
    positionHighlight(rect);
  }

  // Debounced recalculation via requestAnimationFrame
  function scheduleRecalculate(): void {
    if (state.rafHandle !== null) return; // already scheduled
    state.rafHandle = requestAnimationFrame(() => {
      state.rafHandle = null;
      recalculate();
    });
  }

  // ── Event listeners ──────────────────────────────────────────────────────────

  window.addEventListener('scroll', scheduleRecalculate, {
    passive: true,
    capture: true,
  });
  window.addEventListener('resize', scheduleRecalculate, { passive: true });

  // ── Public API ───────────────────────────────────────────────────────────────

  function pointAt(selector: string, labelText?: string): void {
    const rect = getTargetRect(selector);
    if (!rect) return; // graceful no-op

    state.currentSelector = selector;
    state.currentLabel = labelText ?? null;
    state.currentTargets = [];
    state.mode = 'cursor';

    clearMultiLayer();

    positionCursor(rect, labelText);

    // Show a static highlight ring (no pulse)
    applyStyles(highlight, {
      animation: 'none',
      boxShadow: `0 0 0 4px ${ACCENT_RGBA}`,
    });
    positionHighlight(rect);
  }

  function highlightEl(selector: string): void {
    const rect = getTargetRect(selector);
    if (!rect) return;

    state.currentSelector = selector;
    state.currentLabel = null;
    state.currentTargets = [];
    state.mode = 'highlight';

    clearMultiLayer();
    applyStyles(cursor, { display: 'none' });
    applyStyles(labelEl, { display: 'none' });

    applyStyles(highlight, {
      animation: 'none',
      boxShadow: `0 0 0 4px ${ACCENT_RGBA}`,
    });
    positionHighlight(rect);
  }

  function pulseEl(selector: string): void {
    const rect = getTargetRect(selector);
    if (!rect) return;

    state.currentSelector = selector;
    state.currentLabel = null;
    state.currentTargets = [];
    state.mode = 'pulse';

    clearMultiLayer();
    applyStyles(cursor, { display: 'none' });
    applyStyles(labelEl, { display: 'none' });

    applyStyles(highlight, {
      animation: prefersReducedMotion
        ? 'none'
        : 'tribora-pulse 1s cubic-bezier(0, 0, 0.2, 1) infinite',
      boxShadow: `0 0 0 0 ${ACCENT_PULSE}`,
    });
    positionHighlight(rect);
  }

  function showTargets(targets: OverlayTarget[]): void {
    const deduped = targets.filter(
      (target, index, items) =>
        !!target?.selector &&
        items.findIndex((item) => item.selector === target.selector) === index,
    );
    if (deduped.length === 0) return;

    state.currentSelector = deduped[0]?.selector ?? null;
    state.currentLabel = null;
    state.currentTargets = deduped;
    state.mode = 'multi';

    applyStyles(cursor, { display: 'none' });
    applyStyles(labelEl, { display: 'none' });
    applyStyles(highlight, { display: 'none', animation: 'none' });

    renderTargets(deduped);
  }

  function clear(): void {
    state.currentSelector = null;
    state.currentLabel = null;
    state.currentTargets = [];
    state.mode = null;

    if (state.rafHandle !== null) {
      cancelAnimationFrame(state.rafHandle);
      state.rafHandle = null;
    }

    applyStyles(cursor, {
      display: 'none',
      transform: 'translate(-9999px, -9999px) translate(-50%, -50%)',
    });
    applyStyles(highlight, { display: 'none', animation: 'none' });
    applyStyles(labelEl, { display: 'none' });
    clearMultiLayer();
  }

  function destroy(): void {
    clear();
    window.removeEventListener('scroll', scheduleRecalculate, {
      capture: true,
    });
    window.removeEventListener('resize', scheduleRecalculate);
    container.remove();
  }

  return {
    pointAt,
    highlight: highlightEl,
    pulse: pulseEl,
    showTargets,
    clear,
    destroy,
  };
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/** Apply multiple inline styles to an element */
function applyStyles(
  el: HTMLElement,
  styles: Partial<CSSStyleDeclaration>,
): void {
  Object.assign(el.style, styles);
}

/**
 * Inject the @keyframes rule for the pulse animation into a <style> tag.
 * Only injected once per page load.
 */
function injectKeyframesIfNeeded(): void {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  // Use textContent (never innerHTML) to set stylesheet text
  style.textContent = [
    '@keyframes tribora-pulse {',
    `  0%   { box-shadow: 0 0 0 0 ${ACCENT_PULSE}; }`,
    '  70%  { box-shadow: 0 0 0 12px rgba(245,190,77,0); }',
    '  100% { box-shadow: 0 0 0 0 rgba(245,190,77,0); }',
    '}',
  ].join('\n');

  // Append to <head> if available, otherwise to <html>
  (document.head ?? document.documentElement).appendChild(style);
}
