import { google } from '@ai-sdk/google';
import { generateText } from 'ai';

import type { CompiledMemoryAnswerContext } from '@/lib/services/compiled-memory-answer-context';

export const NO_COMPILED_MEMORY_ANSWER =
  "I don't have compiled knowledge about that yet. I can search the raw recordings if you'd like.";

interface GenerateCompiledMemoryGroundedAnswerArgs {
  question: string;
  answerContext: CompiledMemoryAnswerContext;
}

function buildCompiledMemoryGroundedAnswerSystemPrompt(
  answerContext: CompiledMemoryAnswerContext,
): string {
  const priorTopicInstruction =
    answerContext.priorTopics.length > 0
      ? `\n**USER MEMORY:**\nThe user has previously been shown information about: ${answerContext.priorTopics.join(', ')}. Avoid repeating basics when the answer already covers those topics.\n`
      : '';

  return `You are a helpful AI assistant. Answer the user's question using ONLY the compiled memory below.

**CRITICAL RULES:**
1. ONLY use information explicitly stated in the compiled memory below
2. Compiled memory is the canonical answer layer for this response
3. If sources conflict, prioritize YOUR TEAM'S KNOWLEDGE over VENDOR TRAINING and VENDOR KNOWLEDGE
4. If the answer is not in the compiled memory, respond with: "${NO_COMPILED_MEMORY_ANSWER}"
5. Cite source numbers for every factual claim and keep citations tied to the exact supporting source
6. NEVER mention products, platforms, or concepts not present in the compiled memory
7. Answer questions directly and naturally based on what they asked

**CITATION FORMAT:**
When referencing sources from the Context, use ONLY the citation numbers in brackets, like [1], [2], [3].
DO NOT include the recording title before the citation number.

Example: "The login process involves navigating to the URL [1] and entering credentials [2]."
NOT: "The login process involves navigating to the URL (Recording Title [1]) and entering credentials (Recording Title [2])."
${priorTopicInstruction}
**COMPILED MEMORY:**
${answerContext.context}

**Your Task:**
Answer the user's question using ONLY the compiled memory above. Do not invent or assume anything. Use citation numbers [1], [2], etc. to reference sources.`;
}

export async function generateCompiledMemoryGroundedAnswer(
  args: GenerateCompiledMemoryGroundedAnswerArgs,
): Promise<string> {
  const { question, answerContext } = args;

  if (answerContext.sources.length === 0 || !answerContext.context.trim()) {
    return NO_COMPILED_MEMORY_ANSWER;
  }

  try {
    const result = await generateText({
      model: google('gemini-2.5-flash'),
      system: buildCompiledMemoryGroundedAnswerSystemPrompt(answerContext),
      prompt: question.trim(),
      temperature: 0.2,
      maxOutputTokens: 1024,
    });

    const answer = result.text.trim();
    return answer.length > 0 ? answer : NO_COMPILED_MEMORY_ANSWER;
  } catch (error) {
    console.error(
      '[compiled-memory-answer] grounded answer generation failed:',
      error,
    );
    return NO_COMPILED_MEMORY_ANSWER;
  }
}
