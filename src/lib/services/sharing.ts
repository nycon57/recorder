/**
 * Sharing Service
 *
 * Manages public and password-protected shares for recordings and conversations.
 */

import { randomBytes } from 'crypto';

import bcrypt from 'bcryptjs';

import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@/lib/supabase/admin';

export interface ShareLink {
  id: string;
  shareId: string;
  resourceType: 'recording' | 'conversation';
  resourceId: string;
  shareType: 'public' | 'password';
  expiresAt?: Date;
  viewCount: number;
  maxViews?: number;
  createdBy: string;
  createdAt: Date;
}

export interface ShareOptions {
  shareType: 'public' | 'password';
  password?: string;
  expiresAt?: Date;
  maxViews?: number;
}

/**
 * Generate unique share ID
 */
function generateShareId(): string {
  return randomBytes(16).toString('base64url');
}

/**
 * Hash password for storage
 */
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Verify password against hash
 */
export async function verifySharePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Create a share link for a recording
 */
export async function createRecordingShare(
  recordingId: string,
  orgId: string,
  userId: string,
  options: ShareOptions
): Promise<ShareLink> {
  const supabase = createAdminClient();

  // Verify content exists and belongs to org
  const { data: content, error: contentError } = await supabase
    .from('content')
    .select('id')
    .eq('id', recordingId)
    .eq('org_id', orgId)
    .single();

  if (contentError || !content) {
    throw new Error('Content not found');
  }

  // Generate share ID
  const shareId = generateShareId();

  // Hash password if provided
  let passwordHash: string | undefined;
  if (options.shareType === 'password' && options.password) {
    passwordHash = await hashPassword(options.password);
  }

  // Create share record
  const { data: share, error: shareError } = await supabase
    .from('shares')
    .insert({
      share_id: shareId,
      resource_type: 'recording',
      resource_id: recordingId,
      org_id: orgId,
      share_type: options.shareType,
      password_hash: passwordHash,
      expires_at: options.expiresAt?.toISOString(),
      max_views: options.maxViews,
      created_by: userId,
    })
    .select()
    .single();

  if (shareError) {
    throw new Error(`Failed to create share: ${shareError.message}`);
  }

  return {
    id: share.id,
    shareId: share.share_id,
    resourceType: share.resource_type,
    resourceId: share.resource_id,
    shareType: share.share_type,
    expiresAt: share.expires_at ? new Date(share.expires_at) : undefined,
    viewCount: share.view_count,
    maxViews: share.max_views,
    createdBy: share.created_by,
    createdAt: new Date(share.created_at),
  };
}

/**
 * Create a share link for a conversation
 */
export async function createConversationShare(
  conversationId: string,
  orgId: string,
  userId: string,
  options: ShareOptions
): Promise<ShareLink> {
  const supabase = createAdminClient();

  // Verify conversation exists and belongs to org
  const { data: conversation, error: conversationError } = await supabase
    .from('chat_conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('org_id', orgId)
    .single();

  if (conversationError || !conversation) {
    throw new Error('Conversation not found');
  }

  // Generate share ID
  const shareId = generateShareId();

  // Hash password if provided
  let passwordHash: string | undefined;
  if (options.shareType === 'password' && options.password) {
    passwordHash = await hashPassword(options.password);
  }

  // Create share record
  const { data: share, error: shareError } = await supabase
    .from('shares')
    .insert({
      share_id: shareId,
      resource_type: 'conversation',
      resource_id: conversationId,
      org_id: orgId,
      share_type: options.shareType,
      password_hash: passwordHash,
      expires_at: options.expiresAt?.toISOString(),
      max_views: options.maxViews,
      created_by: userId,
    })
    .select()
    .single();

  if (shareError) {
    throw new Error(`Failed to create share: ${shareError.message}`);
  }

  return {
    id: share.id,
    shareId: share.share_id,
    resourceType: share.resource_type,
    resourceId: share.resource_id,
    shareType: share.share_type,
    expiresAt: share.expires_at ? new Date(share.expires_at) : undefined,
    viewCount: share.view_count,
    maxViews: share.max_views,
    createdBy: share.created_by,
    createdAt: new Date(share.created_at),
  };
}

/**
 * Get share by share ID
 */
export async function getShare(shareId: string): Promise<ShareLink | null> {
  const supabase = createAdminClient();

  const { data: share, error } = await supabase
    .from('shares')
    .select('*')
    .eq('share_id', shareId)
    .single();

  if (error || !share) {
    return null;
  }

  return {
    id: share.id,
    shareId: share.share_id,
    resourceType: share.resource_type,
    resourceId: share.resource_id,
    shareType: share.share_type,
    expiresAt: share.expires_at ? new Date(share.expires_at) : undefined,
    viewCount: share.view_count,
    maxViews: share.max_views,
    createdBy: share.created_by,
    createdAt: new Date(share.created_at),
  };
}

/**
 * Validate share access
 */
export async function validateShareAccess(
  shareId: string,
  password?: string
): Promise<{
  valid: boolean;
  reason?: 'not_found' | 'expired' | 'max_views' | 'invalid_password';
  share?: ShareLink;
}> {
  const supabase = createAdminClient();

  // Get share
  const { data: share, error } = await supabase
    .from('shares')
    .select('*')
    .eq('share_id', shareId)
    .single();

  if (error || !share) {
    return { valid: false, reason: 'not_found' };
  }

  // Check expiration
  if (share.expires_at && new Date(share.expires_at) < new Date()) {
    return { valid: false, reason: 'expired' };
  }

  // Check max views
  if (share.max_views && share.view_count >= share.max_views) {
    return { valid: false, reason: 'max_views' };
  }

  // Check password
  if (share.share_type === 'password') {
    if (!password || !share.password_hash) {
      return { valid: false, reason: 'invalid_password' };
    }

    const passwordValid = await verifySharePassword(password, share.password_hash);
    if (!passwordValid) {
      return { valid: false, reason: 'invalid_password' };
    }
  }

  return {
    valid: true,
    share: {
      id: share.id,
      shareId: share.share_id,
      resourceType: share.resource_type,
      resourceId: share.resource_id,
      shareType: share.share_type,
      expiresAt: share.expires_at ? new Date(share.expires_at) : undefined,
      viewCount: share.view_count,
      maxViews: share.max_views,
      createdBy: share.created_by,
      createdAt: new Date(share.created_at),
    },
  };
}

/**
 * Increment view count for a share
 */
export async function incrementShareView(shareId: string): Promise<void> {
  const supabase = createAdminClient();

  // Use RPC for atomic increment to avoid race conditions
  await supabase.rpc('increment_share_view_count', {
    p_share_id: shareId,
  });
}

/**
 * List shares for a resource
 */
export async function listResourceShares(
  resourceType: 'recording' | 'conversation',
  resourceId: string,
  orgId: string
): Promise<ShareLink[]> {
  const supabase = await createClient();

  const { data: shares, error } = await supabase
    .from('shares')
    .select('*')
    .eq('resource_type', resourceType)
    .eq('resource_id', resourceId)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list shares: ${error.message}`);
  }

  return shares.map((share) => ({
    id: share.id,
    shareId: share.share_id,
    resourceType: share.resource_type,
    resourceId: share.resource_id,
    shareType: share.share_type,
    expiresAt: share.expires_at ? new Date(share.expires_at) : undefined,
    viewCount: share.view_count,
    maxViews: share.max_views,
    createdBy: share.created_by,
    createdAt: new Date(share.created_at),
  }));
}

/**
 * Delete a share
 */
export async function deleteShare(
  shareId: string,
  orgId: string
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('shares')
    .delete()
    .eq('id', shareId)
    .eq('org_id', orgId);

  if (error) {
    throw new Error(`Failed to delete share: ${error.message}`);
  }
}

/**
 * Update share settings
 */
export async function updateShare(
  shareId: string,
  orgId: string,
  updates: {
    expiresAt?: Date | null;
    maxViews?: number | null;
  }
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('shares')
    .update({
      expires_at: updates.expiresAt?.toISOString() || null,
      max_views: updates.maxViews,
    })
    .eq('id', shareId)
    .eq('org_id', orgId);

  if (error) {
    throw new Error(`Failed to update share: ${error.message}`);
  }
}
