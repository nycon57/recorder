/* global describe, expect, it */

import {
  buildTriboraVoiceAgentInstructions,
  classifyTranscriptConfidence,
} from '../utils/voice-agent-policy';

describe('voice agent policy', () => {
  it('locks the spoken identity to Tribora and provider-safe behavior', () => {
    const instructions = buildTriboraVoiceAgentInstructions();

    expect(instructions).toContain('You are Tribora');
    expect(instructions).toContain('Never identify as OpenAI');
    expect(instructions).toContain('Never identify as OpenAI, ElevenLabs');
    expect(instructions).toContain('Keep negative and failure spoken replies short');
  });

  it('classifies ellipses, filler, and cut-off fragments as low confidence', () => {
    expect(classifyTranscriptConfidence('...')).toMatchObject({
      lowConfidence: true,
      reason: 'punctuation',
    });
    expect(classifyTranscriptConfidence('um uh')).toMatchObject({
      lowConfidence: true,
      reason: 'filler',
    });
    expect(classifyTranscriptConfidence('click the-')).toMatchObject({
      lowConfidence: true,
      reason: 'fragment',
    });
  });

  it('keeps meaningful commands eligible for normal handling', () => {
    expect(classifyTranscriptConfidence('click the save button')).toEqual({
      lowConfidence: false,
      reason: null,
    });
  });
});
