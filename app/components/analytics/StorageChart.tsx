'use client';

import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { Skeleton } from '@/app/components/ui/skeleton';
import { formatBytes } from '@/lib/utils';
import type { StorageByContentType } from '@/lib/types/phase8';

interface StorageChartProps {
  orgId?: string;
  className?: string;
}

const COLORS = {
  recording: '#8b5cf6', // violet
  video: '#3b82f6',     // blue
  audio: '#10b981',     // emerald
  document: '#f59e0b',  // amber
  text: '#ec4899',      // pink
};

const CONTENT_TYPE_LABELS = {
  recording: 'Screen Recordings',
  video: 'Videos',
  audio: 'Audio Files',
  document: 'Documents',
  text: 'Text Notes',
};

export function StorageChart({ orgId, className }: StorageChartProps) {
  const [data, setData] = useState<StorageByContentType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewType, setViewType] = useState<'pie' | 'bar'>('pie');

  useEffect(() => {
    fetchStorageData();
  }, [orgId]);

  const fetchStorageData = async () => {
    try {
      setIsLoading(true);
      const params = orgId ? `?org_id=${orgId}` : '';
      const response = await fetch(`/api/analytics/storage${params}`);

      if (!response.ok) throw new Error('Failed to fetch storage data');

      const result = await response.json();
      setData(result.data.by_content_type || []);
    } catch (error) {
      console.error('Error fetching storage data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const chartData = data.map(item => ({
    name: CONTENT_TYPE_LABELS[item.content_type as keyof typeof CONTENT_TYPE_LABELS] || item.content_type,
    value: item.total_size_bytes,
    percentage: item.percentage,
    count: item.item_count,
    color: COLORS[item.content_type as keyof typeof COLORS] || '#6b7280',
  }));

  const totalStorage = data.reduce((sum, item) => sum + item.total_size_bytes, 0);
  const totalItems = data.reduce((sum, item) => sum + item.item_count, 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload[0]) {
      const data = payload[0].payload;
      return (
        <div className="bg-popover border rounded-lg p-3 shadow-md">
          <p className="font-semibold text-sm">{data.name}</p>
          <p className="text-sm text-muted-foreground">
            Size: {formatBytes(data.value)}
          </p>
          <p className="text-sm text-muted-foreground">
            Items: {data.count.toLocaleString()}
          </p>
          <p className="text-sm text-muted-foreground">
            {data.percentage.toFixed(1)}% of total
          </p>
        </div>
      );
    }
    return null;
  };

  const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    if (percent < 0.05) return null; // Don't show label for small slices

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        className="text-xs font-medium"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Storage by Content Type</CardTitle>
          <CardDescription>No storage data available</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            No data to display
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Storage by Content Type</CardTitle>
            <CardDescription>
              Total: {formatBytes(totalStorage)} across {totalItems.toLocaleString()} items
            </CardDescription>
          </div>
          <Tabs value={viewType} onValueChange={(v) => setViewType(v as 'pie' | 'bar')}>
            <TabsList className="h-8">
              <TabsTrigger value="pie" className="text-xs">Pie</TabsTrigger>
              <TabsTrigger value="bar" className="text-xs">Bar</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        {viewType === 'pie' ? (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={CustomLabel}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(value, entry: any) => (
                  <span className="text-xs">
                    {value} ({formatBytes(entry.payload.value)})
                  </span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
              />
              <YAxis
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
                tickFormatter={(value) => formatBytes(value, 0)}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}

        {/* Legend for color reference */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
          {chartData.map((item) => (
            <div key={item.name} className="flex items-center gap-2">
              <div
                className="h-3 w-3 rounded-sm shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  {item.count} items • {item.percentage.toFixed(1)}%
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}