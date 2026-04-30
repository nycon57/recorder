import { supabaseAdmin } from '@/lib/supabase/admin';

export interface ChatConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
  metadata?: {
    sources?: unknown;
    tokensUsed?: number | null;
  };
}

export async function createConversation(
  orgId: string,
  userId: string,
  title?: string,
): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('conversations')
    .insert({
      org_id: orgId,
      user_id: userId,
      title: title || 'New Conversation',
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to create conversation: ${error?.message ?? 'missing row'}`,
    );
  }

  return data.id;
}

export async function getConversationHistory(
  conversationId: string,
  orgId: string,
  options: {
    limit?: number;
    offset?: number;
    includeAll?: boolean;
  } = {},
): Promise<ChatConversationMessage[]> {
  const { limit = 20, offset = 0, includeAll = false } = options;

  let query = supabaseAdmin
    .from('chat_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false });

  if (!includeAll) {
    query = query.range(offset, offset + limit - 1);
  }

  const { data: messages, error } = await query;

  if (error) {
    throw new Error(`Failed to get conversation history: ${error.message}`);
  }

  return ((messages ?? []) as Array<{
    id: string;
    role: 'user' | 'assistant';
    content: unknown;
    created_at: string;
    sources?: unknown;
    metadata?: { tokensUsed?: number | null } | null;
  }>)
    .reverse()
    .map((message) => ({
      id: message.id,
      role: message.role,
      content:
        typeof message.content === 'string'
          ? message.content
          : JSON.stringify(message.content),
      createdAt: new Date(message.created_at),
      metadata: {
        sources: message.sources,
        tokensUsed: message.metadata?.tokensUsed ?? null,
      },
    }));
}

export async function listConversations(
  orgId: string,
  userId: string,
): Promise<
  Array<{
    id: string;
    title: string;
    lastMessageAt: Date;
    messageCount: number;
  }>
> {
  const { data: conversations, error } = await supabaseAdmin
    .from('conversations')
    .select(
      `
      id,
      title,
      updated_at,
      chat_messages (count)
    `,
    )
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list conversations: ${error.message}`);
  }

  return ((conversations ?? []) as Array<{
    id: string;
    title: string;
    updated_at: string;
    chat_messages?: Array<{ count?: number | null }> | null;
  }>).map((conversation) => ({
    id: conversation.id,
    title: conversation.title,
    lastMessageAt: new Date(conversation.updated_at),
    messageCount: conversation.chat_messages?.[0]?.count ?? 0,
  }));
}
