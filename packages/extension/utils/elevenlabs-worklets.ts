import audioConcatProcessorUrl from '../assets/elevenlabs/audio-concat-processor.js?url';
import rawAudioProcessorUrl from '../assets/elevenlabs/raw-audio-processor.js?url';

export interface ElevenLabsWorkletPaths {
  rawAudioProcessor: string;
  audioConcatProcessor: string;
}

function toRuntimePath(assetUrl: string): string {
  return assetUrl.startsWith('/') ? assetUrl.slice(1) : assetUrl;
}

export function getElevenLabsWorkletPaths(
  getUrl: (path: string) => string,
): ElevenLabsWorkletPaths {
  return {
    rawAudioProcessor: getUrl(toRuntimePath(rawAudioProcessorUrl)),
    audioConcatProcessor: getUrl(toRuntimePath(audioConcatProcessorUrl)),
  };
}
