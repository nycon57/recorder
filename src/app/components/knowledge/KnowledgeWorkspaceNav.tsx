'use client'

import Link from 'next/link'

import { useKnowledgeWorkspaceMode } from '@/app/hooks/useKnowledgeWorkspaceMode'
import { cn } from '@/lib/utils'
import { KNOWLEDGE_WORKSPACE_MODES } from '@/app/components/knowledge/workspace-mode'

export function KnowledgeWorkspaceNav() {
  const activeMode = useKnowledgeWorkspaceMode()

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 pt-2">
      <nav aria-label="Knowledge workspace modes">
        <ul className="flex flex-wrap items-center gap-2 rounded-xl border bg-card/50 p-2">
          {KNOWLEDGE_WORKSPACE_MODES.map((item) => {
            const isActive = activeMode === item.mode
            return (
              <li key={item.mode}>
                <Link
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'inline-flex min-h-[40px] items-center rounded-lg px-3 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
