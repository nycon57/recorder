export type NoReplyWatchdogReason =
  | 'user_message_timeout'
  | 'post_tool_timeout';

interface NoReplyWatchdogEvent {
  turnId: string;
  reason: NoReplyWatchdogReason;
}

export interface TurnGuardOptions {
  setTimer?: (
    callback: () => void,
    delayMs: number,
  ) => ReturnType<typeof setTimeout>;
  clearTimer?: (timerId: ReturnType<typeof setTimeout>) => void;
  onNoReplyWatchdog?: (event: NoReplyWatchdogEvent) => void;
  userTimeoutMs?: number;
  postToolTimeoutMs?: number;
}

export interface ToolCompletionRecord {
  turnId: string;
  toolName: string;
  pageContextFingerprint?: string | null;
  pageContextChanged?: boolean;
}

export interface ToolCompletionOutcome {
  repeatedPageContext: boolean;
  unchangedPageContext: boolean;
}

export interface AssistantMessageOutcome {
  duplicateWithoutMaterialChange: boolean;
}

type ActiveTurnState = {
  id: string;
  assistantReplyCount: number;
  firstAssistantMaterialVersion: number | null;
  lastPageContextFingerprint: string | null;
  watchdogTimerId: ReturnType<typeof setTimeout> | null;
  watchdogFired: boolean;
};

const DEFAULT_USER_TIMEOUT_MS = 12_000;
const DEFAULT_POST_TOOL_TIMEOUT_MS = 8_000;

export function createTurnGuards(options: TurnGuardOptions = {}) {
  const setTimer =
    options.setTimer ??
    ((callback: () => void, delayMs: number) => setTimeout(callback, delayMs));
  const clearTimer =
    options.clearTimer ??
    ((timerId: ReturnType<typeof setTimeout>) => clearTimeout(timerId));
  const userTimeoutMs = options.userTimeoutMs ?? DEFAULT_USER_TIMEOUT_MS;
  const postToolTimeoutMs =
    options.postToolTimeoutMs ?? DEFAULT_POST_TOOL_TIMEOUT_MS;

  let materialVersion = 0;
  let activeTurn: ActiveTurnState | null = null;

  function clearWatchdog(): void {
    if (!activeTurn?.watchdogTimerId) return;
    clearTimer(activeTurn.watchdogTimerId);
    activeTurn.watchdogTimerId = null;
  }

  function armWatchdog(
    turnId: string,
    reason: NoReplyWatchdogReason,
    delayMs: number,
  ): void {
    if (!activeTurn || activeTurn.id !== turnId) return;

    clearWatchdog();
    activeTurn.watchdogTimerId = setTimer(() => {
      if (!activeTurn || activeTurn.id !== turnId) return;
      if (activeTurn.assistantReplyCount > 0 || activeTurn.watchdogFired)
        return;

      activeTurn.watchdogFired = true;
      activeTurn.watchdogTimerId = null;
      options.onNoReplyWatchdog?.({ turnId, reason });
    }, delayMs);
  }

  return {
    startTurn(turnId: string): void {
      clearWatchdog();
      activeTurn = {
        id: turnId,
        assistantReplyCount: 0,
        firstAssistantMaterialVersion: null,
        lastPageContextFingerprint: null,
        watchdogTimerId: null,
        watchdogFired: false,
      };
      armWatchdog(turnId, 'user_message_timeout', userTimeoutMs);
    },

    recordToolCompletion(args: ToolCompletionRecord): ToolCompletionOutcome {
      if (!activeTurn || activeTurn.id !== args.turnId) {
        return {
          repeatedPageContext: false,
          unchangedPageContext: false,
        };
      }

      let repeatedPageContext = false;
      let unchangedPageContext = false;

      if (args.toolName === 'get_page_context') {
        repeatedPageContext = activeTurn.lastPageContextFingerprint !== null;
        unchangedPageContext =
          repeatedPageContext &&
          !!args.pageContextFingerprint &&
          args.pageContextFingerprint === activeTurn.lastPageContextFingerprint;

        if (args.pageContextFingerprint) {
          if (!unchangedPageContext && args.pageContextChanged !== false) {
            materialVersion += 1;
          }
          activeTurn.lastPageContextFingerprint = args.pageContextFingerprint;
        }
      } else {
        materialVersion += 1;
      }

      if (activeTurn.assistantReplyCount === 0) {
        armWatchdog(args.turnId, 'post_tool_timeout', postToolTimeoutMs);
      }

      return {
        repeatedPageContext,
        unchangedPageContext,
      };
    },

    recordAssistantMessage(turnId: string): AssistantMessageOutcome {
      if (!activeTurn || activeTurn.id !== turnId) {
        return { duplicateWithoutMaterialChange: false };
      }

      clearWatchdog();
      activeTurn.assistantReplyCount += 1;

      if (activeTurn.assistantReplyCount === 1) {
        activeTurn.firstAssistantMaterialVersion = materialVersion;
        return { duplicateWithoutMaterialChange: false };
      }

      return {
        duplicateWithoutMaterialChange:
          activeTurn.firstAssistantMaterialVersion === materialVersion,
      };
    },

    clear(): void {
      clearWatchdog();
      activeTurn = null;
    },
  };
}
