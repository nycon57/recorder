/**
 * Mock data for the Transcription Demo component
 */

export interface TranscriptWord {
  word: string;
  startTime: number;
  endTime: number;
  speaker: string;
  confidence: number;
}

export interface Speaker {
  id: string;
  name: string;
  role: string;
  color: string;
}

export interface TranscriptionDemoData {
  duration: number; // seconds
  accuracy: number;
  language: string;
  speakers: Speaker[];
  words: TranscriptWord[];
}

export const transcriptionDemoData: TranscriptionDemoData = {
  duration: 45,
  accuracy: 98.4,
  language: 'English (US)',
  speakers: [
    { id: 'sarah', name: 'Sarah', role: 'Engineer', color: '#00df82' },
    { id: 'mike', name: 'Mike', role: 'PM', color: '#2cc295' },
  ],
  words: [
    { word: 'So', startTime: 0.0, endTime: 0.2, speaker: 'sarah', confidence: 0.99 },
    { word: 'today', startTime: 0.2, endTime: 0.5, speaker: 'sarah', confidence: 0.99 },
    { word: "I'm", startTime: 0.5, endTime: 0.7, speaker: 'sarah', confidence: 0.98 },
    { word: 'going', startTime: 0.7, endTime: 0.9, speaker: 'sarah', confidence: 0.99 },
    { word: 'to', startTime: 0.9, endTime: 1.0, speaker: 'sarah', confidence: 0.99 },
    { word: 'show', startTime: 1.0, endTime: 1.3, speaker: 'sarah', confidence: 0.99 },
    { word: 'you', startTime: 1.3, endTime: 1.5, speaker: 'sarah', confidence: 0.99 },
    { word: 'how', startTime: 1.5, endTime: 1.7, speaker: 'sarah', confidence: 0.99 },
    { word: 'to', startTime: 1.7, endTime: 1.8, speaker: 'sarah', confidence: 0.99 },
    { word: 'set', startTime: 1.8, endTime: 2.0, speaker: 'sarah', confidence: 0.99 },
    { word: 'up', startTime: 2.0, endTime: 2.2, speaker: 'sarah', confidence: 0.99 },
    { word: 'the', startTime: 2.2, endTime: 2.4, speaker: 'sarah', confidence: 0.99 },
    { word: 'deployment', startTime: 2.4, endTime: 3.0, speaker: 'sarah', confidence: 0.97 },
    { word: 'pipeline', startTime: 3.0, endTime: 3.5, speaker: 'sarah', confidence: 0.98 },
    { word: 'for', startTime: 3.5, endTime: 3.7, speaker: 'sarah', confidence: 0.99 },
    { word: 'our', startTime: 3.7, endTime: 3.9, speaker: 'sarah', confidence: 0.99 },
    { word: 'production', startTime: 3.9, endTime: 4.4, speaker: 'sarah', confidence: 0.98 },
    { word: 'environment.', startTime: 4.4, endTime: 5.0, speaker: 'sarah', confidence: 0.97 },
    // Mike's interjection
    { word: 'Perfect,', startTime: 5.5, endTime: 6.0, speaker: 'mike', confidence: 0.99 },
    { word: "that's", startTime: 6.0, endTime: 6.3, speaker: 'mike', confidence: 0.98 },
    { word: 'exactly', startTime: 6.3, endTime: 6.7, speaker: 'mike', confidence: 0.99 },
    { word: 'what', startTime: 6.7, endTime: 6.9, speaker: 'mike', confidence: 0.99 },
    { word: 'we', startTime: 6.9, endTime: 7.0, speaker: 'mike', confidence: 0.99 },
    { word: 'need.', startTime: 7.0, endTime: 7.4, speaker: 'mike', confidence: 0.99 },
    // Sarah continues
    { word: 'First,', startTime: 8.0, endTime: 8.4, speaker: 'sarah', confidence: 0.99 },
    { word: "let's", startTime: 8.4, endTime: 8.6, speaker: 'sarah', confidence: 0.99 },
    { word: 'open', startTime: 8.6, endTime: 8.9, speaker: 'sarah', confidence: 0.99 },
    { word: 'the', startTime: 8.9, endTime: 9.0, speaker: 'sarah', confidence: 0.99 },
    { word: 'Railway', startTime: 9.0, endTime: 9.4, speaker: 'sarah', confidence: 0.96 },
    { word: 'dashboard', startTime: 9.4, endTime: 10.0, speaker: 'sarah', confidence: 0.98 },
    { word: 'and', startTime: 10.0, endTime: 10.2, speaker: 'sarah', confidence: 0.99 },
    { word: 'configure', startTime: 10.2, endTime: 10.7, speaker: 'sarah', confidence: 0.97 },
    { word: 'the', startTime: 10.7, endTime: 10.8, speaker: 'sarah', confidence: 0.99 },
    { word: 'environment', startTime: 10.8, endTime: 11.4, speaker: 'sarah', confidence: 0.98 },
    { word: 'variables.', startTime: 11.4, endTime: 12.0, speaker: 'sarah', confidence: 0.97 },
  ],
};

// Pre-computed waveform data matching the transcript timing
export const transcriptWaveformData: number[] = Array.from({ length: 120 }, (_, i) => {
  const time = i * 0.1; // 100ms per sample

  // Sarah speaking: 0-5s, 8-12s
  // Mike speaking: 5.5-7.5s
  // Silence: 5-5.5s, 7.5-8s

  if ((time >= 0 && time <= 5) || (time >= 8 && time <= 12)) {
    // Sarah - slightly higher energy
    return 0.4 + Math.sin(i * 0.4) * 0.25 + Math.random() * 0.15;
  } else if (time >= 5.5 && time <= 7.5) {
    // Mike - different pattern
    return 0.35 + Math.sin(i * 0.6) * 0.2 + Math.random() * 0.12;
  } else {
    // Silence
    return 0.05 + Math.random() * 0.05;
  }
});

// Helper to get transcript text up to a certain time
export function getTranscriptAtTime(time: number): string {
  return transcriptionDemoData.words
    .filter((w) => w.endTime <= time)
    .map((w) => w.word)
    .join(' ');
}

// Helper to get current word being spoken
export function getCurrentWord(time: number): TranscriptWord | null {
  return transcriptionDemoData.words.find(
    (w) => time >= w.startTime && time <= w.endTime
  ) || null;
}

// Helper to get current speaker
export function getCurrentSpeaker(time: number): Speaker | null {
  const currentWord = getCurrentWord(time);
  if (!currentWord) return null;
  return transcriptionDemoData.speakers.find((s) => s.id === currentWord.speaker) || null;
}
