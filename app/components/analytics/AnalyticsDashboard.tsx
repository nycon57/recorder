'use client';

import { useState } from 'react';
import { StorageChart } from './StorageChart';
import { TrendChart } from './TrendChart';
import { PopularItems } from './PopularItems';
import { ProcessingStats } from './ProcessingStats';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import {
  Calendar,
  Download,
  BarChart3,
  TrendingUp,
  HardDrive,
  Activity,
  Users,
  Clock,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { formatBytes, cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface AnalyticsDashboardProps {
  orgId?: string;
  className?: string;
}

interface QuickStat {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: typeof HardDrive;
  color: string;
}

export function AnalyticsDashboard({ orgId, className }: AnalyticsDashboardProps) {
  const [dateRange, setDateRange] = useState('30d');

  const quickStats: QuickStat[] = [
    {
      title: 'Total Storage',
      value: formatBytes(12400000000),
      change: 4.2,
      changeLabel: 'from last month',
      icon: HardDrive,
      color: 'text-blue-600',
    },
    {
      title: 'Active Items',
      value: '1,234',
      change: 12,
      changeLabel: 'from last month',
      icon: BarChart3,
      color: 'text-green-600',
    },
    {
      title: 'Processing Time',
      value: '2.4s',
      change: -15,
      changeLabel: 'from last month',
      icon: Activity,
      color: 'text-purple-600',
    },
    {
      title: 'Success Rate',
      value: '98.5%',
      change: 2.1,
      changeLabel: 'from last month',
      icon: TrendingUp,
      color: 'text-emerald-600',
    },
    {
      title: 'Active Users',
      value: '42',
      change: 8,
      changeLabel: 'from last month',
      icon: Users,
      color: 'text-orange-600',
    },
    {
      title: 'Avg Response',
      value: '145ms',
      change: -12,
      changeLabel: 'from last month',
      icon: Clock,
      color: 'text-pink-600',
    },
  ];

  const handleExportAnalytics = async () => {
    try {
      const response = await fetch('/api/analytics/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dateRange, orgId }),
      });

      if (!response.ok) throw new Error('Failed to export analytics');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting analytics:', error);
    }
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Analytics Overview</h2>
          <p className="text-muted-foreground mt-1">
            Monitor usage, performance, and trends
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-40">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="365d">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleExportAnalytics} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {quickStats.map((stat, index) => {
          const Icon = stat.icon;
          const isPositive = (stat.change || 0) > 0;

          return (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {stat.title}
                  </CardTitle>
                  <Icon className={cn('h-4 w-4', stat.color)} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  {stat.change !== undefined && (
                    <div className="flex items-center gap-1 mt-1">
                      {isPositive ? (
                        <ChevronUp className="h-3 w-3 text-green-600" />
                      ) : (
                        <ChevronDown className="h-3 w-3 text-red-600" />
                      )}
                      <p className={cn(
                        'text-xs',
                        isPositive ? 'text-green-600' : 'text-red-600'
                      )}>
                        {isPositive ? '+' : ''}{stat.change}%
                      </p>
                      {stat.changeLabel && (
                        <p className="text-xs text-muted-foreground">
                          {stat.changeLabel}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Main Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <StorageChart orgId={orgId} />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 }}
        >
          <TrendChart orgId={orgId} />
        </motion.div>
      </div>

      {/* Secondary Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <PopularItems orgId={orgId} />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.25 }}
        >
          <ProcessingStats orgId={orgId} />
        </motion.div>
      </div>
    </div>
  );
}