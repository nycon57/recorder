/**
 * widget.ts — Floating AI assistant widget for the Tribora Chrome extension.
 *
 * Pure DOM, no frameworks. Renders bottom-right; state driven by the content
 * script based on SESSION_EVENT messages from the offscreen document.
 */

/* global HTMLCanvasElement, CSSStyleDeclaration */

import { TRIBORA_EXTENSION_THEME } from '../../utils/tribora-theme.js';

const WIDGET_ID = 'tribora-widget';
const WIDGET_CANVAS_ID = 'tribora-widget-canvas';
const WIDGET_STYLE_ID = 'tribora-widget-styles';

const COLOR_SIGNAL = '#f5be4d';
const COLOR_LIVE = '#45e7a0';
const COLOR_SIGNAL_GLOW = 'rgba(245, 190, 77, 0.42)';
const COLOR_LIVE_GLOW = 'rgba(69, 231, 160, 0.4)';
const PILL_SHADOW_BASE =
  '0 12px 30px rgba(0,0,0,0.42), 0 0 0 1px rgba(255,255,255,0.06)';
const PILL_BG = 'rgba(24, 22, 18, 0.94)';

const BAR_COUNT = 5;
const BAR_PROFILE = [0.4, 0.7, 1.0, 0.7, 0.4];
const BAR_WIDTH = 3;
const BAR_GAP = 2;
const BAR_MIN_HEIGHT = 4;
const BAR_MAX_HEIGHT = 20;

type WidgetState =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'hidden';

export interface WidgetCallbacks {
  onStartClick?: () => void;
  onStopClick?: () => void;
}

export interface AssistantWidget {
  show(): void;
  hide(): void;
  setIdle(): void;
  setConnecting(): void;
  setListening(): void;
  setThinking(): void;
  setSpeaking(): void;
  getState(): WidgetState;
  isVisible(): boolean;
  destroy(): void;
}

export function createWidget(callbacks: WidgetCallbacks = {}): AssistantWidget {
  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches;

  injectWidgetStyles();
  document.getElementById(WIDGET_ID)?.remove();

  const container = document.createElement('div');
  container.id = WIDGET_ID;
  container.setAttribute('data-tribora-owner', 'true');
  apply(container, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    zIndex: '2147483647',
    pointerEvents: 'none',
    display: 'none',
    alignItems: 'center',
    gap: '8px',
    transition: `all ${TRIBORA_EXTENSION_THEME.motion.medium} ${TRIBORA_EXTENSION_THEME.motion.ease}`,
  });

  const pill = document.createElement('button');
  pill.type = 'button';
  pill.setAttribute('aria-label', 'Start Tribora voice session');
  pill.setAttribute('aria-pressed', 'false');
  pill.setAttribute('title', 'Start Tribora voice session');
  apply(pill, {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '9px 13px',
    borderRadius: '24px',
    background: PILL_BG,
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: `1px solid ${TRIBORA_EXTENSION_THEME.color.line}`,
    boxShadow: PILL_SHADOW_BASE,
    transition: `all ${TRIBORA_EXTENSION_THEME.motion.medium} ${TRIBORA_EXTENSION_THEME.motion.ease}`,
    pointerEvents: 'auto',
    cursor: 'pointer',
    appearance: 'none',
    WebkitAppearance: 'none',
    color: 'inherit',
    font: 'inherit',
  });

  pill.addEventListener('click', () => {
    if (currentState === 'idle') {
      callbacks.onStartClick?.();
    }
  });

  const orb = document.createElement('div');
  apply(orb, {
    width: '28px',
    height: '28px',
    borderRadius: '8px',
    background: `linear-gradient(150deg, ${COLOR_SIGNAL} 0%, #c18b2f 100%)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    fontWeight: '700',
    fontFamily: TRIBORA_EXTENSION_THEME.font.display,
    color: TRIBORA_EXTENSION_THEME.color.signalInk,
    flexShrink: '0',
    letterSpacing: '0',
    transition: `all ${TRIBORA_EXTENSION_THEME.motion.medium} ${TRIBORA_EXTENSION_THEME.motion.ease}`,
    boxShadow: `0 0 14px ${COLOR_SIGNAL_GLOW}`,
  });
  orb.textContent = 'T';

  const hotkeyHint = document.createElement('span');
  apply(hotkeyHint, {
    fontSize: '12px',
    fontFamily: TRIBORA_EXTENSION_THEME.font.body,
    fontWeight: '600',
    color: TRIBORA_EXTENSION_THEME.color.inkMuted,
    whiteSpace: 'nowrap',
    letterSpacing: '0',
  });
  hotkeyHint.textContent = 'Talk with Tribora';

  const canvas = document.createElement('canvas');
  canvas.id = WIDGET_CANVAS_ID;
  const totalWidth = BAR_COUNT * BAR_WIDTH + (BAR_COUNT - 1) * BAR_GAP;
  canvas.width = totalWidth * 2;
  canvas.height = BAR_MAX_HEIGHT * 2;
  apply(canvas, {
    width: `${totalWidth}px`,
    height: `${BAR_MAX_HEIGHT}px`,
    display: 'none',
    flexShrink: '0',
  });

  const label = document.createElement('span');
  apply(label, {
    fontSize: '12px',
    fontFamily: TRIBORA_EXTENSION_THEME.font.mono,
    fontWeight: '500',
    color: TRIBORA_EXTENSION_THEME.color.inkDim,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    whiteSpace: 'nowrap',
    display: 'none',
    transition: `opacity ${TRIBORA_EXTENSION_THEME.motion.fast} ${TRIBORA_EXTENSION_THEME.motion.ease}`,
  });

  const spinner = document.createElement('div');
  apply(spinner, {
    width: '16px',
    height: '16px',
    border: `2px solid ${TRIBORA_EXTENSION_THEME.color.line}`,
    borderTopColor: COLOR_SIGNAL,
    borderRadius: '50%',
    animation: prefersReducedMotion
      ? 'none'
      : 'tribora-widget-spin 0.7s linear infinite',
    display: 'none',
    flexShrink: '0',
  });

  const stopBtn = document.createElement('button');
  apply(stopBtn, {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    background: 'rgba(245, 190, 77, 0.12)',
    border: `1px solid ${TRIBORA_EXTENSION_THEME.color.signalEdge}`,
    cursor: 'pointer',
    display: 'none',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0',
    flexShrink: '0',
    pointerEvents: 'auto',
    transition: `background ${TRIBORA_EXTENSION_THEME.motion.fast} ${TRIBORA_EXTENSION_THEME.motion.ease}`,
  });
  stopBtn.setAttribute('aria-label', 'Stop conversation');
  stopBtn.setAttribute('title', 'Stop conversation');
  stopBtn.addEventListener('mouseenter', () =>
    apply(stopBtn, { background: 'rgba(245, 190, 77, 0.22)' }),
  );
  stopBtn.addEventListener('mouseleave', () =>
    apply(stopBtn, { background: 'rgba(245, 190, 77, 0.12)' }),
  );
  stopBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    callbacks.onStopClick?.();
  });

  const xSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  xSvg.setAttribute('width', '10');
  xSvg.setAttribute('height', '10');
  xSvg.setAttribute('viewBox', '0 0 10 10');
  xSvg.setAttribute('fill', 'none');
  const xPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  xPath.setAttribute('d', 'M1 1 L9 9 M9 1 L1 9');
  xPath.setAttribute('stroke', TRIBORA_EXTENSION_THEME.color.signal);
  xPath.setAttribute('stroke-width', '1.5');
  xPath.setAttribute('stroke-linecap', 'round');
  xSvg.appendChild(xPath);
  stopBtn.appendChild(xSvg);

  pill.appendChild(orb);
  pill.appendChild(hotkeyHint);
  pill.appendChild(canvas);
  pill.appendChild(spinner);
  pill.appendChild(label);
  container.appendChild(pill);
  container.appendChild(stopBtn);
  document.documentElement.appendChild(container);

  let currentState: WidgetState = 'hidden';
  let currentColor = COLOR_SIGNAL;
  let currentGlow = COLOR_SIGNAL_GLOW;
  let animFrameId: number | null = null;
  const ctx = canvas.getContext('2d')!;

  function drawWaveform(timestamp: number) {
    if (currentState !== 'listening' && currentState !== 'speaking') {
      animFrameId = null;
      return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < BAR_COUNT; i++) {
      const animPhase = (timestamp / 1000) * 3.6 + i * 0.35;
      const idlePulse = ((Math.sin(animPhase) + 1) / 2) * 4;
      const barHeight = Math.min(
        BAR_MIN_HEIGHT + idlePulse * BAR_PROFILE[i],
        BAR_MAX_HEIGHT,
      );

      const x = i * (BAR_WIDTH + BAR_GAP) * 2;
      const y = ((BAR_MAX_HEIGHT - barHeight) * 2) / 2;
      const w = BAR_WIDTH * 2;
      const h = barHeight * 2;
      const r = Math.min(w / 2, 3);

      ctx.fillStyle = currentColor;
      ctx.shadowColor = currentGlow;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      ctx.fill();
    }

    animFrameId = requestAnimationFrame(drawWaveform);
  }

  function startAnimation() {
    if (prefersReducedMotion) return;
    if (animFrameId !== null) return;
    animFrameId = requestAnimationFrame(drawWaveform);
  }

  function stopAnimation() {
    if (animFrameId !== null) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
  }

  function hideIdleElements() {
    apply(orb, { display: 'none' });
    apply(hotkeyHint, { display: 'none' });
  }

  function setIdle() {
    currentState = 'idle';
    stopAnimation();
    pill.disabled = false;
    pill.setAttribute('aria-label', 'Start Tribora voice session');
    pill.setAttribute('aria-pressed', 'false');
    pill.setAttribute('title', 'Start Tribora voice session');
    apply(orb, { display: 'flex' });
    apply(hotkeyHint, { display: 'inline' });
    apply(canvas, { display: 'none' });
    apply(spinner, { display: 'none' });
    apply(label, { display: 'none' });
    apply(stopBtn, { display: 'none' });
    apply(pill, {
      cursor: 'pointer',
      boxShadow: PILL_SHADOW_BASE,
    });
  }

  function setConnecting() {
    currentState = 'connecting';
    stopAnimation();
    pill.disabled = true;
    pill.setAttribute('aria-label', 'Tribora voice session connecting');
    pill.setAttribute('aria-pressed', 'true');
    pill.setAttribute('title', 'Tribora voice session connecting');
    hideIdleElements();
    apply(canvas, { display: 'none' });
    apply(spinner, { display: 'block' });
    apply(label, { display: 'block' });
    label.textContent = 'Connecting';
    apply(label, { color: TRIBORA_EXTENSION_THEME.color.inkFaint });
    apply(stopBtn, { display: 'flex' });
    apply(pill, { cursor: 'default' });
  }

  function setListening() {
    currentState = 'listening';
    currentColor = COLOR_SIGNAL;
    currentGlow = COLOR_SIGNAL_GLOW;
    pill.disabled = true;
    pill.setAttribute('aria-label', 'Tribora is listening');
    pill.setAttribute('aria-pressed', 'true');
    pill.setAttribute('title', 'Tribora is listening');
    hideIdleElements();
    apply(canvas, { display: 'block' });
    apply(spinner, { display: 'none' });
    apply(label, { display: 'block' });
    label.textContent = 'Listening';
    apply(label, { color: TRIBORA_EXTENSION_THEME.color.inkDim });
    apply(stopBtn, { display: 'flex' });
    apply(pill, {
      cursor: 'default',
      boxShadow: `${PILL_SHADOW_BASE}, 0 0 20px ${COLOR_SIGNAL_GLOW}`,
    });
    startAnimation();
  }

  function setThinking() {
    currentState = 'thinking';
    stopAnimation();
    pill.disabled = true;
    pill.setAttribute('aria-label', 'Tribora is thinking');
    pill.setAttribute('aria-pressed', 'true');
    pill.setAttribute('title', 'Tribora is thinking');
    hideIdleElements();
    apply(canvas, { display: 'none' });
    apply(spinner, { display: 'block' });
    apply(label, { display: 'block' });
    label.textContent = 'Thinking';
    apply(label, { color: TRIBORA_EXTENSION_THEME.color.inkDim });
    apply(stopBtn, { display: 'flex' });
  }

  function setSpeaking() {
    currentState = 'speaking';
    currentColor = COLOR_LIVE;
    currentGlow = COLOR_LIVE_GLOW;
    pill.disabled = true;
    pill.setAttribute('aria-label', 'Tribora is speaking');
    pill.setAttribute('aria-pressed', 'true');
    pill.setAttribute('title', 'Tribora is speaking');
    hideIdleElements();
    apply(canvas, { display: 'block' });
    apply(spinner, { display: 'none' });
    apply(label, { display: 'block' });
    label.textContent = 'Speaking';
    apply(label, { color: COLOR_LIVE });
    apply(stopBtn, { display: 'flex' });
    apply(pill, {
      cursor: 'default',
      boxShadow: `${PILL_SHADOW_BASE}, 0 0 20px ${COLOR_LIVE_GLOW}`,
    });
    startAnimation();
  }

  function show() {
    apply(container, { display: 'flex' });
    if (currentState === 'hidden') setIdle();
  }

  function hide() {
    apply(container, { display: 'none' });
    currentState = 'hidden';
    stopAnimation();
  }

  function destroy() {
    stopAnimation();
    container.remove();
  }

  return {
    show,
    hide,
    setIdle,
    setConnecting,
    setListening,
    setThinking,
    setSpeaking,
    getState: () => currentState,
    isVisible: () => currentState !== 'hidden',
    destroy,
  };
}

function apply(
  el: HTMLElement | HTMLCanvasElement,
  styles: Partial<CSSStyleDeclaration>,
) {
  Object.assign(el.style, styles);
}

function injectWidgetStyles() {
  if (document.getElementById(WIDGET_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = WIDGET_STYLE_ID;
  style.textContent = [
    '@keyframes tribora-widget-spin {',
    '  from { transform: rotate(0deg); }',
    '  to { transform: rotate(360deg); }',
    '}',
    '#tribora-widget button:focus-visible {',
    `  outline: 2px solid ${TRIBORA_EXTENSION_THEME.color.signal};`,
    '  outline-offset: 3px;',
    '}',
    '#tribora-widget button:disabled {',
    '  cursor: default;',
    '}',
  ].join('\n');
  (document.head ?? document.documentElement).appendChild(style);
}
