'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  DollarSign,
  Bell,
  Activity,
  BarChart3,
  Lightbulb,
  HardDrive,
  FileWarning,
  BookOpen,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Badge } from '@/app/components/ui/badge';

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  badge?: string;
}

const navItems: NavItem[] = [
  {
    title: 'Storage Analytics',
    href: '/admin/storage-analytics',
    icon: HardDrive,
    description: 'Platform-wide storage metrics',
  },
  {
    title: 'Cost Management',
    href: '/admin/cost-management',
    icon: DollarSign,
    description: 'Budgets and cost tracking',
  },
  {
    title: 'Alerts',
    href: '/admin/storage-alerts',
    icon: Bell,
    description: 'Alert management',
  },
  {
    title: 'System Health',
    href: '/admin/storage-health',
    icon: Activity,
    description: 'System health monitoring',
  },
  {
    title: 'Recommendations',
    href: '/admin/storage-recommendations',
    icon: Lightbulb,
    description: 'Optimization suggestions',
  },
  // TRIB-34: Wiki Review surfaces flagged contradictions for admin approval
  {
    title: 'Wiki Review',
    href: '/admin/wiki-review',
    icon: FileWarning,
    description: 'Resolve flagged contradictions',
  },
  {
    title: 'Vendor Sources',
    href: '/admin/vendor-sources',
    icon: BookOpen,
    description: 'Shared vendor source health',
  },
  {
    title: 'Knowledge Telemetry',
    href: '/admin/knowledge-telemetry',
    icon: BarChart3,
    description: 'Shared answer freshness and rollout quality',
  },
];

export default function AdminNavigation() {
  const pathname = usePathname();

  return (
    <nav className="space-y-3">
      <div className="px-2">
        <p className="trbd-kicker">System Console</p>
        <h2 className="mt-2 flex items-center gap-2 text-base font-semibold tracking-tight">
          <LayoutDashboard className="size-4" />
          Admin Dashboard
        </h2>
      </div>
      <div className="space-y-1">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors',
                isActive
                  ? 'border-sidebar-ring/30 bg-sidebar-accent text-foreground'
                  : 'border-transparent text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground',
              )}
            >
              <Icon
                className={cn(
                  'mt-0.5 size-4',
                  isActive ? 'text-primary' : 'text-muted-foreground',
                )}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span>{item.title}</span>
                  {item.badge && (
                    <Badge variant="secondary" className="h-5 px-1 text-xs">
                      {item.badge}
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {item.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
