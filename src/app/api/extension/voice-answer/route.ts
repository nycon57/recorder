import { NextRequest, after } from 'next/server';
import { GoogleGenAI } from '@google/genai';

import {
  sanitizePageContextForNetwork,
  type PageContext,
  type ExtensionVoiceAnswerRequest,
  type ExtensionVoiceAnswerResponse,
} from '@tribora/shared';
import {
  buildExtensionCompiledMemoryPrompt,
  resolveCompiledMemoryAnswerContext,
  summarizeCompiledMemoryAnswerObservability,
} from '@/lib/services/compiled-memory-answer-context';
import { parseExtensionVoiceAnswer } from '@/lib/services/extension-voice-answer';
import {
  buildKnowledgeExtensionQueryTelemetry,
  recordKnowledgeTelemetryEvent,
} from '@/lib/services/knowledge-telemetry';
import type { Json } from '@/lib/types/database';
import { resolveCustomerOrgForVendor } from '@/lib/services/vendor-customers';
import { errors } from '@/lib/utils/api';
import { requireApiKeyOrSession } from '@/lib/utils/api-key-auth';
import { CORS_HEADERS, corsPreflightResponse } from '@/lib/utils/cors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

let genaiClient: GoogleGenAI | null = null;

function getGenAIClient(): GoogleGenAI {
  if (!genaiClient) {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY environment variable is not set');
    }
    genaiClient = new GoogleGenAI({ apiKey });
  }
  return genaiClient;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function resolveAppScreen(context: PageContext): { app: string; screen: string } {
  const appSignature = context.appSignature || `${context.app}:${context.screen}`;
  const colonIdx = appSignature.indexOf(':');
  return {
    app:
      colonIdx !== -1
        ? appSignature.slice(0, colonIdx).toLowerCase()
        : appSignature.toLowerCase(),
    screen:
      colonIdx !== -1
        ? appSignature.slice(colonIdx + 1).toLowerCase()
        : (context.screen || 'unknown').toLowerCase(),
  };
}

function normalizePromptElements(
  context: PageContext,
): Array<{ selector: string; label: string }> {
  return (context.interactiveElements ?? []).map((element) => ({
    selector: element.selector,
    label: element.label,
  }));
}

function hasDomOnlyGuidanceContext(context: PageContext): boolean {
  return (
    (context.interactiveElements?.length ?? 0) > 0 ||
    (context.regions?.length ?? 0) > 0 ||
    (context.snippets?.length ?? 0) > 0 ||
    (context.forms?.length ?? 0) > 0 ||
    (context.tables?.length ?? 0) > 0 ||
    (context.dialogs?.length ?? 0) > 0 ||
    Boolean(context.pageSummary)
  );
}

function jsonResponse(body: ExtensionVoiceAnswerResponse, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
  });
}

export function OPTIONS() {
  return corsPreflightResponse();
}

export async function POST(request: NextRequest) {
  const requestStartTime = Date.now();
  let authCtx: Awaited<ReturnType<typeof requireApiKeyOrSession>>;
  try {
    authCtx = await requireApiKeyOrSession(request, 'query');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'Unauthorized') return errors.unauthorized();
    if (message === 'Rate limit exceeded') return errors.rateLimitExceeded();
    return errors.forbidden();
  }

  let body: ExtensionVoiceAnswerRequest;
  try {
    const rawBody = await request.json();
    body = isRecord(rawBody)
      ? (rawBody as unknown as ExtensionVoiceAnswerRequest)
      : ({} as ExtensionVoiceAnswerRequest);
  } catch {
    return errors.badRequest('Invalid JSON body');
  }

  const question = typeof body.question === 'string' ? body.question.trim() : '';
  if (!question) {
    return errors.badRequest('question is required');
  }

  const context = isRecord(body.context)
    ? sanitizePageContextForNetwork(body.context)
    : null;
  if (!context?.url || !context.appSignature) {
    return errors.badRequest(
      'context.url and context.appSignature are required',
    );
  }

  let orgId = authCtx.orgId;
  const userId = authCtx.authMethod === 'session' ? authCtx.userId : authCtx.keyId;
  if (authCtx.authMethod === 'api_key') {
    const customerOrgId =
      typeof body.customerOrgId === 'string' && body.customerOrgId.trim()
        ? body.customerOrgId.trim()
        : null;
    if (!customerOrgId) {
      return errors.badRequest('customerOrgId is required for API-key recall');
    }

    try {
      const customerOrg = await resolveCustomerOrgForVendor(
        authCtx.orgId,
        customerOrgId,
      );
      if (!customerOrg) return errors.forbidden();
      orgId = customerOrg.id;
    } catch (error) {
      console.error('[extension/voice-answer] customer scope failed:', error);
      return errors.forbidden();
    }
  }

  const { app, screen } = resolveAppScreen(context);
  const answerContext = await resolveCompiledMemoryAnswerContext({
    orgId,
    userId,
    question,
    app,
    screen,
  });
  const hadOrgKnowledge = answerContext.sources.some(
    (source) => source.layer === 'org',
  );
  const hadVendorKnowledge = answerContext.sources.some(
    (source) => source.layer !== 'org',
  );
  const sharedVendorTelemetry =
    summarizeCompiledMemoryAnswerObservability(answerContext);

  after(async () => {
    const telemetryPayload = buildKnowledgeExtensionQueryTelemetry({
      orgId,
      userId,
      app,
      screen,
      hadOrgKnowledge,
      hadVendorKnowledge,
      vendorOrgId:
        authCtx.authMethod === 'api_key' ? authCtx.orgId : null,
      customerOrgId:
        authCtx.authMethod === 'api_key' && orgId !== authCtx.orgId
          ? orgId
          : null,
      knowledgeMode: hadOrgKnowledge
        ? 'org_backed'
        : hadVendorKnowledge
          ? 'vendor_backed'
          : 'dom_only',
      responseLatencyMs: Date.now() - requestStartTime,
      asOf: null,
      ...sharedVendorTelemetry,
    });

    await recordKnowledgeTelemetryEvent({
      type: 'knowledge.extension.query.outcome',
      payload: {
        ...telemetryPayload,
        channel: 'voice_answer',
      } as unknown as Json,
    });
  });

  if (answerContext.sources.length === 0 && !hasDomOnlyGuidanceContext(context)) {
    return jsonResponse({
      text: `I don't have specific documentation for ${app} ${screen} yet.`,
      citations: [],
      elementRefs: [],
      knowledgeMode: 'dom_only',
      sourceCount: 0,
    });
  }

  const fusionPrompt = buildExtensionCompiledMemoryPrompt({
    app,
    screen,
    question,
    elements: normalizePromptElements(context),
    answerContext,
    pageContext: context,
  });

  try {
    const genai = getGenAIClient();
    const result = await genai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: fusionPrompt,
      config: {
        temperature: 0.4,
        maxOutputTokens: 900,
      },
    });
    const rawText =
      typeof result.text === 'string' && result.text.trim()
        ? result.text
        : "I couldn't generate a voice answer from the available knowledge.";

    return jsonResponse(
      parseExtensionVoiceAnswer({
        rawText,
        answerContext,
      }),
    );
  } catch (error) {
    console.error('[extension/voice-answer] generation failed:', error);
    return jsonResponse(
      {
        text: 'I had trouble retrieving the knowledge answer. Please try again.',
        citations: [],
        elementRefs: [],
        knowledgeMode: 'dom_only',
        sourceCount: answerContext.sources.length,
      },
      500,
    );
  }
}
