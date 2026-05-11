import { describe, expect, it } from '@jest/globals';

import {
  buildOpenAIRealtimeSessionConfig,
  normalizeExtensionVoiceRuntime,
  parseExtensionVoiceRuntime,
} from '../voice-runtime';

describe('voice runtime contract', () => {
  it('defaults to ElevenLabs and accepts the OpenAI pilot runtime', () => {
    expect(normalizeExtensionVoiceRuntime(undefined)).toBe('elevenlabs');
    expect(parseExtensionVoiceRuntime('openai-realtime')).toBe(
      'openai-realtime',
    );
    expect(parseExtensionVoiceRuntime('unknown')).toBeNull();
  });

  it('builds the Realtime 2 pilot config with Tribora tools', () => {
    const session = buildOpenAIRealtimeSessionConfig();

    expect(session).toMatchObject({
      type: 'realtime',
      model: 'gpt-realtime-2',
      reasoning: { effort: 'low' },
      tool_choice: 'auto',
    });
    expect(
      (session.tools as Array<{ name: string }>).map((tool) => tool.name),
    ).toEqual(expect.arrayContaining(['answer_with_knowledge', 'press_key']));
  });
});
