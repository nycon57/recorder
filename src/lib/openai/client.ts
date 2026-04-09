import OpenAI from 'openai';

if (!process.env.OPENAI_API_KEY) {
  throw new Error('Missing OPENAI_API_KEY environment variable');
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  organization: process.env.OPENAI_ORG_ID,
});

// Configuration constants
export const OPENAI_CONFIG = {
  // Transcription (Whisper)
  WHISPER_MODEL: 'whisper-1',

  // Document generation (GPT-5 Nano)
  DOCIFY_MODEL: process.env.DOCIFY_MODEL || 'gpt-5-nano-2025-08-07',
  DOCIFY_MAX_TOKENS: 4000,
  DOCIFY_TEMPERATURE: 0.7,

  // Chat completion (GPT-5 Nano)
  CHAT_MODEL: process.env.CHAT_MODEL || 'gpt-5-nano-2025-08-07',
  CHAT_MAX_TOKENS: 2000,
  CHAT_TEMPERATURE: 0.7,

  // Embeddings (text-embedding-3-small)
  EMBEDDING_MODEL: 'text-embedding-3-small',
  EMBEDDING_DIMENSIONS: 1536,

  // Chunking
  CHUNK_SIZE: 500, // tokens
  CHUNK_OVERLAP: 50, // tokens
};

// Prompt templates
export const PROMPTS = {
  DOCIFY: `You are an expert technical writer. Convert the following transcript into a well-structured, readable document in Markdown format.

Guidelines:
- Create a clear hierarchy with headings (##, ###)
- Extract key points and organize them logically
- Preserve important details, especially technical terms and steps
- Use bullet points and numbered lists where appropriate
- Include code blocks if code is mentioned (use \`\`\` with language tags)
- Write in a professional, clear style
- Add a brief summary at the beginning
- Remove filler words and verbal tics

Transcript:
{transcript}

Output the structured Markdown document:`,

  CHAT_SYSTEM: `You are a helpful AI assistant that answers questions based on the provided knowledge base of recordings and documents.

Instructions:
- Answer questions using ONLY the information provided in the context below
- If you don't know the answer or the context doesn't contain relevant information, say so
- Cite sources by referencing the recording titles when possible
- Be concise but thorough
- If the question is unclear, ask for clarification
- Format your response in Markdown

Context from knowledge base:
{context}`,

  CHAT_USER: `Question: {query}

Please provide an answer based on the context provided.`,
} as const;
