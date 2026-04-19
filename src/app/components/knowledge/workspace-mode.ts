export const KNOWLEDGE_WORKSPACE_DEFAULT_MODE = 'docs' as const

export const KNOWLEDGE_WORKSPACE_MODES = [
  {
    mode: 'map',
    label: 'Map',
    href: '/knowledge/map',
    description: 'Operational page graph and typed relationships',
  },
  {
    mode: 'docs',
    label: 'Docs',
    href: '/knowledge/docs',
    description: 'Compiled pages and source coverage',
  },
  {
    mode: 'review',
    label: 'Review',
    href: '/knowledge/review',
    description: 'Routing and publication review queue',
  },
  {
    mode: 'health',
    label: 'Health',
    href: '/knowledge/health',
    description: 'Knowledge health and quality metrics',
  },
] as const

export type KnowledgeWorkspaceMode =
  (typeof KNOWLEDGE_WORKSPACE_MODES)[number]['mode']

export function isKnowledgeWorkspaceMode(
  value: string | null | undefined,
): value is KnowledgeWorkspaceMode {
  if (!value) return false
  return KNOWLEDGE_WORKSPACE_MODES.some((item) => item.mode === value)
}

export function getKnowledgeWorkspaceModeFromPathname(
  pathname: string | null | undefined,
): KnowledgeWorkspaceMode {
  if (!pathname) return KNOWLEDGE_WORKSPACE_DEFAULT_MODE

  const segments = pathname.split('/').filter(Boolean)
  const knowledgeIndex = segments.indexOf('knowledge')

  if (knowledgeIndex === -1) {
    return KNOWLEDGE_WORKSPACE_DEFAULT_MODE
  }

  const candidate = segments[knowledgeIndex + 1]
  if (candidate === 'pages') {
    return 'docs'
  }

  if (isKnowledgeWorkspaceMode(candidate)) {
    return candidate
  }

  return KNOWLEDGE_WORKSPACE_DEFAULT_MODE
}
