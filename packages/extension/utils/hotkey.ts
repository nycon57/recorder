/**
 * hotkey.ts — Keyboard modifier handler for push-to-talk audio capture.
 *
 * Fires onPress when the configured modifier combination is held down,
 * and onRelease when any modifier in the combination is released.
 * Handles Chrome's focus edge cases (tab switch, window blur).
 *
 * Part of TRIB-25: Deepgram STT + push-to-talk.
 */

import type { HotkeyConfig } from "@tribora/shared";

export interface HotkeyHandler {
  /** Attach keydown/keyup/blur listeners to window */
  start(): void;
  /** Remove all listeners and reset state */
  stop(): void;
}

/**
 * Creates a push-to-talk hotkey handler.
 *
 * @param config   Modifier combination (cmd, ctrl, alt, shift) + optional key
 * @param onPress  Called once when all required modifiers are pressed simultaneously
 * @param onRelease Called once when any required modifier is released
 */
export function createHotkey(
  config: HotkeyConfig,
  onPress: () => void,
  onRelease: () => void,
): HotkeyHandler {
  let isActive = false; // true while all modifiers are held
  let listenerAttached = false;

  /** Map HotkeyConfig modifiers to KeyboardEvent booleans */
  function modifiersPressed(e: KeyboardEvent): boolean {
    const needsCmd = config.modifiers.includes("cmd");
    const needsCtrl = config.modifiers.includes("ctrl");
    const needsAlt = config.modifiers.includes("alt");
    const needsShift = config.modifiers.includes("shift");

    if (needsCmd && !e.metaKey) return false;
    if (needsCtrl && !e.ctrlKey) return false;
    if (needsAlt && !e.altKey) return false;
    if (needsShift && !e.shiftKey) return false;

    // If an optional extra key is configured, it must be pressed too
    if (config.key) {
      const pressed = e.key.toLowerCase();
      if (pressed !== config.key.toLowerCase()) return false;
    }

    return true;
  }

  /**
   * Returns true if the released key is one of the configured modifiers
   * (or the optional extra key), meaning we should fire onRelease.
   */
  function isConfiguredKey(e: KeyboardEvent): boolean {
    const key = e.key;
    const modMap: Record<string, "cmd" | "ctrl" | "alt" | "shift"> = {
      Meta: "cmd",
      Control: "ctrl",
      Alt: "alt",
      Shift: "shift",
    };
    const released = modMap[key];
    if (released && config.modifiers.includes(released)) return true;
    if (config.key && key.toLowerCase() === config.key.toLowerCase())
      return true;
    return false;
  }

  function handleKeyDown(e: KeyboardEvent): void {
    if (isActive) return; // already recording
    if (modifiersPressed(e)) {
      isActive = true;
      onPress();
    }
  }

  function handleKeyUp(e: KeyboardEvent): void {
    if (!isActive) return;
    if (isConfiguredKey(e)) {
      isActive = false;
      onRelease();
    }
  }

  /**
   * When the window loses focus (user tabs away, switches app, etc.),
   * treat it as a release to avoid the microphone staying open silently.
   */
  function handleBlur(): void {
    if (isActive) {
      isActive = false;
      onRelease();
    }
  }

  return {
    start() {
      if (listenerAttached) return;
      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("keyup", handleKeyUp);
      window.addEventListener("blur", handleBlur);
      listenerAttached = true;
    },

    stop() {
      if (!listenerAttached) return;
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
      listenerAttached = false;
      // If still active when stopped, fire release so callers can clean up
      if (isActive) {
        isActive = false;
        onRelease();
      }
    },
  };
}
