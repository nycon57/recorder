'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import * as motion from 'motion/react-client';
import { Video, Upload, FileText, Search } from 'lucide-react';

interface QuickActionsProps {
  onUploadClick?: () => void;
  onCreateNoteClick?: () => void;
}

// Motion variants for staggered entrance
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 400,
      damping: 30,
    },
  },
};

export function QuickActions({
  onUploadClick,
  onCreateNoteClick,
}: QuickActionsProps) {
  const router = useRouter();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const MotionDiv = mounted ? motion.div : 'div';

  const actions = [
    {
      icon: Video,
      label: 'Record Screen',
      description:
        'Capture screen, camera, and audio instantly. No downloads required.',
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
    <MotionDiv
      {...(mounted
        ? {
            variants: containerVariants,
            initial: 'hidden',
            animate: 'visible',
          }
        : {})}
      className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
    >
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <MotionDiv
            key={action.label}
            {...(mounted
              ? {
                  variants: itemVariants,
                  whileHover: { scale: 1.02 },
                  whileTap: { scale: 0.98 },
                }
              : {})}
          >
            <button
              onClick={action.onClick}
              className="group relative w-full rounded-xl border border-border bg-card/70 p-5 text-left transition-all duration-200 hover:border-ring/35 hover:bg-card focus:outline-none focus:ring-2 focus:ring-ring/35"
              aria-label={action.label}
            >
              <div className="mb-4">
                <div className="inline-flex items-center justify-center rounded-lg border border-border bg-muted/60 p-2.5 transition-colors group-hover:border-ring/40 group-hover:bg-muted">
                  <Icon className="size-5 text-muted-foreground group-hover:text-foreground" />
                </div>
              </div>
              <h3 className="mb-2 font-[var(--font-heading)] text-base font-semibold tracking-tight text-foreground">
                {action.label}
              </h3>
              <p className="text-body-sm text-muted-foreground line-clamp-2">
                {action.description}
              </p>
            </button>
          </MotionDiv>
        );
      })}
    </MotionDiv>
  );
}
