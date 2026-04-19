import { redirect } from 'next/navigation'

import { KNOWLEDGE_WORKSPACE_DEFAULT_MODE } from '@/app/components/knowledge/workspace-mode'

export default function KnowledgePage() {
  redirect(`/knowledge/${KNOWLEDGE_WORKSPACE_DEFAULT_MODE}`)
}
