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
      description: 'Start a new screen recording',
      onClick: () => router.push('/record'),
      gradient: 'from-purple-500 to-purple-600',
      hoverGradient: 'hover:from-purple-600 hover:to-purple-700',
      iconBg: 'bg-purple-100 dark:bg-purple-900/30',
      iconColor: 'text-purple-600 dark:text-purple-400',
    },
    {
      icon: Upload,
      label: 'Upload File',
      description: 'Upload video, audio, or documents',
      onClick: onUploadClick || (() => {}),
      gradient: 'from-blue-500 to-blue-600',
      hoverGradient: 'hover:from-blue-600 hover:to-blue-700',
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      iconColor: 'text-blue-600 dark:text-blue-400',
    },
    {
      icon: FileText,
      label: 'Create Note',
      description: 'Write a quick text note',
      onClick: onCreateNoteClick || (() => {}),
      gradient: 'from-green-500 to-green-600',
      hoverGradient: 'hover:from-green-600 hover:to-green-700',
      iconBg: 'bg-green-100 dark:bg-green-900/30',
      iconColor: 'text-green-600 dark:text-green-400',
    },
    {
      icon: Search,
      label: 'Search Library',
      description: 'Find content across your library',
      onClick: () => router.push('/search'),
      gradient: 'from-orange-500 to-orange-600',
      hoverGradient: 'hover:from-orange-600 hover:to-orange-700',
      iconBg: 'bg-orange-100 dark:bg-orange-900/30',
      iconColor: 'text-orange-600 dark:text-orange-400',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.label}
            onClick={action.onClick}
            className={`group relative overflow-hidden rounded-xl bg-gradient-to-br ${action.gradient} ${action.hoverGradient} p-4 sm:p-6 text-left shadow-sm transition-all duration-200 hover:shadow-md hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 touch-manipulation min-h-[100px] sm:min-h-0 active:scale-[0.98]`}
            aria-label={action.label}
          >
            <div className="relative z-10">
              <div className={`inline-flex items-center justify-center rounded-lg ${action.iconBg} p-2 sm:p-3 mb-3 sm:mb-4`}>
                <Icon className={`size-5 sm:size-6 ${action.iconColor}`} />
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-white mb-1">
                {action.label}
              </h3>
              <p className="text-xs sm:text-sm text-white/80 line-clamp-2">
                {action.description}
              </p>
            </div>
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-200" />
          </button>
        );
      })}
    </div>
  );
}
