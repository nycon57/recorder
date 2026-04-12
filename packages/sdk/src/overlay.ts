/**
 * overlay.ts — DOM overlay for the Tribora SDK.
 *
 * Ported from the Chrome extension's dom-overlay.ts (TRIB-24).
 * Highlights, points at, and pulses elements on the host page
 * identified by CSS selectors returned from the query API.
 *
 * Unlike the extension version, this injects directly into the
 * host page DOM (not inside Shadow DOM) since the overlay needs
 * to visually sit on top of host-page elements.
 */

// ─── Constants ──────────────────────────────────────────────────────────────

const OVERLAY_ID = 'tribora-sdk-overlay';
const CURSOR_ID = 'tribora-sdk-cursor';
const HIGHLIGHT_ID = 'tribora-sdk-highlight';
const LABEL_ID = 'tribora-sdk-label';
const STYLE_ID = 'tribora-sdk-keyframes';

const ACCENT = '#6366f1';
const ACCENT_RGBA = 'rgba(99, 102, 241, 0.2)';
const ACCENT_PULSE = 'rgba(99, 102, 241, 0.4)';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SdkOverlay {
  pointAt(selector: string, label?: string): void;
  highlight(selector: string): void;
  pulse(selector: string): void;
  clear(): void;
  destroy(): void;
  /** Update accent color for vendor branding */
  setAccentColor(color: string): void;
}

type OverlayMode = 'cursor' | 'highlight' | 'pulse';

interface OverlayState {
  currentSelector: string | null;
  currentLabel: string | null;
  rafHandle: number | null;
  mode: OverlayMode | null;
  accentColor: string;
}

// ─── SVG cursor builder ─────────────────────────────────────────────────────

function buildCursorSvg(color: string): SVGSVGElement {
  const NS = 'http://www.w3.org/2000/svg';

  const svg = document.createElementNS(NS, 'svg') as SVGSVGElement;
  svg.setAttribute('width', '24');
  svg.setAttribute('height', '24');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.style.cssText = `filter: drop-shadow(0 2px 6px ${color}80); display: block;`;

  const outerCircle = document.createElementNS(NS, 'circle');
  outerCircle.setAttribute('cx', '12');
  outerCircle.setAttribute('cy', '12');
  outerCircle.setAttribute('r', '10');
  outerCircle.setAttribute('fill', color);
  outerCircle.setAttribute('opacity', '0.9');

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

// ─── Factory ────────────────────────────────────────────────────────────────

export function createSdkOverlay(accentColor?: string): SdkOverlay {
  const initialAccent = accentColor ?? ACCENT;
  injectKeyframesIfNeeded(initialAccent);

  // Remove stale overlay
  document.getElementById(OVERLAY_ID)?.remove();

  const container = document.createElement('div');
  container.id = OVERLAY_ID;
  container.setAttribute('data-tribora-sdk', 'true');
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

  const cursor = document.createElement('div');
  cursor.id = CURSOR_ID;
  cursor.setAttribute('data-tribora-sdk', 'true');
  applyStyles(cursor, {
    position: 'absolute',
    width: '24px',
    height: '24px',
    transform: 'translate(-9999px, -9999px) translate(-50%, -50%)',
    transition: 'transform 350ms cubic-bezier(0.22, 1, 0.36, 1)',
    display: 'none',
    pointerEvents: 'none',
  });
  cursor.appendChild(buildCursorSvg(initialAccent));

  const labelEl = document.createElement('div');
  labelEl.id = LABEL_ID;
  labelEl.setAttribute('data-tribora-sdk', 'true');
  applyStyles(labelEl, {
    position: 'absolute',
    display: 'none',
    background: initialAccent,
    color: 'white',
    fontSize: '12px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontWeight: '500',
    lineHeight: '1.4',
    padding: '3px 8px',
    borderRadius: '4px',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
  });

  const highlight = document.createElement('div');
  highlight.id = HIGHLIGHT_ID;
  highlight.setAttribute('data-tribora-sdk', 'true');
  applyStyles(highlight, {
    position: 'absolute',
    display: 'none',
    border: `2px solid ${initialAccent}`,
    borderRadius: '6px',
    boxShadow: `0 0 0 4px ${ACCENT_RGBA}`,
    pointerEvents: 'none',
    transition: 'all 200ms cubic-bezier(0.22, 1, 0.36, 1)',
  });

  container.appendChild(highlight);
  container.appendChild(cursor);
  container.appendChild(labelEl);
  document.documentElement.appendChild(container);

  const state: OverlayState = {
    currentSelector: null,
    currentLabel: null,
    rafHandle: null,
    mode: null,
    accentColor: initialAccent,
  };

  // ── Helpers ────────────────────────────────────────────────────────────

  function getTargetRect(selector: string): DOMRect | null {
    let el: Element | null = null;
    try {
      el = document.querySelector(selector);
    } catch {
      return null;
    }
    if (!el) return null;

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
    if (rect.width === 0 || rect.height === 0) return null;
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
    const PADDING = 4;
    applyStyles(highlight, {
      display: 'block',
      left: `${rect.left - PADDING}px`,
      top: `${rect.top - PADDING}px`,
      width: `${rect.width + PADDING * 2}px`,
      height: `${rect.height + PADDING * 2}px`,
    });
  }

  function recalculate(): void {
    if (!state.currentSelector || !state.mode) return;
    const rect = getTargetRect(state.currentSelector);
    if (!rect) return;

    if (state.mode === 'cursor') {
      positionCursor(rect, state.currentLabel ?? undefined);
      positionHighlight(rect);
      return;
    }
    positionHighlight(rect);
  }

  function scheduleRecalculate(): void {
    if (state.rafHandle !== null) return;
    state.rafHandle = requestAnimationFrame(() => {
      state.rafHandle = null;
      recalculate();
    });
  }

  window.addEventListener('scroll', scheduleRecalculate, {
    passive: true,
    capture: true,
  });
  window.addEventListener('resize', scheduleRecalculate, { passive: true });

  // ── Public API ─────────────────────────────────────────────────────────

  function pointAt(selector: string, labelText?: string): void {
    const rect = getTargetRect(selector);
    if (!rect) return;

    state.currentSelector = selector;
    state.currentLabel = labelText ?? null;
    state.mode = 'cursor';

    positionCursor(rect, labelText);
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
    state.mode = 'highlight';

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
    state.mode = 'pulse';

    applyStyles(cursor, { display: 'none' });
    applyStyles(labelEl, { display: 'none' });
    applyStyles(highlight, {
      animation: 'tribora-sdk-pulse 1s cubic-bezier(0, 0, 0.2, 1) infinite',
      boxShadow: `0 0 0 0 ${ACCENT_PULSE}`,
    });
    positionHighlight(rect);
  }

  function clear(): void {
    state.currentSelector = null;
    state.currentLabel = null;
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
  }

  function destroy(): void {
    clear();
    window.removeEventListener('scroll', scheduleRecalculate, {
      capture: true,
    });
    window.removeEventListener('resize', scheduleRecalculate);
    container.remove();
  }

  function setAccentColor(color: string): void {
    state.accentColor = color;
    labelEl.style.background = color;
    highlight.style.borderColor = color;
    // Re-inject keyframes with new color
    const existingStyle = document.getElementById(STYLE_ID);
    if (existingStyle) existingStyle.remove();
    injectKeyframesIfNeeded(color);
    // Rebuild cursor SVG using safe DOM methods
    while (cursor.firstChild) {
      cursor.removeChild(cursor.firstChild);
    }
    cursor.appendChild(buildCursorSvg(color));
  }

  return {
    pointAt,
    highlight: highlightEl,
    pulse: pulseEl,
    clear,
    destroy,
    setAccentColor,
  };
}

// ─── Utilities ──────────────────────────────────────────────────────────────

function applyStyles(
  el: HTMLElement,
  styles: Partial<CSSStyleDeclaration>,
): void {
  Object.assign(el.style, styles);
}

function injectKeyframesIfNeeded(color: string): void {
  if (document.getElementById(STYLE_ID)) return;

  const pulseRgba = hexToRgba(color, 0.4);
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = [
    '@keyframes tribora-sdk-pulse {',
    `  0%   { box-shadow: 0 0 0 0 ${pulseRgba}; }`,
    `  70%  { box-shadow: 0 0 0 12px ${hexToRgba(color, 0)}; }`,
    `  100% { box-shadow: 0 0 0 0 ${hexToRgba(color, 0)}; }`,
    '}',
  ].join('\n');

  (document.head ?? document.documentElement).appendChild(style);
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;

  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);

  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    return `rgba(99, 102, 241, ${alpha})`;
  }

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
