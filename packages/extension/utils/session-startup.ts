export type WidgetBootstrapMode = 'hidden' | 'idle' | 'connecting';

export interface WidgetBootstrapInput {
  extensionEnabled: boolean;
  sessionActive: boolean;
  isHomeTab: boolean;
}

export interface WidgetBootstrapState {
  visible: boolean;
  mode: WidgetBootstrapMode;
}

export interface MicBootstrapDecisionInput {
  micPermissionGranted: boolean;
  errorMessage?: string | null;
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

  if (input.sessionActive && input.isHomeTab) {
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
