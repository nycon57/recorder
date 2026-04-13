/**
 * widget.ts — Floating AI assistant widget for the Tribora Chrome extension.
 *
 * A compact floating pill anchored bottom-right that shows the assistant's
 * current state via a Clicky-style waveform visualization:
 *   - Idle:      Small Tribora orb with subtle breathing pulse
 *   - Listening:  Orb expands to pill, indigo waveform bars driven by mic audio
 *   - Thinking:  Pill with spinner
 *   - Speaking:   Pill with Tribora-green waveform bars driven by TTS audio
 *
 * Built with vanilla DOM (consistent with dom-overlay.ts pattern).
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const WIDGET_ID = "tribora-widget";
const WIDGET_CANVAS_ID = "tribora-widget-canvas";

const COLOR_INDIGO = "#6366f1";
const COLOR_GREEN = "#00df82";
const COLOR_INDIGO_GLOW = "rgba(99, 102, 241, 0.5)";
const COLOR_GREEN_GLOW = "rgba(0, 223, 130, 0.5)";

// Clicky-style bar profile — center bar tallest
const BAR_COUNT = 5;
const BAR_PROFILE = [0.4, 0.7, 1.0, 0.7, 0.4];
const BAR_WIDTH = 3;
const BAR_GAP = 2;
const BAR_MIN_HEIGHT = 4;
const BAR_MAX_HEIGHT = 20;

// ─── Types ────────────────────────────────────────────────────────────────────

type WidgetState = "idle" | "connecting" | "listening" | "thinking" | "speaking" | "hidden";

/** Function that returns frequency data (0-255) for waveform rendering */
export type FrequencyDataProvider = () => Uint8Array;

export interface WidgetCallbacks {
  /** Called when user clicks the orb to start a session */
  onStartClick?: () => void;
  /** Called when user clicks to stop an active session */
  onStopClick?: () => void;
}

export interface AssistantWidget {
  show(): void;
  hide(): void;
  setIdle(): void;
  setConnecting(): void;
  setListening(getFrequencyData?: FrequencyDataProvider): void;
  setThinking(): void;
  setSpeaking(getFrequencyData?: FrequencyDataProvider): void;
  isVisible(): boolean;
  isSessionActive(): boolean;
  destroy(): void;
}

// ─── Implementation ──────────────────────────────────────────────────────────

export function createWidget(callbacks: WidgetCallbacks = {}): AssistantWidget {
  // Inject keyframes
  injectWidgetStyles();

  // Remove existing widget if present (from prior navigation)
  document.getElementById(WIDGET_ID)?.remove();

  // ── Container ──────────────────────────────────────────────────────────────
  const container = document.createElement("div");
  container.id = WIDGET_ID;
  container.setAttribute("data-tribora-owner", "true");
  apply(container, {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    zIndex: "2147483647",
    pointerEvents: "none",
    display: "none",
    transition: "all 300ms cubic-bezier(0.22, 1, 0.36, 1)",
  });

  // ── Inner pill ─────────────────────────────────────────────────────────────
  const pill = document.createElement("div");
  apply(pill, {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 14px",
    borderRadius: "24px",
    background: "rgba(15, 15, 15, 0.92)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    boxShadow: `0 4px 24px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.06)`,
    transition: "all 300ms cubic-bezier(0.22, 1, 0.36, 1)",
    pointerEvents: "auto",
    cursor: "pointer",
  });

  // Click handler — start session from idle.
  // Stopping is handled by the dedicated stop button (X).
  pill.addEventListener("click", () => {
    if (currentState === "idle") {
      console.log("[Tribora widget] Click → start session");
      callbacks.onStartClick?.();
    }
  });

  // ── Tribora orb (idle state) ───────────────────────────────────────────────
  const orb = document.createElement("div");
  apply(orb, {
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    background: `linear-gradient(135deg, #03624c 0%, #2cc295 50%, ${COLOR_GREEN} 100%)`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "13px",
    fontWeight: "700",
    fontFamily: "system-ui, -apple-system, sans-serif",
    color: "white",
    flexShrink: "0",
    transition: "all 300ms ease",
    boxShadow: `0 0 12px ${COLOR_GREEN_GLOW}`,
  });
  orb.textContent = "T";

  // ── Idle call-to-action ────────────────────────────────────────────────────
  const hotkeyHint = document.createElement("span");
  apply(hotkeyHint, {
    fontSize: "12px",
    fontFamily: "system-ui, -apple-system, sans-serif",
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.75)",
    whiteSpace: "nowrap",
    letterSpacing: "0.2px",
  });
  hotkeyHint.textContent = "Click to talk";

  // ── Waveform canvas ────────────────────────────────────────────────────────
  const canvas = document.createElement("canvas");
  canvas.id = WIDGET_CANVAS_ID;
  const totalWidth = BAR_COUNT * BAR_WIDTH + (BAR_COUNT - 1) * BAR_GAP;
  canvas.width = totalWidth * 2; // 2x for retina
  canvas.height = BAR_MAX_HEIGHT * 2;
  apply(canvas, {
    width: `${totalWidth}px`,
    height: `${BAR_MAX_HEIGHT}px`,
    display: "none",
    flexShrink: "0",
  });

  // ── Status label ───────────────────────────────────────────────────────────
  const label = document.createElement("span");
  apply(label, {
    fontSize: "12px",
    fontFamily: "system-ui, -apple-system, sans-serif",
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.7)",
    whiteSpace: "nowrap",
    display: "none",
    transition: "opacity 200ms ease",
  });

  // ── Spinner (thinking state) ───────────────────────────────────────────────
  const spinner = document.createElement("div");
  apply(spinner, {
    width: "16px",
    height: "16px",
    border: "2px solid rgba(255,255,255,0.15)",
    borderTopColor: COLOR_GREEN,
    borderRadius: "50%",
    animation: "tribora-widget-spin 0.7s linear infinite",
    display: "none",
    flexShrink: "0",
  });

  // ── Stop button (visible during active session) ───────────────────────────
  const stopBtn = document.createElement("button");
  apply(stopBtn, {
    width: "20px",
    height: "20px",
    borderRadius: "50%",
    background: "rgba(255, 255, 255, 0.1)",
    border: "none",
    cursor: "pointer",
    display: "none",
    alignItems: "center",
    justifyContent: "center",
    padding: "0",
    marginLeft: "4px",
    flexShrink: "0",
    transition: "background 150ms ease",
  });
  stopBtn.setAttribute("aria-label", "Stop conversation");
  stopBtn.setAttribute("title", "Stop conversation");
  stopBtn.addEventListener("mouseenter", () => {
    apply(stopBtn, { background: "rgba(255, 255, 255, 0.2)" });
  });
  stopBtn.addEventListener("mouseleave", () => {
    apply(stopBtn, { background: "rgba(255, 255, 255, 0.1)" });
  });
  stopBtn.addEventListener("click", (e) => {
    e.stopPropagation(); // Prevent pill click handler from firing
    console.log("[Tribora widget] Stop button clicked");
    callbacks.onStopClick?.();
  });
  // X icon (SVG)
  const xSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  xSvg.setAttribute("width", "10");
  xSvg.setAttribute("height", "10");
  xSvg.setAttribute("viewBox", "0 0 10 10");
  xSvg.setAttribute("fill", "none");
  const xPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  xPath.setAttribute("d", "M1 1 L9 9 M9 1 L1 9");
  xPath.setAttribute("stroke", "rgba(255, 255, 255, 0.8)");
  xPath.setAttribute("stroke-width", "1.5");
  xPath.setAttribute("stroke-linecap", "round");
  xSvg.appendChild(xPath);
  stopBtn.appendChild(xSvg);

  pill.appendChild(orb);
  pill.appendChild(hotkeyHint);
  pill.appendChild(canvas);
  pill.appendChild(spinner);
  pill.appendChild(label);
  pill.appendChild(stopBtn);
  container.appendChild(pill);
  document.documentElement.appendChild(container);

  // ── Waveform rendering ─────────────────────────────────────────────────────

  let currentState: WidgetState = "hidden";
  let currentFrequencyProvider: FrequencyDataProvider | null = null;
  let currentColor = COLOR_INDIGO;
  let currentGlow = COLOR_INDIGO_GLOW;
  let animFrameId: number | null = null;
  const ctx = canvas.getContext("2d")!;

  function drawWaveform(timestamp: number) {
    if (currentState !== "listening" && currentState !== "speaking") {
      animFrameId = null;
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let avgLevel = 0;
    if (currentFrequencyProvider) {
      try {
        const frequencyData = currentFrequencyProvider();
        // Average first 10 bins for overall level
        const binCount = Math.min(10, frequencyData.length);
        let sum = 0;
        for (let i = 0; i < binCount; i++) sum += frequencyData[i];
        avgLevel = binCount > 0 ? sum / (binCount * 255) : 0;
      } catch {
        // Provider may fail if session ended — just show idle pulse
      }
    }

    // Clicky-style easing
    const normalized = Math.max(avgLevel - 0.008, 0);
    const eased = Math.pow(Math.min(normalized * 2.85, 1), 0.76);

    for (let i = 0; i < BAR_COUNT; i++) {
      const animPhase = (timestamp / 1000) * 3.6 + i * 0.35;
      const reactiveHeight = eased * 10 * BAR_PROFILE[i];
      const idlePulse = (Math.sin(animPhase) + 1) / 2 * 1.5;
      const barHeight = Math.min(
        BAR_MIN_HEIGHT + reactiveHeight + idlePulse,
        BAR_MAX_HEIGHT,
      );

      const x = (i * (BAR_WIDTH + BAR_GAP)) * 2;
      const y = (BAR_MAX_HEIGHT - barHeight) * 2 / 2;
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
    if (animFrameId !== null) return;
    animFrameId = requestAnimationFrame(drawWaveform);
  }

  function stopAnimation() {
    if (animFrameId !== null) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
  }

  // ── State transitions ──────────────────────────────────────────────────────

  function setIdle() {
    console.log("[Tribora widget] State → idle");
    currentState = "idle";
    currentFrequencyProvider = null;
    stopAnimation();

    apply(orb, { display: "flex" });
    apply(hotkeyHint, { display: "inline" });
    apply(canvas, { display: "none" });
    apply(spinner, { display: "none" });
    apply(label, { display: "none" });
    apply(stopBtn, { display: "none" });
    apply(pill, {
      cursor: "pointer",
      boxShadow: `0 4px 24px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.06)`,
    });
  }

  function setConnecting() {
    console.log("[Tribora widget] State → connecting");
    currentState = "connecting";
    currentFrequencyProvider = null;
    stopAnimation();

    hideIdleElements();
    apply(canvas, { display: "none" });
    apply(spinner, { display: "block" });
    apply(label, { display: "block" });
    label.textContent = "Connecting...";
    apply(label, { color: "rgba(255,255,255,0.5)" });
    apply(stopBtn, { display: "flex" });
    apply(pill, {
      cursor: "default",
      boxShadow: `0 4px 24px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.06)`,
    });
  }

  function hideIdleElements() {
    apply(orb, { display: "none" });
    apply(hotkeyHint, { display: "none" });
  }

  function setListening(getFrequencyData?: FrequencyDataProvider) {
    console.log("[Tribora widget] State → listening (hasFreqData:", !!getFrequencyData, ")");
    currentState = "listening";
    currentFrequencyProvider = getFrequencyData ?? null;
    currentColor = COLOR_INDIGO;
    currentGlow = COLOR_INDIGO_GLOW;

    hideIdleElements();
    apply(canvas, { display: "block" });
    apply(spinner, { display: "none" });
    apply(label, { display: "block" });
    label.textContent = "Listening...";
    apply(label, { color: "rgba(255,255,255,0.7)" });
    apply(stopBtn, { display: "flex" });
    apply(pill, {
      cursor: "default",
      boxShadow: `0 4px 24px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.06), 0 0 20px ${COLOR_INDIGO_GLOW}`,
    });

    startAnimation();
  }

  function setThinking() {
    console.log("[Tribora widget] State → thinking");
    currentState = "thinking";
    currentFrequencyProvider = null;
    stopAnimation();

    hideIdleElements();
    apply(canvas, { display: "none" });
    apply(spinner, { display: "block" });
    apply(label, { display: "block" });
    label.textContent = "Thinking...";
    apply(label, { color: "rgba(255,255,255,0.7)" });
    apply(stopBtn, { display: "flex" });
    apply(pill, {
      boxShadow: `0 4px 24px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.06)`,
    });
  }

  function setSpeaking(getFrequencyData?: FrequencyDataProvider) {
    console.log("[Tribora widget] State → speaking (hasFreqData:", !!getFrequencyData, ")");
    currentState = "speaking";
    currentFrequencyProvider = getFrequencyData ?? null;
    currentColor = COLOR_GREEN;
    currentGlow = COLOR_GREEN_GLOW;

    hideIdleElements();
    apply(canvas, { display: "block" });
    apply(spinner, { display: "none" });
    apply(label, { display: "block" });
    label.textContent = "Speaking...";
    apply(label, { color: COLOR_GREEN });
    apply(stopBtn, { display: "flex" });
    apply(pill, {
      cursor: "default",
      boxShadow: `0 4px 24px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.06), 0 0 20px ${COLOR_GREEN_GLOW}`,
    });

    startAnimation();
  }

  function show() {
    console.log("[Tribora widget] show()");
    apply(container, { display: "block" });
    if (currentState === "hidden") setIdle();
  }

  function hide() {
    console.log("[Tribora widget] hide()");
    apply(container, { display: "none" });
    currentState = "hidden";
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
    isVisible: () => currentState !== "hidden",
    isSessionActive: () => currentState === "connecting" || currentState === "listening" || currentState === "speaking",
    destroy,
  };
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function apply(el: HTMLElement | HTMLCanvasElement, styles: Partial<CSSStyleDeclaration>) {
  Object.assign(el.style, styles);
}

const WIDGET_STYLE_ID = "tribora-widget-styles";

function injectWidgetStyles() {
  if (document.getElementById(WIDGET_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = WIDGET_STYLE_ID;
  style.textContent = [
    "@keyframes tribora-widget-spin {",
    "  from { transform: rotate(0deg); }",
    "  to { transform: rotate(360deg); }",
    "}",
  ].join("\n");
  (document.head ?? document.documentElement).appendChild(style);
}
