/**
 * Sharing Service
 *
 * Manages public and password-protected shares for supported targets.
 */

import { randomBytes } from 'crypto';

import { compare, hash } from 'bcryptjs';

import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/lib/types/database';

type ShareRow = Database['public']['Tables']['shares']['Row'];
type ShareTargetType = ShareRow['target_type'];

export interface ShareLink {
  id: string;
  shareId: string;
  targetType: ShareTargetType;
  targetId: string;
  resourceType: ShareTargetType;
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
  return hash(password, 10);
}

/**
 * Verify password against hash
 */
async function verifySharePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return compare(password, hash);
}

function toShareLink(share: ShareRow): ShareLink {
  return {
    id: share.id,
    shareId: share.share_id,
    targetType: share.target_type,
    targetId: share.target_id,
    resourceType: share.target_type,
    resourceId: share.target_id,
    shareType: share.password_hash ? 'password' : 'public',
    expiresAt: share.expires_at ? new Date(share.expires_at) : undefined,
    viewCount: share.access_count ?? 0,
    maxViews: undefined,
    createdBy: share.created_by,
    createdAt: new Date(share.created_at),
  };
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

  const { data: content, error: contentError } = await supabase
    .from('content')
    .select('id')
    .eq('id', recordingId)
    .eq('org_id', orgId)
    .single();

  if (contentError || !content) {
    throw new Error('Content not found');
  }

  const shareId = generateShareId();
  let passwordHash: string | undefined;

  if (options.shareType === 'password' && options.password) {
    passwordHash = await hashPassword(options.password);
  }

  const { data: share, error: shareError } = await supabase
    .from('shares')
    .insert({
      share_id: shareId,
      target_type: 'recording',
      target_id: recordingId,
      org_id: orgId,
      password_hash: passwordHash,
      expires_at: options.expiresAt?.toISOString(),
      created_by: userId,
    })
    .select()
    .single();

  if (shareError) {
    throw new Error(`Failed to create share: ${shareError.message}`);
  }

  return toShareLink(share);
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

  return toShareLink(share);
}

/**
 * Validate share access
 */
export async function validateShareAccess(
  shareId: string,
  password?: string
): Promise<{
  valid: boolean;
  reason?: 'not_found' | 'expired' | 'invalid_password';
  share?: ShareLink;
}> {
  const supabase = createAdminClient();

  const { data: share, error } = await supabase
    .from('shares')
    .select('*')
    .eq('share_id', shareId)
    .single();

  if (error || !share || share.revoked_at) {
    return { valid: false, reason: 'not_found' };
  }

  if (share.expires_at && new Date(share.expires_at) < new Date()) {
    return { valid: false, reason: 'expired' };
  }

  if (share.password_hash) {
    if (!password) {
      return { valid: false, reason: 'invalid_password' };
    }

    const passwordValid = await verifySharePassword(password, share.password_hash);
    if (!passwordValid) {
      return { valid: false, reason: 'invalid_password' };
    }
  }

  return {
    valid: true,
    share: toShareLink(share),
  };
}

/**
 * Increment view count for a share
 */
export async function incrementShareView(shareId: string): Promise<void> {
  const supabase = createAdminClient();

  await supabase.rpc('increment_share_view_count', {
    p_share_id: shareId,
  });
}

/**
 * List shares for a resource
 */
export async function listResourceShares(
  targetType: ShareTargetType,
  targetId: string,
  orgId: string
): Promise<ShareLink[]> {
  const supabase = await createClient();

  const { data: shares, error } = await supabase
    .from('shares')
    .select('*')
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list shares: ${error.message}`);
  }

  return shares.map(toShareLink);
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
    })
    .eq('id', shareId)
    .eq('org_id', orgId);

  if (error) {
    throw new Error(`Failed to update share: ${error.message}`);
  }
}
