export type RecordingStatus =
  | 'idle'
  | 'requesting_capture'
  | 'recording'
  | 'uploading'
  | 'error';

export interface RecordingState {
  status: RecordingStatus;
  recordingId?: string;
  error?: string;
  startedAt?: number;
  duration?: number;
  uploadedBytes?: number;
  totalBytes?: number;
  /** Upload progress percentage (0-100) */
  uploadProgress?: number;
  /** When retrying a failed upload, current attempt (1-indexed) */
  retryAttempt?: number;
  /** Total retry attempts allowed */
  retryMax?: number;
}

export interface RecordingMessage {
  type:
    | 'RECORDING_START'
    | 'RECORDING_STOP'
    | 'RECORDING_STATE_REQUEST'
    | 'RECORDING_STATE_UPDATE';
  state?: RecordingState;
}

export interface RecordingUploadInit {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  source: 'extension';
}
