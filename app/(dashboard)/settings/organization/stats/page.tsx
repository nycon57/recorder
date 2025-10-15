"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Users,
  HardDrive,
  Video,
  Activity,
  Briefcase,
  TrendingUp,
  Clock,
  Zap,
  FileText,
  MessageSquare,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { Progress } from "@/app/components/ui/progress";
import { Badge } from "@/app/components/ui/badge";
import { Skeleton } from "@/app/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";

interface OrgStats {
  members: {
    total: number;
    quota?: number;
    percentage?: number;
  };
  recordings: {
    total: number;
  };
  storage: {
    used_gb: number;
    quota_gb?: number;
    percentage?: number;
  };
  departments: {
    total: number;
  };
  activity: {
    active_sessions_24h: number;
  };
  usage?: {
    period: string;
    minutes_transcribed: number;
    tokens_in: number;
    tokens_out: number;
    queries_count: number;
    recordings_count: number;
  };
  quotas?: {
    plan: string;
    max_users: number;
    max_storage_gb: number;
    features: Record<string, boolean>;
  };
}

// Stat card component
function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  quota,
  percentage,
}: {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: number;
  quota?: { used: number; total: number };
  percentage?: number;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
        {trend !== undefined && (
          <p className="text-xs text-muted-foreground mt-2 flex items-center">
            <TrendingUp className="h-3 w-3 mr-1" />
            {trend > 0 ? "+" : ""}{trend}% from last month
          </p>
        )}
        {quota && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span>{quota.used} / {quota.total}</span>
              <span>{percentage}%</span>
            </div>
            <Progress value={percentage} className="h-2" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Loading skeleton
function StatsLoading() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-[100px]" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-7 w-[60px] mb-1" />
              <Skeleton className="h-3 w-[120px]" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function OrganizationStatsPage() {
  // Fetch organization stats
  const { data: stats, isLoading, error } = useQuery<OrgStats>({
    queryKey: ["organization-stats"],
    queryFn: async () => {
      const response = await fetch("/api/organizations/stats");
      if (!response.ok) throw new Error("Failed to fetch stats");
      const data = await response.json();
      return data.data;
    },
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading) {
    return <StatsLoading />;
  }

  if (error || !stats) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-10">
          <p className="text-sm text-muted-foreground">Failed to load statistics</p>
        </CardContent>
      </Card>
    );
  }

  // Prepare chart data
  const storageChartData = [
    {
      name: "Used",
      value: stats.storage.used_gb,
      fill: "#3b82f6",
    },
    {
      name: "Available",
      value: (stats.storage.quota_gb || 10) - stats.storage.used_gb,
      fill: "#e5e7eb",
    },
  ];

  const usageChartData = stats.usage
    ? [
        { name: "Transcriptions", value: stats.usage.minutes_transcribed, unit: "min" },
        { name: "Queries", value: stats.usage.queries_count, unit: "" },
        { name: "Recordings", value: stats.usage.recordings_count, unit: "" },
      ]
    : [];

  const tokenChartData = stats.usage
    ? [
        { name: "Tokens In", value: stats.usage.tokens_in },
        { name: "Tokens Out", value: stats.usage.tokens_out },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Organization Analytics</h2>
        <p className="text-muted-foreground">
          Monitor your organization's usage and performance metrics
        </p>
      </div>

      {/* Plan Badge */}
      {stats.quotas && (
        <div className="flex items-center space-x-4">
          <Badge variant="default" className="text-sm py-1 px-3">
            {stats.quotas.plan.toUpperCase()} PLAN
          </Badge>
          <span className="text-sm text-muted-foreground">
            {stats.quotas.max_users} users • {stats.quotas.max_storage_gb} GB storage
          </span>
        </div>
      )}

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Members"
          value={stats.members.total}
          description={`of ${stats.members.quota || "∞"} allowed`}
          icon={Users}
          quota={
            stats.members.quota
              ? { used: stats.members.total, total: stats.members.quota }
              : undefined
          }
          percentage={stats.members.percentage}
        />

        <StatCard
          title="Storage Used"
          value={`${stats.storage.used_gb} GB`}
          description={`of ${stats.storage.quota_gb || "∞"} GB`}
          icon={HardDrive}
          quota={
            stats.storage.quota_gb
              ? { used: stats.storage.used_gb, total: stats.storage.quota_gb }
              : undefined
          }
          percentage={stats.storage.percentage}
        />

        <StatCard
          title="Total Recordings"
          value={stats.recordings.total}
          description="All time"
          icon={Video}
        />

        <StatCard
          title="Active Sessions"
          value={stats.activity.active_sessions_24h}
          description="Last 24 hours"
          icon={Activity}
        />
      </div>

      {/* Additional Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Departments"
          value={stats.departments.total}
          description="Organization structure"
          icon={Briefcase}
        />

        {stats.usage && (
          <>
            <StatCard
              title="Minutes Transcribed"
              value={stats.usage.minutes_transcribed}
              description={`This ${stats.usage.period}`}
              icon={Clock}
            />

            <StatCard
              title="AI Queries"
              value={stats.usage.queries_count}
              description={`This ${stats.usage.period}`}
              icon={MessageSquare}
            />
          </>
        )}
      </div>

      {/* Charts */}
      <Tabs defaultValue="usage" className="space-y-4">
        <TabsList>
          <TabsTrigger value="usage">Usage Trends</TabsTrigger>
          <TabsTrigger value="storage">Storage Breakdown</TabsTrigger>
          {stats.usage && <TabsTrigger value="ai">AI Usage</TabsTrigger>}
        </TabsList>

        <TabsContent value="usage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Usage</CardTitle>
              <CardDescription>
                Activity breakdown for {stats.usage?.period || "current period"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {usageChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={usageChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  No usage data available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="storage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Storage Distribution</CardTitle>
              <CardDescription>
                Current storage usage breakdown
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={storageChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value} GB`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {storageChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {stats.usage && (
          <TabsContent value="ai" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>AI Token Usage</CardTitle>
                <CardDescription>
                  Input and output tokens for {stats.usage.period}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={tokenChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip
                      formatter={(value: number) =>
                        value.toLocaleString() + " tokens"
                      }
                    />
                    <Bar dataKey="value" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Token Usage Summary */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">
                    Total Tokens Used
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {((stats.usage.tokens_in + stats.usage.tokens_out) / 1000).toFixed(1)}K
                  </div>
                  <div className="flex items-center space-x-4 mt-3 text-xs">
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mr-1" />
                      <span className="text-muted-foreground">
                        Input: {(stats.usage.tokens_in / 1000).toFixed(1)}K
                      </span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-1" />
                      <span className="text-muted-foreground">
                        Output: {(stats.usage.tokens_out / 1000).toFixed(1)}K
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">
                    Average Query Size
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats.usage.queries_count > 0
                      ? Math.round(
                          (stats.usage.tokens_in + stats.usage.tokens_out) /
                            stats.usage.queries_count
                        )
                      : 0}{" "}
                    <span className="text-sm font-normal text-muted-foreground">
                      tokens/query
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Based on {stats.usage.queries_count} total queries
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Features */}
      {stats.quotas?.features && (
        <Card>
          <CardHeader>
            <CardTitle>Enabled Features</CardTitle>
            <CardDescription>
              Features available in your {stats.quotas.plan} plan
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {Object.entries(stats.quotas.features)
                .filter(([_, enabled]) => enabled)
                .map(([feature]) => (
                  <div key={feature} className="flex items-center space-x-2">
                    <Zap className="h-4 w-4 text-green-500" />
                    <span className="text-sm">
                      {feature.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                    </span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}