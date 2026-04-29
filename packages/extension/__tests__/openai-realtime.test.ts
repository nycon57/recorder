/* global describe, expect, it */

import {
  buildOpenAIRealtimeFunctionOutputEvent,
  buildOpenAIRealtimeSessionConfig,
  extractOpenAIRealtimeToolCalls,
} from '../utils/openai-realtime';

describe('OpenAI Realtime extension helpers', () => {
  it('builds a Tribora-owned tool session config', () => {
    const session = buildOpenAIRealtimeSessionConfig({
      model: 'gpt-realtime-test',
      voice: 'sage',
    });

    expect(session.model).toBe('gpt-realtime-test');
    expect(session.output_modalities).toEqual(['audio']);
    expect(session.instructions).toEqual(
      expect.stringContaining('You are Tribora'),
    );
    expect(session.instructions).toEqual(
      expect.stringContaining('Never identify as OpenAI'),
    );
    expect(session.audio).toMatchObject({
      input: {
        turn_detection: {
          type: 'server_vad',
          create_response: true,
        },
      },
      output: {
        voice: 'sage',
      },
    });

    const tools = session.tools as Array<{
      name: string;
      parameters: { additionalProperties?: boolean };
    }>;
    expect(tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        'get_page_context',
        'capture_screenshot',
        'click_element',
        'type_in_element',
        'press_key',
      ]),
    );
    expect(
      tools.every((tool) => tool.parameters.additionalProperties === false),
    ).toBe(true);
  });

  it('extracts function calls from output item and response done events', () => {
    expect(
      extractOpenAIRealtimeToolCalls({
        type: 'response.output_item.done',
        item: {
          type: 'function_call',
          call_id: 'call-1',
          name: 'click_element',
          arguments: '{"selector":"#save"}',
        },
      }),
    ).toEqual([
      {
        callId: 'call-1',
        name: 'click_element',
        args: { selector: '#save' },
      },
    ]);

    expect(
      extractOpenAIRealtimeToolCalls({
        type: 'response.done',
        response: {
          output: [
            {
              type: 'message',
            },
            {
              type: 'function_call',
              call_id: 'call-2',
              name: 'press_key',
              arguments: '{"key":"Enter"}',
            },
          ],
        },
      }),
    ).toEqual([
      {
        callId: 'call-2',
        name: 'press_key',
        args: { key: 'Enter' },
      },
    ]);
  });

  it('serializes tool output as a Realtime function_call_output item', () => {
    expect(
      buildOpenAIRealtimeFunctionOutputEvent('call-1', {
        ok: true,
        result: 'clicked',
      }),
    ).toEqual({
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: 'call-1',
        output: JSON.stringify({ ok: true, result: 'clicked' }),
      },
    });
  });
});
