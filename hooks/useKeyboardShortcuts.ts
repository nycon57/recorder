import { useEffect, useCallback } from 'react';

interface KeyboardShortcutHandlers {
  onPlayPause?: () => void;
  onSeekBackward?: () => void;
  onSeekForward?: () => void;
  onVolumeUp?: () => void;
  onVolumeDown?: () => void;
  onMute?: () => void;
  onFullscreen?: () => void;
  onDownload?: () => void;
  onEdit?: () => void;
  onSearch?: () => void;
  onReprocess?: () => void;
  onShowShortcuts?: () => void;
}

export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? event.metaKey : event.ctrlKey;

      // Playback controls
      if (event.code === 'Space') {
        event.preventDefault();
        handlers.onPlayPause?.();
      } else if (event.code === 'ArrowLeft' && !modifier) {
        event.preventDefault();
        handlers.onSeekBackward?.();
      } else if (event.code === 'ArrowRight' && !modifier) {
        event.preventDefault();
        handlers.onSeekForward?.();
      } else if (event.code === 'ArrowUp' && !modifier) {
        event.preventDefault();
        handlers.onVolumeUp?.();
      } else if (event.code === 'ArrowDown' && !modifier) {
        event.preventDefault();
        handlers.onVolumeDown?.();
      } else if (event.code === 'KeyM' && !modifier) {
        event.preventDefault();
        handlers.onMute?.();
      } else if (event.code === 'KeyF' && !modifier) {
        event.preventDefault();
        handlers.onFullscreen?.();
      }
      // Actions
      else if (event.code === 'KeyD' && modifier) {
        event.preventDefault();
        handlers.onDownload?.();
      } else if (event.code === 'KeyE' && modifier) {
        event.preventDefault();
        handlers.onEdit?.();
      } else if (event.code === 'KeyF' && modifier) {
        event.preventDefault();
        handlers.onSearch?.();
      } else if (event.code === 'KeyR' && modifier && event.shiftKey) {
        event.preventDefault();
        handlers.onReprocess?.();
      }
      // General
      else if (event.code === 'Slash' && event.shiftKey) {
        // ? key (Shift + /)
        event.preventDefault();
        handlers.onShowShortcuts?.();
      }
    },
    [handlers]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
