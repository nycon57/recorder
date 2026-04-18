import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireAdmin,
  successResponse,
  errors,
} from '@/lib/utils/api';
import {
  listKnowledgeTelemetryEvents,
  summarizeKnowledgeTelemetryEvents,
  type KnowledgeTelemetryEventType,
  type KnowledgeTelemetrySince,
} from '@/lib/services/knowledge-telemetry';

const VALID_SINCE = new Set<KnowledgeTelemetrySince>([
  '1h',
  '24h',
  '7d',
  '30d',
  'all',
]);

const VALID_TYPES = new Set<KnowledgeTelemetryEventType>([
  'extension.context.checked',
  'knowledge.chat.outcome',
  'knowledge.extension.query.outcome',
  'knowledge.review.outcome',
]);

export const runtime = 'nodejs';

export const GET = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireAdmin();
  const { searchParams } = new URL(request.url);

  const rawSince = searchParams.get('since') ?? '24h';
  if (!VALID_SINCE.has(rawSince as KnowledgeTelemetrySince)) {
    return errors.badRequest(
      `Invalid since "${rawSince}". Must be one of: ${Array.from(VALID_SINCE).join(', ')}`
    );
  }
  const since = rawSince as KnowledgeTelemetrySince;

  const rawLimit = Number.parseInt(searchParams.get('limit') ?? '100', 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 10), 200) : 100;

  const rawType = searchParams.get('type') ?? 'all';
  if (rawType !== 'all' && !VALID_TYPES.has(rawType as KnowledgeTelemetryEventType)) {
    return errors.badRequest(
      `Invalid type "${rawType}". Must be one of: all, ${Array.from(VALID_TYPES).join(', ')}`
    );
  }
  const type = rawType === 'all' ? null : (rawType as KnowledgeTelemetryEventType);

  const { events } = await listKnowledgeTelemetryEvents({
    orgId,
    since,
    limit,
  });

  const filteredEvents = type ? events.filter((event) => event.type === type) : events;
  const summary = summarizeKnowledgeTelemetryEvents(filteredEvents);

  return successResponse({
    filters: {
      since,
      limit,
      type: type ?? 'all',
    },
    summary,
    events: filteredEvents.slice(0, limit),
  });
});
