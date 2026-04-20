/**
 * Deterministic UUID v5 derivation for the demo seed.
 *
 * DO NOT ROTATE THE NAMESPACE.
 * All demo-seed IDs are derived from DEMO_SEED_NAMESPACE via UUID v5.
 * Rotating this value changes every ID and breaks any existing seeded data.
 */

import { v5 as uuidv5 } from 'uuid';

/**
 * Frozen UUID v5 namespace for the Tribora demo seed.
 * DO NOT ROTATE — changing this value changes every derived ID.
 * This UUID was computed once from the label "tribora-demo" and is now frozen.
 */
export const DEMO_SEED_NAMESPACE = '6f4c0b8a-8f2a-4d7e-9b11-000000000000';

// Internal alias — same value; both names kept for clarity.
const NS = DEMO_SEED_NAMESPACE;

/**
 * Derive a stable UUID for the demo organization.
 */
export function deriveOrgId(slug: string): string {
  return uuidv5(`org:${slug}`, NS);
}

/**
 * Derive a stable UUID for a demo user by email address.
 */
export function deriveUserId(email: string): string {
  return uuidv5(`user:${email.toLowerCase()}`, NS);
}

/**
 * Derive a stable UUID for a Better Auth org membership record.
 */
export function deriveMemberId(orgId: string, userId: string): string {
  return uuidv5(`member:${orgId}:${userId}`, NS);
}

/**
 * Derive a stable UUID for a Better Auth account record.
 * All demo users use the credential provider.
 */
export function deriveAccountId(userId: string): string {
  return uuidv5(`account:credential:${userId}`, NS);
}

/**
 * Derive a stable UUID for a department by org + slug.
 */
export function deriveDepartmentId(orgId: string, slug: string): string {
  return uuidv5(`department:${orgId}:${slug}`, NS);
}

// ─── TRIB-148 content entity derivation ──────────────────────────────────────

export function deriveRecordingId(slug: string): string {
  return uuidv5(`recording:${slug}`, NS);
}

export function deriveDocumentId(recordingSlug: string): string {
  return uuidv5(`document:${recordingSlug}`, NS);
}

export function deriveSummaryId(recordingSlug: string): string {
  return uuidv5(`summary:${recordingSlug}`, NS);
}

export function deriveTranscriptId(recordingSlug: string): string {
  return uuidv5(`transcript:${recordingSlug}`, NS);
}

export function deriveChunkId(recordingSlug: string, idx: number): string {
  return uuidv5(`chunk:${recordingSlug}:${idx}`, NS);
}

export function deriveWikiPageId(slug: string): string {
  return uuidv5(`wiki-page:${slug}`, NS);
}

export function deriveWikiSourceId(pageSlug: string, recSlug: string): string {
  return uuidv5(`wiki-source:${pageSlug}:${recSlug}`, NS);
}

export function deriveConnectorId(orgId: string, type: string): string {
  return uuidv5(`connector:${orgId}:${type}`, NS);
}

export function deriveImportedDocId(slug: string): string {
  return uuidv5(`imported-doc:${slug}`, NS);
}

export function deriveKnowledgeGapId(slug: string): string {
  return uuidv5(`knowledge-gap:${slug}`, NS);
}

export function deriveShareId(slug: string): string {
  return uuidv5(`share:${slug}`, NS);
}

export function deriveTagId(orgId: string, name: string): string {
  return uuidv5(`tag:${orgId}:${name.toLowerCase()}`, NS);
}

export function deriveVendorOrgId(): string {
  return uuidv5('org:tribora-vendor-demo', NS);
}

export function deriveWhiteLabelConfigId(vendorOrgId: string): string {
  return uuidv5(`white-label:${vendorOrgId}`, NS);
}
