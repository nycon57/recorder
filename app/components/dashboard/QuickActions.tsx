'use client';

import { useRouter } from 'next/navigation';
import { Video, Upload, FileText, Search } from 'lucide-react';

interface QuickActionsProps {
  onUploadClick?: () => void;
  onCreateNoteClick?: () => void;
}

export function QuickActions({ onUploadClick, onCreateNoteClick }: QuickActionsProps) {
  const router = useRouter();

  const actions = [
    {
      icon: Video,
      label: 'Record Screen',
      description: 'Capture screen, camera, and audio instantly. No downloads required.',
      onClick: () => router.push('/record'),
    },
    {
      icon: Upload,
      label: 'Upload File',
      description: 'Upload video, audio, or documents to your library.',
      onClick: onUploadClick || (() => {}),
    },
    {
      icon: FileText,
      label: 'Create Note',
      description: 'Write quick text notes and save to your knowledge base.',
      onClick: onCreateNoteClick || (() => {}),
    },
    {
      icon: Search,
      label: 'Search Library',
      description: 'Find anything instantly with context-aware AI search.',
      onClick: () => router.push('/search'),
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.label}
            onClick={action.onClick}
            className="group relative rounded-lg border border-border bg-card p-6 text-left transition-all duration-200 hover:border-primary/50 hover:bg-card/80 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary active:scale-[0.98]"
            aria-label={action.label}
          >
            <div className="mb-4">
              <div className="inline-flex items-center justify-center rounded-full bg-primary/10 p-3 ring-1 ring-primary/20 transition-all duration-200 group-hover:bg-primary/20 group-hover:ring-primary/30">
                <Icon className="size-5 text-primary" />
              </div>
            </div>
            <h3 className="text-base font-semibold text-foreground mb-2">
              {action.label}
            </h3>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {action.description}
            </p>
          </button>
        );
      })}
    </div>
  );
}
