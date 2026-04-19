type EmbedContentResult = {
  embeddings: Array<{
    values: number[];
  }>;
};

type GenerateContentResult = {
  text?: string;
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

function buildTextResult(text: string): GenerateContentResult {
  return {
    text,
    candidates: [
      {
        content: {
          parts: [{ text }],
        },
      },
    ],
  };
}

export class GoogleGenAI {
  constructor(_config?: { apiKey?: string }) {}

  models = {
    embedContent: async (): Promise<EmbedContentResult> => ({
      embeddings: [{ values: [0.1, 0.2, 0.3] }],
    }),
    generateContent: async (): Promise<GenerateContentResult> =>
      buildTextResult('Mock GoogleGenAI response'),
    generateContentStream: async function* () {
      yield buildTextResult('Mock GoogleGenAI stream response');
    },
  };
}
