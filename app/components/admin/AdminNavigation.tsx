'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  DollarSign,
  Bell,
  Activity,
  Lightbulb,
  HardDrive,
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
];

export default function AdminNavigation() {
  const pathname = usePathname();

  return (
    <nav className="space-y-2">
      <div className="px-3 py-2">
        <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight flex items-center gap-2">
          <LayoutDashboard className="h-5 w-5" />
          Admin Dashboard
        </h2>
      </div>
      <div className="space-y-1 px-3">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all hover:bg-accent',
                isActive ? 'bg-accent font-medium text-accent-foreground' : 'text-muted-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span>{item.title}</span>
                  {item.badge && (
                    <Badge variant="secondary" className="h-5 px-1 text-xs">
                      {item.badge}
                    </Badge>
                  )}
                </div>
                {isActive && (
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
