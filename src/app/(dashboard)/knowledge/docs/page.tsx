import Link from 'next/link'
import { ArrowRight, BookOpenText, Search } from 'lucide-react'

import { Button } from '@/app/components/ui/button'

export const metadata = {
  title: 'Knowledge Docs | Dashboard',
  description: 'Documentation-focused workspace mode for knowledge content.',
}

export default function KnowledgeDocsPage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <section className="rounded-xl border bg-card/40 p-6 sm:p-8">
        <div className="flex items-start gap-3">
          <BookOpenText className="mt-0.5 h-5 w-5 text-primary" />
          <div className="space-y-2">
            <h1 className="text-xl font-semibold tracking-tight">Docs Workspace</h1>
            <p className="text-sm text-muted-foreground">
              Browse compiled documentation and jump into source content from the
              core library and search tools.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button asChild>
            <Link href="/library">
              Open Library
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/search">
              Search Docs
              <Search className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  )
}
