export const EXTENSION_VOICE_RUNTIMES = [
  'elevenlabs',
  'openai-realtime',
] as const;

export type ExtensionVoiceRuntime = (typeof EXTENSION_VOICE_RUNTIMES)[number];

export type OpenAIRealtimeReasoningEffort = 'low' | 'medium' | 'high';

export const DEFAULT_EXTENSION_VOICE_RUNTIME: ExtensionVoiceRuntime =
  'elevenlabs';
export const DEFAULT_OPENAI_REALTIME_MODEL = 'gpt-realtime-2';
export const DEFAULT_OPENAI_REALTIME_VOICE = 'marin';
export const DEFAULT_OPENAI_REALTIME_REASONING_EFFORT: OpenAIRealtimeReasoningEffort =
  'low';

export type OpenAIRealtimeToolName =
  | 'get_page_context'
  | 'answer_with_knowledge'
  | 'search_page_elements'
  | 'inspect_element'
  | 'inspect_page_region'
  | 'capture_screenshot'
  | 'highlight_element'
  | 'highlight_elements'
  | 'hover_element'
  | 'click_element'
  | 'type_in_element'
  | 'scroll_to_element'
  | 'press_key';

export interface OpenAIRealtimeToolCall {
  callId: string;
  name: string;
  args: Record<string, unknown>;
}

type JsonSchema = Record<string, unknown>;

export interface OpenAIRealtimeFunctionTool {
  type: 'function';
  name: OpenAIRealtimeToolName;
  description: string;
  parameters: JsonSchema;
}

export interface ElevenLabsVoiceSessionPayload {
  runtime: 'elevenlabs';
  signedUrl: string;
  conversationId?: string | null;
}

export interface OpenAIRealtimeVoiceSessionPayload {
  runtime: 'openai-realtime';
  clientSecret: string;
  model: string;
  voice: string;
  reasoningEffort: OpenAIRealtimeReasoningEffort;
  expiresAt?: string | null;
}

export type ExtensionVoiceSessionPayload =
  | ElevenLabsVoiceSessionPayload
  | OpenAIRealtimeVoiceSessionPayload;

const IDENTITY_INSTRUCTIONS = [
  'You are Tribora, the voice assistant for the current browser tab.',
  'If asked who you are, say you are Tribora. Never identify as OpenAI, ElevenLabs, Gemini, GPT, a model, or a provider.',
  'Treat silence, filler words, ellipses, cut-off words, and unclear transcript fragments as low confidence. Do not run tools or give a fallback monologue for those inputs; if you must speak, say briefly that you did not catch it.',
  'Use page tools for page inspection and actions. Do not claim an action succeeded unless a tool result explicitly verifies it.',
  'Use answer_with_knowledge for substantive knowledge questions such as what something means, how the user should do a workflow, what their team or docs recommend, or why a setting matters. Use visible-page tools for immediate inspection and actions on the current page.',
  'When a target is unavailable, verification is ambiguous, or the page changes before confirmation, say that uncertainty plainly in one short sentence.',
  'Keep negative and failure spoken replies short.',
];

function objectSchema(
  properties: Record<string, JsonSchema>,
  required: string[] = [],
): JsonSchema {
  return {
    type: 'object',
    properties,
    required,
    additionalProperties: false,
  };
}

const selectorProperty = {
  type: 'string',
  description: 'CSS selector from the current page context.',
};

export function parseExtensionVoiceRuntime(
  value: unknown,
): ExtensionVoiceRuntime | null {
  return EXTENSION_VOICE_RUNTIMES.includes(value as ExtensionVoiceRuntime)
    ? (value as ExtensionVoiceRuntime)
    : null;
}

export function normalizeExtensionVoiceRuntime(
  value: unknown,
): ExtensionVoiceRuntime {
  return parseExtensionVoiceRuntime(value) ?? DEFAULT_EXTENSION_VOICE_RUNTIME;
}

export function normalizeOpenAIRealtimeReasoningEffort(
  value: unknown,
): OpenAIRealtimeReasoningEffort {
  return value === 'medium' || value === 'high'
    ? value
    : DEFAULT_OPENAI_REALTIME_REASONING_EFFORT;
}

export function buildTriboraVoiceAgentInstructions(): string {
  return IDENTITY_INSTRUCTIONS.join(' ');
}

export function buildOpenAIRealtimeToolDefinitions(): OpenAIRealtimeFunctionTool[] {
  return [
    {
      type: 'function',
      name: 'get_page_context',
      description:
        'Read the current page context, visible controls, and Tribora knowledge match metadata before deciding what to do.',
      parameters: objectSchema({}),
    },
    {
      type: 'function',
      name: 'answer_with_knowledge',
      description:
        'Answer a substantive user question using Tribora knowledge, current page context, and cited source metadata.',
      parameters: objectSchema(
        {
          question: {
            type: 'string',
            description: 'The user question that requires Tribora knowledge.',
          },
        },
        ['question'],
      ),
    },
    {
      type: 'function',
      name: 'capture_screenshot',
      description:
        'Capture the visible browser tab when visual page evidence is required.',
      parameters: objectSchema({}),
    },
    {
      type: 'function',
      name: 'search_page_elements',
      description:
        'Search the current DOM-first page understanding for visible controls by label, text, role, type, or surface.',
      parameters: objectSchema(
        {
          query: {
            type: 'string',
            description: 'User-facing text, label, role, or surface to find.',
          },
          limit: { type: 'number' },
        },
        ['query'],
      ),
    },
    {
      type: 'function',
      name: 'inspect_element',
      description:
        'Inspect one current-page element by selector and return sanitized state, bounds, labels, and region metadata without raw field values.',
      parameters: objectSchema({ selector: selectorProperty }, ['selector']),
    },
    {
      type: 'function',
      name: 'inspect_page_region',
      description:
        'Inspect a page region by selector or region id, including sanitized snippets and visible controls in that region.',
      parameters: objectSchema(
        {
          selector: selectorProperty,
          regionId: { type: 'string' },
        },
        [],
      ),
    },
    {
      type: 'function',
      name: 'highlight_element',
      description:
        'Point at, highlight, or pulse one visible element so the user can see the target.',
      parameters: objectSchema(
        {
          selector: selectorProperty,
          label: { type: 'string' },
          action: {
            type: 'string',
            enum: ['point', 'highlight', 'pulse'],
          },
        },
        ['selector'],
      ),
    },
    {
      type: 'function',
      name: 'highlight_elements',
      description:
        'Point at, highlight, or pulse multiple visible page elements.',
      parameters: objectSchema(
        {
          targets: {
            type: 'array',
            items: objectSchema(
              {
                selector: selectorProperty,
                label: { type: 'string' },
                action: {
                  type: 'string',
                  enum: ['point', 'highlight', 'pulse'],
                },
              },
              ['selector'],
            ),
          },
        },
        ['targets'],
      ),
    },
    {
      type: 'function',
      name: 'hover_element',
      description: 'Move hover/focus intent to one visible page element.',
      parameters: objectSchema({ selector: selectorProperty }, ['selector']),
    },
    {
      type: 'function',
      name: 'click_element',
      description:
        'Click one visible page element after it has been identified from page context.',
      parameters: objectSchema({ selector: selectorProperty }, ['selector']),
    },
    {
      type: 'function',
      name: 'type_in_element',
      description:
        'Type text into a visible text input, textarea, or editable control.',
      parameters: objectSchema(
        {
          selector: selectorProperty,
          text: { type: 'string' },
          clear: { type: 'boolean' },
        },
        ['selector', 'text'],
      ),
    },
    {
      type: 'function',
      name: 'scroll_to_element',
      description: 'Scroll a visible page element into view.',
      parameters: objectSchema({ selector: selectorProperty }, ['selector']),
    },
    {
      type: 'function',
      name: 'press_key',
      description:
        'Press a keyboard key or shortcut against the active element or a selected target.',
      parameters: objectSchema(
        {
          key: { type: 'string' },
          selector: selectorProperty,
          modifiers: {
            type: 'array',
            items: { type: 'string' },
          },
          repeat: { type: 'number' },
        },
        ['key'],
      ),
    },
  ];
}

export function buildOpenAIRealtimeSessionConfig(
  args: {
    model?: string;
    voice?: string;
    reasoningEffort?: OpenAIRealtimeReasoningEffort;
  } = {},
): Record<string, unknown> {
  const model = args.model?.trim() || DEFAULT_OPENAI_REALTIME_MODEL;
  const voice = args.voice?.trim() || DEFAULT_OPENAI_REALTIME_VOICE;
  const reasoningEffort =
    args.reasoningEffort ?? DEFAULT_OPENAI_REALTIME_REASONING_EFFORT;

  return {
    type: 'realtime',
    model,
    instructions: buildTriboraVoiceAgentInstructions(),
    tool_choice: 'auto',
    tools: buildOpenAIRealtimeToolDefinitions(),
    output_modalities: ['audio'],
    reasoning: {
      effort: reasoningEffort,
    },
    audio: {
      input: {
        transcription: {
          model: 'gpt-4o-mini-transcribe',
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 200,
          create_response: true,
        },
      },
      output: {
        voice,
      },
    },
  };
}

function parseToolArgs(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    if (!value.trim()) return {};
    try {
      const parsed = JSON.parse(value) as unknown;
      return parseToolArgs(parsed);
    } catch {
      return {};
    }
  }

  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function parseFunctionCallItem(item: unknown): OpenAIRealtimeToolCall | null {
  if (typeof item !== 'object' || item === null) return null;

  const payload = item as Record<string, unknown>;
  if (payload.type !== 'function_call') return null;
  if (typeof payload.name !== 'string' || !payload.name.trim()) return null;

  const callId =
    typeof payload.call_id === 'string'
      ? payload.call_id
      : typeof payload.id === 'string'
        ? payload.id
        : null;

  if (!callId) return null;

  return {
    callId,
    name: payload.name,
    args: parseToolArgs(payload.arguments),
  };
}

export function extractOpenAIRealtimeToolCalls(
  event: unknown,
): OpenAIRealtimeToolCall[] {
  if (typeof event !== 'object' || event === null) return [];

  const payload = event as Record<string, unknown>;
  const calls: OpenAIRealtimeToolCall[] = [];

  if (payload.type === 'response.output_item.done') {
    const call = parseFunctionCallItem(payload.item);
    if (call) calls.push(call);
  }

  if (payload.type === 'response.done') {
    const response = payload.response as Record<string, unknown> | undefined;
    const output = Array.isArray(response?.output) ? response.output : [];
    for (const item of output) {
      const call = parseFunctionCallItem(item);
      if (call) calls.push(call);
    }
  }

  return calls;
}

export function buildOpenAIRealtimeFunctionOutputEvent(
  callId: string,
  output: unknown,
): Record<string, unknown> {
  return {
    type: 'conversation.item.create',
    item: {
      type: 'function_call_output',
      call_id: callId,
      output: JSON.stringify(output),
    },
  };
}

export function buildOpenAIRealtimeContextUpdateEvent(
  text: string,
): Record<string, unknown> {
  return {
    type: 'conversation.item.create',
    item: {
      type: 'message',
      role: 'system',
      content: [
        {
          type: 'input_text',
          text,
        },
      ],
    },
  };
}
