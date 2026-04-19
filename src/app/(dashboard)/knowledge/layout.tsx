import { KnowledgeWorkspaceNav } from '@/app/components/knowledge/KnowledgeWorkspaceNav'

export default function KnowledgeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <KnowledgeWorkspaceNav />
      {children}
    </div>
  )
}
