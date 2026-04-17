export function shouldClearOverlayForSessionEvent(kind: string): boolean {
  return kind === 'error' || kind === 'disconnected';
}
