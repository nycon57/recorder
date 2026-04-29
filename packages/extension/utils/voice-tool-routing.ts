export interface VoiceToolRouteMeta {
  bindingEpoch: number;
  targetTabId: number;
  pageInstanceId: string | null;
  contentInstanceId: string | null;
}

export interface VoiceToolResultMeta {
  bindingEpoch?: number | null;
  pageInstanceId?: string | null;
  contentInstanceId?: string | null;
}

export interface VoiceTargetInstanceState {
  bindingEpoch: number;
  targetTabId: number | null;
  pageInstanceId: string | null;
  contentInstanceId: string | null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function buildPageInstanceId(args: {
  contentInstanceId: string;
  sequence: number;
  href: string;
}): string {
  return `${args.contentInstanceId}:page:${args.sequence}:${args.href}`;
}

export function buildToolRouteMeta(
  state: VoiceTargetInstanceState,
): VoiceToolRouteMeta | null {
  if (state.targetTabId === null) return null;

  return {
    bindingEpoch: state.bindingEpoch,
    targetTabId: state.targetTabId,
    pageInstanceId: state.pageInstanceId,
    contentInstanceId: state.contentInstanceId,
  };
}

export function parseToolResultMeta(
  payload: Record<string, unknown>,
): VoiceToolResultMeta {
  return {
    bindingEpoch: readNumber(payload.bindingEpoch),
    pageInstanceId: readString(payload.pageInstanceId),
    contentInstanceId: readString(payload.contentInstanceId),
  };
}

export function isToolResultCurrent(args: {
  route: VoiceToolRouteMeta;
  current: VoiceTargetInstanceState;
  result: VoiceToolResultMeta;
}): boolean {
  if (args.current.targetTabId !== args.route.targetTabId) return false;
  if (args.current.bindingEpoch !== args.route.bindingEpoch) return false;
  if (args.result.bindingEpoch !== args.route.bindingEpoch) return false;

  if (
    args.route.pageInstanceId &&
    args.result.pageInstanceId &&
    args.route.pageInstanceId !== args.result.pageInstanceId
  ) {
    return false;
  }

  if (
    args.route.contentInstanceId &&
    args.result.contentInstanceId &&
    args.route.contentInstanceId !== args.result.contentInstanceId
  ) {
    return false;
  }

  return true;
}

export function buildLoadingVoiceTargetToolResult(toolName: string): string {
  if (toolName === 'capture_screenshot') {
    return 'The current page is still loading, so a screenshot is not available yet. Wait a moment, then try again.';
  }

  if (toolName === 'get_page_context') {
    return 'The current page is still loading, so fresh page context is not available yet. Wait a moment, then call get_page_context again.';
  }

  return 'The current page is still loading, so that page action is not available yet. Wait a moment, then try again.';
}
