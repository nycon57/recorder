export type WidgetBootstrapMode = 'hidden' | 'idle' | 'connecting';

export interface WidgetBootstrapInput {
  extensionEnabled: boolean;
  sessionActive: boolean;
  isActiveTarget: boolean;
}

export interface WidgetBootstrapState {
  visible: boolean;
  mode: WidgetBootstrapMode;
}

export interface MicBootstrapDecisionInput {
  micPermissionGranted: boolean;
  errorMessage?: string | null;
}

export interface VoiceTargetRegistrationInput {
  extensionEnabled: boolean;
  sessionActive: boolean;
  activeTargetTabId: number | null;
  candidateTabId: number;
  candidateTabActive: boolean;
  candidateUrl?: string | null;
}

const MIC_PERMISSION_PATTERNS = [
  'permission dismissed',
  'microphone permission denied',
  'permission denied',
  'notallowederror',
  'permissiondeniederror',
  'getusermedia permission denied',
];

const NON_MIC_PERMISSION_PATTERNS = [
  'botsplash permission is not granted for this user',
];

export function deriveWidgetBootstrapState(
  input: WidgetBootstrapInput,
): WidgetBootstrapState {
  if (!input.extensionEnabled) {
    return {
      visible: false,
      mode: 'hidden',
    };
  }

  if (input.sessionActive && input.isActiveTarget) {
    return {
      visible: true,
      mode: 'connecting',
    };
  }

  return {
    visible: true,
    mode: 'idle',
  };
}

export function isMicPermissionError(message?: string | null): boolean {
  if (!message) return false;

  const normalized = message.trim().toLowerCase();
  if (!normalized) return false;

  if (
    NON_MIC_PERMISSION_PATTERNS.some((pattern) => normalized.includes(pattern))
  ) {
    return false;
  }

  return MIC_PERMISSION_PATTERNS.some((pattern) =>
    normalized.includes(pattern),
  );
}

export function shouldOpenMicPermissionBootstrap(
  input: MicBootstrapDecisionInput,
): boolean {
  if (!input.micPermissionGranted) return true;
  return isMicPermissionError(input.errorMessage);
}

export function buildUnavailableVoiceTargetToolResult(
  toolName: string,
): string {
  if (toolName === 'capture_screenshot') {
    return 'No supported page target is currently available for screenshots. The voice session is still running; switch to a normal web page or reopen the Tribora widget to continue page actions.';
  }

  return 'No supported page target is currently available. The voice session is still running; switch to a normal web page or reopen the Tribora widget to continue page actions.';
}

export function isSupportedVoiceTargetUrl(url?: string | null): boolean {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function shouldRegisterVoiceTarget(
  input: VoiceTargetRegistrationInput,
): boolean {
  if (!input.extensionEnabled) return false;
  if (!input.sessionActive) return false;
  if (!isSupportedVoiceTargetUrl(input.candidateUrl)) return false;
  if (input.activeTargetTabId === input.candidateTabId) return true;
  if (input.activeTargetTabId === null) return true;
  return input.candidateTabActive;
}
