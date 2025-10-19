/**
 * Single Conversation API
 *
 * Get, update, or delete a specific conversation.
 */

import { NextRequest } from 'next/server';

import { apiHandler, requireOrg, successResponse, errors } from '@/lib/utils/api';
import { getConversationHistory } from '@/lib/services/rag-google';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/conversations/[id]
 * Get conversation with message history
 */
export const GET = apiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { orgId } = await requireOrg();
    const { id: conversationId } = await params;

    const supabase = await createClient();

    // Verify conversation belongs to org
    const { data: conversation, error: convError } = await supabase
      .from('chat_conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('org_id', orgId)
      .single();

    if (convError || !conversation) {
      return errors.notFound('Conversation not found');
    }

    // Get message history
    const messages = await getConversationHistory(conversationId, orgId);

    return successResponse({
      conversation: {
        id: conversation.id,
        title: conversation.title,
        createdAt: conversation.created_at,
        updatedAt: conversation.updated_at,
      },
      messages,
    });
  }
);

/**
 * DELETE /api/conversations/[id]
 * Delete a conversation and all its messages
 */
export const DELETE = apiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { orgId } = await requireOrg();
    const { id: conversationId } = await params;

    const supabase = await createClient();

    // Delete conversation (messages cascade)
    const { error } = await supabase
      .from('chat_conversations')
      .delete()
      .eq('id', conversationId)
      .eq('org_id', orgId);

    if (error) {
      return errors.internal('Failed to delete conversation');
    }

    return successResponse({ deleted: true });
  }
);

/**
 * PATCH /api/conversations/[id]
 * Update conversation title
 */
export const PATCH = apiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { orgId } = await requireOrg();
    const { id: conversationId } = await params;
    const body = await request.json();
    const { title } = body;

    if (!title || typeof title !== 'string') {
      return errors.badRequest('Title is required');
    }

    const supabase = await createClient();

    const { data: conversation, error } = await supabase
      .from('chat_conversations')
      .update({ title })
      .eq('id', conversationId)
      .eq('org_id', orgId)
      .select()
      .single();

    if (error || !conversation) {
      return errors.internal('Failed to update conversation');
    }

    return successResponse({ conversation });
  }
);
