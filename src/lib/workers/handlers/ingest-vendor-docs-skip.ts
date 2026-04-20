export interface VendorWikiPageSkipCheckInput {
  existingContentHash: string | null;
  nextContentHash: string;
  existingVendorSourceId: string | null;
  nextVendorSourceId?: string | null;
}

export function shouldSkipVendorWikiPageUpdate({
  existingContentHash,
  nextContentHash,
  existingVendorSourceId,
  nextVendorSourceId,
}: VendorWikiPageSkipCheckInput): boolean {
  if (existingContentHash !== nextContentHash) {
    return false;
  }

  if (!nextVendorSourceId) {
    return true;
  }

  return existingVendorSourceId === nextVendorSourceId;
}
