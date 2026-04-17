// PageContext — shared between the Chrome extension content script and the
// Tribora backend API routes (/api/extension/query, /api/extension/context).
// Defined in product-architecture-v2.md Part 3 Component 1, lines 136-152.

export interface InteractiveElement {
  selector: string; // CSS selector to target this element
  label: string; // Visible text label
  type: string; // "button" | "input" | "select" | "link"
  ariaLabel?: string; // Accessibility label if present
  boundingRect?: DOMRect; // Position for cursor targeting
  priority?: number; // Semantic ranking score (higher = more important)
  group?: InteractiveGroup;
  roleHint?: string; // e.g. "workspace_switcher", "primary_cta"
  surface?: SurfaceKind;
  selected?: boolean;
  disabled?: boolean;
  visible?: boolean;
}

export type SurfaceKind =
  | 'dialog'
  | 'navigation'
  | 'workspace'
  | 'primary_action'
  | 'form'
  | 'table'
  | 'content'
  | 'unknown';

export type InteractiveGroup =
  | 'dialog'
  | 'navigation'
  | 'workspace'
  | 'primary_action'
  | 'form'
  | 'table'
  | 'content'
  | 'secondary';

export interface DetectionConfidence {
  app: number;
  screen: number;
  overall: number;
}

export interface ContextHeading {
  level: number;
  text: string;
  selector?: string;
}

export interface NavigationItem {
  label: string;
  selector?: string;
  current?: boolean;
  kind: 'sidebar' | 'topbar' | 'breadcrumb' | 'tab';
}

export interface PageAction {
  label: string;
  selector: string;
  priority: number;
  group: InteractiveGroup;
  surface: SurfaceKind;
}

export interface SelectedEntity {
  title: string;
  subtitle?: string;
  kind?: string;
}

export interface WorkspaceContextItem {
  kind: 'workspace' | 'project' | 'account' | 'environment';
  value: string;
  selector?: string;
}

export interface WorkspaceContext {
  items: WorkspaceContextItem[];
}

export interface FormField {
  label: string;
  selector: string;
  type: string;
  required?: boolean;
}

export interface FormSurface {
  label?: string;
  selector?: string;
  fields: FormField[];
}

export interface TableSurface {
  label?: string;
  selector?: string;
  columns: string[];
  rowCount: number;
  actionLabels?: string[];
  bulkSelectable?: boolean;
  selectionLabels?: string[];
}

export interface DialogSurface {
  title?: string;
  selector: string;
  description?: string;
  actionLabels: string[];
}

export type KnowledgeMatchBasis =
  | 'exact'
  | 'screen_alias'
  | 'app_only'
  | 'domain_alias'
  | 'none';

export interface KnowledgeMatch {
  matched: boolean;
  basis: KnowledgeMatchBasis;
  confidence: number;
  app: string | null;
  screen: string | null;
  label?: string;
  pageIds: string[];
  selectorHints?: string[];
}

export interface KnowledgeAvailability {
  hasVendorDocs: boolean;
  hasOrgKnowledge: boolean;
  mode: 'dom_only' | 'vendor_backed' | 'org_backed';
  message: string;
}

export interface LiveContextSourceRef {
  id: string;
  title: string;
  kind: 'org' | 'vendor';
}

export interface LiveContextPack {
  hash: string;
  text: string;
  knowledgeMode: KnowledgeAvailability['mode'];
  sources: LiveContextSourceRef[];
}

export interface PageContext {
  app: string; // "salesforce" | "hubspot" | "jira" | "unknown"
  appVersion?: string; // If detectable
  screen: string; // "lead-detail" | "opportunity-list" | etc.
  appSignature?: string; // "app:screen"
  url: string; // Current URL (sanitized of sensitive params)
  title: string; // Page title
  interactiveElements: InteractiveElement[];
  detectionConfidence?: DetectionConfidence;
  pageSummary?: string;
  headings?: ContextHeading[];
  navigation?: NavigationItem[];
  primaryActions?: PageAction[];
  selectedEntity?: SelectedEntity;
  workspaceContext?: WorkspaceContext;
  forms?: FormSurface[];
  tables?: TableSurface[];
  dialogs?: DialogSurface[];
  vendorKnowledgeMatch?: KnowledgeMatch | null;
  orgKnowledgeMatch?: KnowledgeMatch | null;
  knowledgeAvailability?: KnowledgeAvailability;
  breadcrumbs?: string[]; // Navigation breadcrumbs if present
  visibleText?: string; // Truncated visible text for context (max 2000 chars)
}

// Message types for extension messaging between content script and background service worker
export type ExtensionMessageType =
  | 'GET_PAGE_CONTEXT'
  | 'PAGE_CONTEXT_RESPONSE'
  | 'PAGE_CONTEXT_UPDATED'
  | 'PAGE_CONTEXT_ENRICHED'
  | 'QUERY_KNOWLEDGE'
  | 'KNOWLEDGE_RESPONSE'
  | 'AUTH_CHECK'
  | 'AUTH_RESPONSE';

export interface ExtensionMessage {
  type: ExtensionMessageType;
  payload?: unknown;
  /** Populated on PAGE_CONTEXT_UPDATED messages sent from the content script */
  context?: PageContext;
  error?: string;
}
