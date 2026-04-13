/**
 * assistant.ts — Shared assistant lifecycle types for the Tribora Chrome extension.
 *
 * Tracks the high-level state of the AI assistant across the push-to-talk
 * question/answer flow. Used by the popup, content script, and background
 * service worker via chrome.storage.session.
 */

/** chrome.storage.session key for the assistant state */
export const ASSISTANT_STATE_KEY = "tribora_assistant_state";

/** Lifecycle state of the AI assistant */
export type AssistantStatus =
  | "idle"
  | "listening"
  | "transcribing"
  | "answering"
  | "speaking"
  | "error";

/** Current state of the AI assistant pipeline */
export interface AssistantState {
  status: AssistantStatus;
  /** The user's last question (persists across idle) */
  lastQuestion?: string;
  /** Preview of the AI response (~120 chars, persists across idle) */
  lastAnswerPreview?: string;
  /** Human-readable error message when status === "error" */
  error?: string;
  /** Unix ms timestamp of the last state change */
  updatedAt?: number;
}
