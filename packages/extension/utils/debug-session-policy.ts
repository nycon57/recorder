export function isDebugSessionLoggingAlwaysOn(): boolean {
  return (
    (import.meta.env as Record<string, string | undefined>)
      .VITE_TRIBORA_EXTENSION_RAW_DEBUG_EVENTS === 'true'
  );
}
