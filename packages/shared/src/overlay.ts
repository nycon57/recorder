/**
 * overlay.ts — Overlay message types for the Tribora extension's visual teaching layer.
 *
 * These message types are used by the background service worker and popup to
 * command the content script's DOM overlay (dom-overlay.ts).
 *
 * NOTE: These types are intentionally separate from types.ts (owned by TRIB-23)
 * to avoid merge conflicts during parallel development.
 */

/** The action to perform on the target element */
export type OverlayAction = "point" | "highlight" | "pulse";

/** A targeting descriptor for the overlay */
export interface OverlayTarget {
  /** CSS selector from the context engine's interactive element inventory */
  selector: string;
  /** Human-readable label shown near the cursor (optional) */
  label?: string;
  /** Action to perform on the target */
  action: OverlayAction;
}

/** Command: animate the cursor to a specific element and optionally show a label */
export interface OverlayPointMessage {
  type: "OVERLAY_POINT";
  selector: string;
  label?: string;
}

/** Command: draw a highlight ring around a specific element */
export interface OverlayHighlightMessage {
  type: "OVERLAY_HIGHLIGHT";
  selector: string;
}

/** Command: draw a pulsing highlight ring around a specific element */
export interface OverlayPulseMessage {
  type: "OVERLAY_PULSE";
  selector: string;
}

/** Command: clear all overlay visuals */
export interface OverlayClearMessage {
  type: "OVERLAY_CLEAR";
}

/** Union of all overlay command messages */
export type OverlayMessage =
  | OverlayPointMessage
  | OverlayHighlightMessage
  | OverlayPulseMessage
  | OverlayClearMessage;
