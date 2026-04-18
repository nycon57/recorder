import type {
  KnowledgeMatchBasis,
  KnowledgeMatchCategory,
  KnowledgeAvailability,
  PageContext,
} from '@tribora/shared';
import {
  buildContextSemanticFingerprint,
  sanitizePageContextLocation,
} from '@tribora/shared/context-telemetry';

export type ExtensionContextPageType =
  | 'dialog'
  | 'settings'
  | 'dashboard'
  | 'record_detail'
  | 'table'
  | 'form'
  | 'document'
  | 'marketing'
  | 'unknown';

export interface ExtensionContextTelemetryPayload {
  orgId: string;
  actorId: string | null;
  authMethod: 'session' | 'api_key';
  urlHost: string;
  urlPath: string;
  app: string;
  screen: string;
  appSignature: string;
  pageType: ExtensionContextPageType;
  detectionConfidence: {
    app: number | null;
    screen: number | null;
    overall: number | null;
  };
  knowledgeMode: KnowledgeAvailability['mode'] | 'unknown';
  vendorMatchBasis: KnowledgeMatchBasis;
  orgMatchBasis: KnowledgeMatchBasis;
  vendorMatchCategory: KnowledgeMatchCategory | 'unknown';
  orgMatchCategory: KnowledgeMatchCategory | 'unknown';
  vendorMatchLabel: string | null;
  orgMatchLabel: string | null;
  vendorMatchExplanation: string | null;
  orgMatchExplanation: string | null;
  vendorMatchConfidence: number | null;
  orgMatchConfidence: number | null;
  selectedEntityTitle: string | null;
  currentNavigationLabels: string[];
  workspaceValues: string[];
  surfaceCounts: {
    headings: number;
    navigation: number;
    primaryActions: number;
    forms: number;
    tables: number;
    dialogs: number;
    interactiveElements: number;
  };
  pageSummary: string;
  latencyMs: number;
  fingerprint: string;
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}

function hasSettingsSignal(context: PageContext): boolean {
  const signal = [
    context.title,
    context.screen,
    context.selectedEntity?.title,
    context.pageSummary,
    ...(context.breadcrumbs ?? []),
  ]
    .map((value) => normalizeText(value).toLowerCase())
    .join(' ');

  return /\b(settings?|preferences?|configuration|config|permissions?|security|billing)\b/.test(
    signal,
  );
}

function hasDocumentSignal(context: PageContext): boolean {
  return (
    (context.headings?.length ?? 0) >= 2 &&
    (context.visibleText?.length ?? 0) >= 500 &&
    (context.interactiveElements?.length ?? 0) <= 10 &&
    (context.forms?.length ?? 0) === 0 &&
    (context.tables?.length ?? 0) === 0
  );
}

function hasMarketingSignal(context: PageContext): boolean {
  return (
    context.app === 'unknown' &&
    (context.dialogs?.length ?? 0) === 0 &&
    (context.forms?.length ?? 0) === 0 &&
    (context.tables?.length ?? 0) === 0 &&
    (context.workspaceContext?.items.length ?? 0) === 0 &&
    (context.navigation?.length ?? 0) <= 2 &&
    (context.primaryActions?.length ?? 0) <= 2
  );
}

export function classifyPageType(
  context: PageContext,
): ExtensionContextPageType {
  if ((context.dialogs?.length ?? 0) > 0) return 'dialog';
  if (hasSettingsSignal(context)) return 'settings';
  if ((context.tables?.length ?? 0) > 0 && (context.forms?.length ?? 0) === 0) {
    return 'table';
  }
  if ((context.forms?.length ?? 0) > 0 && (context.tables?.length ?? 0) === 0) {
    return 'form';
  }
  if (
    context.selectedEntity?.title &&
    (context.breadcrumbs?.length ?? 0) >= 2 &&
    (context.tables?.length ?? 0) <= 1
  ) {
    return 'record_detail';
  }
  if (
    ((context.navigation?.length ?? 0) >= 3 ||
      (context.workspaceContext?.items.length ?? 0) > 0) &&
    (context.primaryActions?.length ?? 0) > 0
  ) {
    return 'dashboard';
  }
  if (hasDocumentSignal(context)) return 'document';
  if (hasMarketingSignal(context)) return 'marketing';
  return 'unknown';
}

export function buildExtensionContextTelemetry(args: {
  context: PageContext;
  latencyMs: number;
  authMethod: 'session' | 'api_key';
  orgId: string;
  actorId?: string | null;
}): ExtensionContextTelemetryPayload {
  const { context, latencyMs, authMethod, orgId, actorId = null } = args;
  const location = sanitizePageContextLocation(context.url);

  return {
    orgId,
    actorId,
    authMethod,
    urlHost: location.host,
    urlPath: location.path,
    app: context.app,
    screen: context.screen,
    appSignature: context.appSignature ?? `${context.app}:${context.screen}`,
    pageType: classifyPageType(context),
    detectionConfidence: {
      app: context.detectionConfidence?.app ?? null,
      screen: context.detectionConfidence?.screen ?? null,
      overall: context.detectionConfidence?.overall ?? null,
    },
    knowledgeMode: context.knowledgeAvailability?.mode ?? 'unknown',
    vendorMatchBasis: context.vendorKnowledgeMatch?.basis ?? 'none',
    orgMatchBasis: context.orgKnowledgeMatch?.basis ?? 'none',
    vendorMatchCategory:
      context.vendorKnowledgeMatch?.basisCategory ?? 'unknown',
    orgMatchCategory: context.orgKnowledgeMatch?.basisCategory ?? 'unknown',
    vendorMatchLabel: context.vendorKnowledgeMatch?.basisLabel ?? null,
    orgMatchLabel: context.orgKnowledgeMatch?.basisLabel ?? null,
    vendorMatchExplanation:
      context.vendorKnowledgeMatch?.basisExplanation ?? null,
    orgMatchExplanation: context.orgKnowledgeMatch?.basisExplanation ?? null,
    vendorMatchConfidence: context.vendorKnowledgeMatch?.confidence ?? null,
    orgMatchConfidence: context.orgKnowledgeMatch?.confidence ?? null,
    selectedEntityTitle: context.selectedEntity?.title ?? null,
    currentNavigationLabels: (context.navigation ?? [])
      .filter((item) => item.current)
      .map((item) => item.label)
      .slice(0, 4),
    workspaceValues: (context.workspaceContext?.items ?? [])
      .map((item) => item.value)
      .slice(0, 4),
    surfaceCounts: {
      headings: context.headings?.length ?? 0,
      navigation: context.navigation?.length ?? 0,
      primaryActions: context.primaryActions?.length ?? 0,
      forms: context.forms?.length ?? 0,
      tables: context.tables?.length ?? 0,
      dialogs: context.dialogs?.length ?? 0,
      interactiveElements: context.interactiveElements?.length ?? 0,
    },
    pageSummary: truncate(normalizeText(context.pageSummary), 280),
    latencyMs,
    fingerprint: buildContextSemanticFingerprint(context),
  };
}
