/**
 * Conversations API
 *
 * Manage chat conversations (list, create, delete).
 */

import { NextRequest } from 'next/server';

import { apiHandler, requireOrg, successResponse } from '@/lib/utils/api';
import { listConversations, createConversation } from '@/lib/services/rag';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/conversations
 * List user's conversations
 */
export const GET = apiHandler(async (request: NextRequest) => {
  const { orgId, userId } = await requireOrg();

  const conversations = await listConversations(orgId, userId);

  return successResponse({ conversations });
});

/**
 * POST /api/conversations
 * Create new conversation
 */
export const POST = apiHandler(async (request: NextRequest) => {
  const { orgId, userId } = await requireOrg();
  const body = await request.json();
  const { title } = body;

  const conversationId = await createConversation(orgId, userId, title);

  return successResponse({ conversationId });
});
