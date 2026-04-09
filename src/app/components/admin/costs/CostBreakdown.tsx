'use client';

import { useEffect, useState } from 'react';
import { PieChart, Building2, Server, Layers } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Skeleton } from '@/app/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { formatCurrency, calculatePercentage } from '@/lib/utils/formatting';

interface CostItem {
  name: string;
  cost: number;
  percentage: number;
  trend?: number;
}

interface BreakdownData {
  byOrganization: CostItem[];
  byTier: CostItem[];
  byProvider: CostItem[];
  totalCost: number;
}

export default function CostBreakdown() {
  const [data, setData] = useState<BreakdownData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBreakdownData = async () => {
      try {
        const response = await fetch('/api/analytics/costs/breakdown');

        if (!response.ok) {
          throw new Error('Failed to fetch cost breakdown');
        }

        const { data: breakdownData } = await response.json();
        setData(breakdownData);
        setError(null);
      } catch (err) {
        console.error('Error fetching cost breakdown:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchBreakdownData();

    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchBreakdownData, 60000);
    return () => clearInterval(interval);
  }, []);

  const renderBreakdownList = (items: CostItem[], icon: React.ReactNode) => {
    if (items.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">No data available</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={index} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1">
                <div className="text-muted-foreground">{icon}</div>
                <div className="flex-1">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.percentage.toFixed(1)}% of total
                  </p>
                </div>
              </div>
              <div className="text-right">
                <Badge variant="secondary" className="text-xs">
                  {formatCurrency(item.cost)}
                </Badge>
                {item.trend !== undefined && item.trend !== 0 && (
                  <p className={`text-xs mt-1 ${item.trend > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {item.trend > 0 ? '+' : ''}{item.trend.toFixed(1)}%
                  </p>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${item.percentage}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-[150px]" />
          <Skeleton className="h-4 w-[250px] mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <p className="text-sm text-destructive">Error loading cost breakdown: {error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PieChart className="h-5 w-5" />
          Cost Breakdown
        </CardTitle>
        <CardDescription>
          Distribution of {formatCurrency(data.totalCost)} monthly spend
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="organizations" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="organizations">
              <Building2 className="h-3 w-3 mr-1" />
              Organizations
            </TabsTrigger>
            <TabsTrigger value="tiers">
              <Layers className="h-3 w-3 mr-1" />
              Tiers
            </TabsTrigger>
            <TabsTrigger value="providers">
              <Server className="h-3 w-3 mr-1" />
              Providers
            </TabsTrigger>
          </TabsList>

          <TabsContent value="organizations" className="space-y-4">
            {renderBreakdownList(data.byOrganization, <Building2 className="h-4 w-4" />)}
          </TabsContent>

          <TabsContent value="tiers" className="space-y-4">
            {renderBreakdownList(data.byTier, <Layers className="h-4 w-4" />)}
          </TabsContent>

          <TabsContent value="providers" className="space-y-4">
            {renderBreakdownList(data.byProvider, <Server className="h-4 w-4" />)}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
