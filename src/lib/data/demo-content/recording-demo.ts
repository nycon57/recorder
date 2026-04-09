/**
 * Mock data for the Recording Demo component
 */

export interface CursorEvent {
  type: 'click' | 'scroll' | 'type' | 'move';
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  timestamp: number; // seconds
  text?: string; // for type events
  direction?: 'up' | 'down'; // for scroll events
}

export interface RecordingDemoData {
  duration: string;
  elapsedSeconds: number;
  events: CursorEvent[];
  stats: {
    uiEvents: number;
    clicks: number;
    keystrokes: number;
  };
  mockScreen: {
    title: string;
    url: string;
    elements: Array<{
      id: string;
      type: 'button' | 'input' | 'nav' | 'card';
      label: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }>;
  };
}

export const recordingDemoData: RecordingDemoData = {
  duration: '00:42:15',
  elapsedSeconds: 42 * 60 + 15,
  events: [
    { type: 'move', x: 20, y: 30, timestamp: 0 },
    { type: 'click', x: 15, y: 12, timestamp: 1.2 },
    { type: 'move', x: 45, y: 25, timestamp: 2.0 },
    { type: 'click', x: 45, y: 25, timestamp: 2.5 },
    { type: 'type', x: 50, y: 40, timestamp: 3.5, text: 'npm install' },
    { type: 'scroll', x: 50, y: 50, timestamp: 5.0, direction: 'down' },
    { type: 'move', x: 70, y: 60, timestamp: 6.0 },
    { type: 'click', x: 70, y: 60, timestamp: 6.8 },
    { type: 'type', x: 70, y: 65, timestamp: 8.0, text: 'package.json' },
    { type: 'move', x: 30, y: 80, timestamp: 9.5 },
    { type: 'click', x: 30, y: 80, timestamp: 10.2 },
    { type: 'scroll', x: 50, y: 50, timestamp: 11.5, direction: 'up' },
  ],
  stats: {
    uiEvents: 47,
    clicks: 12,
    keystrokes: 234,
  },
  mockScreen: {
    title: 'Dashboard - Tribora',
    url: 'app.tribora.com/dashboard',
    elements: [
      { id: 'nav', type: 'nav', label: 'Navigation', x: 0, y: 0, width: 100, height: 8 },
      { id: 'sidebar', type: 'nav', label: 'Sidebar', x: 0, y: 8, width: 15, height: 92 },
      { id: 'search', type: 'input', label: 'Search...', x: 20, y: 12, width: 40, height: 5 },
      { id: 'card1', type: 'card', label: 'Recent Recording', x: 20, y: 25, width: 35, height: 20 },
      { id: 'card2', type: 'card', label: 'Quick Actions', x: 58, y: 25, width: 35, height: 20 },
      { id: 'btn', type: 'button', label: 'New Recording', x: 75, y: 12, width: 15, height: 5 },
    ],
  },
};

// Pre-computed waveform data for visualization (normalized 0-1)
export const mockWaveformData: number[] = Array.from({ length: 100 }, (_, i) => {
  // Create a realistic-looking waveform pattern
  const base = 0.3;
  const speech = Math.sin(i * 0.3) * 0.2 + Math.sin(i * 0.7) * 0.15;
  const noise = Math.random() * 0.1;
  const silence = i % 25 < 5 ? 0.05 : 0; // occasional pauses
  return Math.max(0.05, Math.min(1, base + speech + noise - silence));
});
