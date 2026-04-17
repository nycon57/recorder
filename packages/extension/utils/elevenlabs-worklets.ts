export interface ElevenLabsWorkletPaths {
  rawAudioProcessor: string;
  audioConcatProcessor: string;
}

export function getElevenLabsWorkletPaths(
  getUrl: (path: string) => string,
): ElevenLabsWorkletPaths {
  return {
    rawAudioProcessor: getUrl('assets/elevenlabs/raw-audio-processor.js'),
    audioConcatProcessor: getUrl('assets/elevenlabs/audio-concat-processor.js'),
  };
}
