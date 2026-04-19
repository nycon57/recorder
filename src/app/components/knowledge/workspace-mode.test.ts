import {
  KNOWLEDGE_WORKSPACE_DEFAULT_MODE,
  getKnowledgeWorkspaceModeFromPathname,
  isKnowledgeWorkspaceMode,
} from './workspace-mode'

describe('knowledge workspace mode helpers', () => {
  it('uses the default mode when pathname is empty', () => {
    expect(getKnowledgeWorkspaceModeFromPathname('')).toBe(
      KNOWLEDGE_WORKSPACE_DEFAULT_MODE,
    )
    expect(getKnowledgeWorkspaceModeFromPathname(null)).toBe(
      KNOWLEDGE_WORKSPACE_DEFAULT_MODE,
    )
  })

  it('resolves known workspace routes', () => {
    expect(getKnowledgeWorkspaceModeFromPathname('/knowledge/map')).toBe('map')
    expect(getKnowledgeWorkspaceModeFromPathname('/knowledge/docs')).toBe('docs')
    expect(getKnowledgeWorkspaceModeFromPathname('/knowledge/review')).toBe(
      'review',
    )
    expect(getKnowledgeWorkspaceModeFromPathname('/knowledge/health')).toBe(
      'health',
    )
  })

  it('falls back to default mode for unknown route segments', () => {
    expect(getKnowledgeWorkspaceModeFromPathname('/knowledge')).toBe(
      KNOWLEDGE_WORKSPACE_DEFAULT_MODE,
    )
    expect(getKnowledgeWorkspaceModeFromPathname('/knowledge/legacy')).toBe(
      KNOWLEDGE_WORKSPACE_DEFAULT_MODE,
    )
    expect(getKnowledgeWorkspaceModeFromPathname('/dashboard/knowledge/foo')).toBe(
      KNOWLEDGE_WORKSPACE_DEFAULT_MODE,
    )
  })

  it('validates mode identifiers', () => {
    expect(isKnowledgeWorkspaceMode('map')).toBe(true)
    expect(isKnowledgeWorkspaceMode('docs')).toBe(true)
    expect(isKnowledgeWorkspaceMode('review')).toBe(true)
    expect(isKnowledgeWorkspaceMode('health')).toBe(true)

    expect(isKnowledgeWorkspaceMode('graph')).toBe(false)
    expect(isKnowledgeWorkspaceMode('')).toBe(false)
    expect(isKnowledgeWorkspaceMode(undefined)).toBe(false)
  })
})
