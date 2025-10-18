'use client';

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

export function StatsRow({ stats, isLoading = false }: StatsRowProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
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
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      iconColor: 'text-blue-600 dark:text-blue-400',
    },
    {
      icon: HardDrive,
      label: 'Storage Used',
      value: formatFileSize(stats?.storageUsedBytes || 0),
      description: 'Total storage consumed',
      iconBg: 'bg-purple-100 dark:bg-purple-900/30',
      iconColor: 'text-purple-600 dark:text-purple-400',
    },
    {
      icon: TrendingUp,
      label: 'This Week',
      value: stats?.itemsThisWeek.toLocaleString() || '0',
      description: 'Items added this week',
      iconBg: 'bg-green-100 dark:bg-green-900/30',
      iconColor: 'text-green-600 dark:text-green-400',
    },
    {
      icon: Clock,
      label: 'Processing',
      value: stats?.processingCount.toLocaleString() || '0',
      description: 'Items in queue',
      iconBg: 'bg-orange-100 dark:bg-orange-900/30',
      iconColor: 'text-orange-600 dark:text-orange-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {statItems.map((item, index) => {
        const Icon = item.icon;
        return (
          <Card
            key={item.label}
            className="overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-lg animate-fade-in"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <CardContent className="p-3 sm:p-4 lg:p-6">
              <div className="flex items-start justify-between mb-2 sm:mb-4">
                <div className={`inline-flex items-center justify-center rounded-lg ${item.iconBg} p-1.5 sm:p-2.5 transition-transform duration-200 hover:scale-110`}>
                  <Icon className={`size-4 sm:size-5 ${item.iconColor}`} />
                </div>
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground mb-0.5 sm:mb-1">
                  {item.label}
                </p>
                <p className="text-xl sm:text-2xl lg:text-3xl font-bold mb-0.5 sm:mb-1 truncate">
                  {item.value}
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-1">
                  {item.description}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
