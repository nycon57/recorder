'use client'

import { usePathname } from 'next/navigation'

import { getKnowledgeWorkspaceModeFromPathname } from '@/app/components/knowledge/workspace-mode'

export function useKnowledgeWorkspaceMode() {
  const pathname = usePathname()
  return getKnowledgeWorkspaceModeFromPathname(pathname)
}
