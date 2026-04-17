export type MicPermissionStatusTone = 'normal' | 'error' | 'success';
export type MicPermissionViewState =
  | 'initial'
  | 'requesting'
  | 'error'
  | 'success';

export interface MicPermissionViewModelInput {
  state: MicPermissionViewState;
  errorMessage?: string | null;
}

export interface MicPermissionViewModel {
  autoRequestOnOpen: boolean;
  primaryActionLabel: string | null;
  primaryActionVisible: boolean;
  statusMessage: string;
  statusTone: MicPermissionStatusTone;
}

function buildErrorMessage(errorMessage?: string | null): string {
  const detail = errorMessage?.trim() || 'Unknown error';

  return `Microphone access failed: ${detail}. You can try again after updating Chrome's permission prompt or site settings.`;
}

export function deriveMicPermissionViewModel(
  input: MicPermissionViewModelInput,
): MicPermissionViewModel {
  switch (input.state) {
    case 'initial':
    case 'requesting':
      return {
        autoRequestOnOpen: input.state === 'initial',
        primaryActionLabel: null,
        primaryActionVisible: false,
        statusMessage: 'Requesting microphone access...',
        statusTone: 'normal',
      };

    case 'success':
      return {
        autoRequestOnOpen: false,
        primaryActionLabel: null,
        primaryActionVisible: false,
        statusMessage: 'Microphone granted. Returning to Tribora...',
        statusTone: 'success',
      };

    case 'error':
      return {
        autoRequestOnOpen: false,
        primaryActionLabel: 'Try again',
        primaryActionVisible: true,
        statusMessage: buildErrorMessage(input.errorMessage),
        statusTone: 'error',
      };
  }
}
