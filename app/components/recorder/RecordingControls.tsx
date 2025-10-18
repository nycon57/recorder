'use client';

import { useRecording, type RecordingLayout, type CameraShape } from '../contexts/RecordingContext';

export function RecordingControls() {
  const {
    layout,
    setLayout,
    cameraShape,
    setCameraShape,
    isRecording,
    isPaused,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cameraStream,
    screenshareStream,
  } = useRecording();

  const canRecord =
    layout === 'cameraOnly'
      ? !!cameraStream
      : layout === 'screenOnly'
        ? !!screenshareStream
        : !!cameraStream && !!screenshareStream;

  return (
    <div className="space-y-6 p-6 bg-card rounded-lg shadow">
      {/* Layout selector */}
      <div>
        <h3 className="text-sm font-medium mb-3 text-foreground">Recording Mode</h3>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setLayout('screenAndCamera')}
            className={`px-4 py-2 text-sm rounded-md border-2 transition-colors ${
              layout === 'screenAndCamera'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border hover:border-muted-foreground'
            }`}
          >
            Screen + Camera
          </button>
          <button
            onClick={() => setLayout('screenOnly')}
            className={`px-4 py-2 text-sm rounded-md border-2 transition-colors ${
              layout === 'screenOnly'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border hover:border-muted-foreground'
            }`}
          >
            Screen Only
          </button>
          <button
            onClick={() => setLayout('cameraOnly')}
            className={`px-4 py-2 text-sm rounded-md border-2 transition-colors ${
              layout === 'cameraOnly'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border hover:border-muted-foreground'
            }`}
          >
            Camera Only
          </button>
        </div>
      </div>

      {/* Camera shape */}
      {layout === 'screenAndCamera' && (
        <div>
          <h3 className="text-sm font-medium mb-3 text-foreground">Camera Shape</h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setCameraShape('circle')}
              className={`px-4 py-2 text-sm rounded-md border-2 transition-colors ${
                cameraShape === 'circle'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:border-muted-foreground'
              }`}
            >
              Circle
            </button>
            <button
              onClick={() => setCameraShape('square')}
              className={`px-4 py-2 text-sm rounded-md border-2 transition-colors ${
                cameraShape === 'square'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:border-muted-foreground'
              }`}
            >
              Square
            </button>
          </div>
        </div>
      )}

      {/* Recording button */}
      <div className="pt-4 border-t border-border">
        {!isRecording ? (
          <button
            onClick={startRecording}
            disabled={!canRecord}
            className={`w-full py-3 rounded-lg font-medium transition-colors ${
              canRecord
                ? 'bg-destructive text-white hover:bg-destructive/90'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            }`}
          >
            {canRecord ? 'Start Recording' : 'Select devices to start'}
          </button>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2 mb-3">
              <div className="w-3 h-3 bg-destructive rounded-full animate-pulse" />
              <span className="text-sm font-medium text-foreground">Recording...</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={isPaused ? resumeRecording : pauseRecording}
                className="px-4 py-2 bg-warning text-white rounded-lg hover:bg-warning/90 transition-colors"
              >
                {isPaused ? 'Resume' : 'Pause'}
              </button>
              <button
                onClick={stopRecording}
                className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors"
              >
                Stop
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
