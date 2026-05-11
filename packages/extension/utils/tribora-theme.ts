export const TRIBORA_EXTENSION_THEME = {
  color: {
    surface0: 'oklch(0.135 0.008 60)',
    surface1: 'oklch(0.172 0.008 60)',
    surface2: 'oklch(0.215 0.01 62)',
    surface3: 'oklch(0.268 0.012 64)',
    ink: 'oklch(0.965 0.005 80)',
    inkMuted: 'oklch(0.745 0.01 72)',
    inkDim: 'oklch(0.538 0.012 70)',
    inkFaint: 'oklch(0.398 0.01 68)',
    line: 'oklch(0.262 0.01 64 / 0.72)',
    lineStrong: 'oklch(0.328 0.012 64)',
    signal: 'oklch(0.78 0.155 72)',
    signalInk: 'oklch(0.145 0.02 70)',
    signalSoft: 'oklch(0.78 0.155 72 / 0.18)',
    signalEdge: 'oklch(0.78 0.155 72 / 0.42)',
    live: 'oklch(0.76 0.155 148)',
    danger: 'oklch(0.62 0.16 28)',
  },
  font: {
    display:
      '"Space Grotesk", "Manrope", "Avenir Next", "Segoe UI", sans-serif',
    body: '"Manrope", "Space Grotesk", "Avenir Next", "Segoe UI", sans-serif',
    mono: '"JetBrains Mono", "SFMono-Regular", "Menlo", "Consolas", "Liberation Mono", monospace',
  },
  motion: {
    ease: 'cubic-bezier(0.16, 1, 0.3, 1)',
    fast: '150ms',
    medium: '260ms',
    slow: '420ms',
  },
  authWindow: {
    width: 468,
    height: 760,
  },
} as const;

type TriboraExtensionTheme = typeof TRIBORA_EXTENSION_THEME;
