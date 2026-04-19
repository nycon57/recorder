import Link from 'next/link'
import { ArrowRight, CheckSquare, ShieldCheck } from 'lucide-react'

import { Button } from '@/app/components/ui/button'

export const metadata = {
  title: 'Knowledge Review | Dashboard',
  description: 'Review-focused workspace mode for routing and publication checks.',
}

export default function KnowledgeReviewPage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <section className="rounded-xl border bg-card/40 p-6 sm:p-8">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
          <div className="space-y-2">
            <h1 className="text-xl font-semibold tracking-tight">Review Workspace</h1>
            <p className="text-sm text-muted-foreground">
              Triage routing and publication items, then move directly into the
              existing review queue and quality surfaces.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button asChild>
            <Link href="/admin/wiki-review">
              Open Review Queue
              <CheckSquare className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/knowledge/health">
              Open Health Checks
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  )
}
