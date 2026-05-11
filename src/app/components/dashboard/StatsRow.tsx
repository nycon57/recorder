'use client';

import * as React from 'react';
import * as motion from 'motion/react-client';
import { Files, HardDrive, TrendingUp, Clock } from 'lucide-react';

import { Card, CardContent } from '@/app/components/ui/card';
import { Skeleton } from '@/app/components/ui/skeleton';
import { formatFileSize } from '@/lib/types/content';

interface DashboardStats {
  totalItems: number;
  storageUsedBytes: number;
  itemsThisWeek: number;
  processingCount: number;
}

interface StatsRowProps {
  stats: DashboardStats | null;
  isLoading?: boolean;
}

// Motion variants for staggered entrance
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.15,
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

export function StatsRow({ stats, isLoading = false }: StatsRowProps) {
  const MotionDiv = motion.div;

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="card-interactive">
            <CardContent className="p-6">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-8 w-16 mb-1" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const statItems = [
    {
      icon: Files,
      label: 'Total Items',
      value: stats?.totalItems.toLocaleString() || '0',
      description: 'Items in your library',
      iconBg: 'bg-muted/70 border border-border',
      iconColor: 'text-muted-foreground',
    },
    {
      icon: HardDrive,
      label: 'Storage Used',
      value: formatFileSize(stats?.storageUsedBytes || 0),
      description: 'Total storage consumed',
      iconBg: 'bg-muted/70 border border-border',
      iconColor: 'text-muted-foreground',
    },
    {
      icon: TrendingUp,
      label: 'This Week',
      value: stats?.itemsThisWeek.toLocaleString() || '0',
      description: 'Items added this week',
      iconBg: 'bg-muted/70 border border-border',
      iconColor: 'text-muted-foreground',
    },
    {
      icon: Clock,
      label: 'Processing',
      value: stats?.processingCount.toLocaleString() || '0',
      description: 'Items in queue',
      iconBg: 'bg-muted/70 border border-border',
      iconColor: 'text-muted-foreground',
    },
  ];

  return (
    <MotionDiv
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-2 lg:grid-cols-4 gap-4"
    >
      {statItems.map((item) => {
        const Icon = item.icon;
        return (
          <MotionDiv key={item.label} variants={itemVariants}>
            <Card className="overflow-hidden card-interactive h-full">
              <CardContent className="p-4 lg:p-6">
                <div className="flex items-start justify-between mb-3">
                  <div
                    className={`inline-flex items-center justify-center rounded-lg ${item.iconBg} p-2.5 transition-colors`}
                  >
                    <Icon className={`size-5 ${item.iconColor}`} />
                  </div>
                </div>
                <div>
                  <p className="text-body-sm text-muted-foreground mb-1">
                    {item.label}
                  </p>
                  <p className="font-[var(--font-heading)] text-2xl font-semibold tracking-tight truncate">
                    {item.value}
                  </p>
                  <p className="text-body-xs text-muted-foreground mt-1 line-clamp-1">
                    {item.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          </MotionDiv>
        );
      })}
    </MotionDiv>
  );
}
