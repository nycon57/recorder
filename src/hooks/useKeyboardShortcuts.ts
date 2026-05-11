import { useEffect, useRef } from 'react';

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
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
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
        handlersRef.current.onPlayPause?.();
      } else if (event.code === 'ArrowLeft' && !modifier) {
        event.preventDefault();
        handlersRef.current.onSeekBackward?.();
      } else if (event.code === 'ArrowRight' && !modifier) {
        event.preventDefault();
        handlersRef.current.onSeekForward?.();
      } else if (event.code === 'ArrowUp' && !modifier) {
        event.preventDefault();
        handlersRef.current.onVolumeUp?.();
      } else if (event.code === 'ArrowDown' && !modifier) {
        event.preventDefault();
        handlersRef.current.onVolumeDown?.();
      } else if (event.code === 'KeyM' && !modifier) {
        event.preventDefault();
        handlersRef.current.onMute?.();
      } else if (event.code === 'KeyF' && !modifier) {
        event.preventDefault();
        handlersRef.current.onFullscreen?.();
      }
      // Actions
      else if (event.code === 'KeyD' && modifier) {
        event.preventDefault();
        handlersRef.current.onDownload?.();
      } else if (event.code === 'KeyE' && modifier) {
        event.preventDefault();
        handlersRef.current.onEdit?.();
      } else if (event.code === 'KeyF' && modifier) {
        event.preventDefault();
        handlersRef.current.onSearch?.();
      } else if (event.code === 'KeyR' && modifier && event.shiftKey) {
        event.preventDefault();
        handlersRef.current.onReprocess?.();
      }
      // General
      else if (event.code === 'Slash' && event.shiftKey) {
        // ? key (Shift + /)
        event.preventDefault();
        handlersRef.current.onShowShortcuts?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
