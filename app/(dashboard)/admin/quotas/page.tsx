'use client';

import { useEffect, useState } from 'react';
import { Package, RefreshCw, Edit, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Progress } from '@/app/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';

interface OrganizationQuota {
  id: string;
  name: string;
  searchCount: number;
  searchLimit: number;
  storageUsed: number; // in MB
  storageLimit: number; // in MB
  recordingsCount: number;
  recordingsLimit: number;
  lastUpdated: string;
}

type FilterType = 'all' | 'near-limit' | 'exceeded';

export default function QuotasPage() {
  const [quotas, setQuotas] = useState<OrganizationQuota[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [editingOrg, setEditingOrg] = useState<OrganizationQuota | null>(null);
  const [editForm, setEditForm] = useState({
    searchLimit: 0,
    storageLimit: 0,
    recordingsLimit: 0,
  });
  const [saving, setSaving] = useState(false);

  // Set page title
  useEffect(() => {
    document.title = 'Quota Management - Admin - Record';
  }, []);

  const fetchQuotas = async () => {
    try {
      const response = await fetch('/api/admin/quotas');

      if (!response.ok) {
        throw new Error(`Failed to fetch quotas: ${response.statusText}`);
      }

      const data = await response.json();
      setQuotas(data.quotas || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching quotas:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch quotas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotas();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchQuotas, 30000);
    return () => clearInterval(interval);
  }, []);

  const calculateUsagePercentage = (used: number, limit: number): number => {
    if (limit === 0) return 0;
    return Math.min((used / limit) * 100, 100);
  };

  const getUsageColor = (percentage: number): string => {
    if (percentage >= 100) return 'bg-destructive';
    if (percentage >= 80) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getUsageBadge = (percentage: number) => {
    if (percentage >= 100) {
      return <Badge variant="destructive">Exceeded</Badge>;
    } else if (percentage >= 80) {
      return <Badge variant="outline" className="border-yellow-500 text-yellow-700 dark:text-yellow-400">Near Limit</Badge>;
    }
    return <Badge variant="outline" className="border-green-500 text-green-700 dark:text-green-400">Normal</Badge>;
  };

  const filteredQuotas = quotas.filter((quota) => {
    const searchPercentage = calculateUsagePercentage(quota.searchCount, quota.searchLimit);
    const storagePercentage = calculateUsagePercentage(quota.storageUsed, quota.storageLimit);
    const recordingsPercentage = calculateUsagePercentage(quota.recordingsCount, quota.recordingsLimit);
    const maxPercentage = Math.max(searchPercentage, storagePercentage, recordingsPercentage);

    if (filter === 'exceeded') {
      return maxPercentage >= 100;
    } else if (filter === 'near-limit') {
      return maxPercentage >= 80 && maxPercentage < 100;
    }
    return true;
  });

  const handleEdit = (quota: OrganizationQuota) => {
    setEditingOrg(quota);
    setEditForm({
      searchLimit: quota.searchLimit,
      storageLimit: quota.storageLimit,
      recordingsLimit: quota.recordingsLimit,
    });
  };

  const handleSave = async () => {
    if (!editingOrg) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/admin/quotas/${editingOrg.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      if (!response.ok) {
        throw new Error('Failed to update quota');
      }

      await fetchQuotas();
      setEditingOrg(null);
    } catch (err) {
      console.error('Error updating quota:', err);
      alert('Failed to update quota');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async (orgId: string) => {
    if (!confirm('Are you sure you want to reset usage counters for this organization?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/quotas/${orgId}/reset`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to reset quota');
      }

      await fetchQuotas();
    } catch (err) {
      console.error('Error resetting quota:', err);
      alert('Failed to reset quota');
    }
  };

  const formatStorage = (mb: number): string => {
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(2)} GB`;
    }
    return `${mb.toFixed(0)} MB`;
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-8 p-8">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-8 p-8">
        <Card>
          <CardContent className="pt-6">
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 p-8">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Package className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Quota Management</h1>
              <p className="text-muted-foreground">Manage organization quotas and limits</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchQuotas} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-2">
        {(['all', 'near-limit', 'exceeded'] as const).map((filterOption) => (
          <Button
            key={filterOption}
            variant={filter === filterOption ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(filterOption)}
          >
            {filterOption === 'all' && 'All Organizations'}
            {filterOption === 'near-limit' && 'Near Limit (>80%)'}
            {filterOption === 'exceeded' && 'Exceeded'}
          </Button>
        ))}
      </div>

      {/* Quotas Table */}
      <Card>
        <CardContent className="pt-6">
          {filteredQuotas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No organizations found matching the selected filter
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organization</TableHead>
                    <TableHead>Searches</TableHead>
                    <TableHead>Storage</TableHead>
                    <TableHead>Recordings</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredQuotas.map((quota) => {
                    const searchPercentage = calculateUsagePercentage(quota.searchCount, quota.searchLimit);
                    const storagePercentage = calculateUsagePercentage(quota.storageUsed, quota.storageLimit);
                    const recordingsPercentage = calculateUsagePercentage(quota.recordingsCount, quota.recordingsLimit);
                    const maxPercentage = Math.max(searchPercentage, storagePercentage, recordingsPercentage);

                    return (
                      <TableRow key={quota.id}>
                        <TableCell className="font-medium">
                          <div>
                            <div className="font-semibold">{quota.name}</div>
                            <div className="text-xs text-muted-foreground">
                              Updated: {new Date(quota.lastUpdated).toLocaleString()}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span>{quota.searchCount.toLocaleString()} / {quota.searchLimit.toLocaleString()}</span>
                              <span className="text-xs text-muted-foreground">{searchPercentage.toFixed(0)}%</span>
                            </div>
                            <Progress
                              value={searchPercentage}
                              className="h-2"
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span>{formatStorage(quota.storageUsed)} / {formatStorage(quota.storageLimit)}</span>
                              <span className="text-xs text-muted-foreground">{storagePercentage.toFixed(0)}%</span>
                            </div>
                            <Progress
                              value={storagePercentage}
                              className="h-2"
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span>{quota.recordingsCount} / {quota.recordingsLimit}</span>
                              <span className="text-xs text-muted-foreground">{recordingsPercentage.toFixed(0)}%</span>
                            </div>
                            <Progress
                              value={recordingsPercentage}
                              className="h-2"
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          {getUsageBadge(maxPercentage)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEdit(quota)}
                            >
                              <Edit className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleReset(quota.id)}
                            >
                              <RotateCcw className="h-3 w-3 mr-1" />
                              Reset
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editingOrg !== null} onOpenChange={(open) => !open && setEditingOrg(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Quota Limits</DialogTitle>
            <DialogDescription>
              Update quota limits for {editingOrg?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="searchLimit">Search Limit (per month)</Label>
              <Input
                id="searchLimit"
                type="number"
                value={editForm.searchLimit}
                onChange={(e) => setEditForm({ ...editForm, searchLimit: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="storageLimit">Storage Limit (MB)</Label>
              <Input
                id="storageLimit"
                type="number"
                value={editForm.storageLimit}
                onChange={(e) => setEditForm({ ...editForm, storageLimit: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="recordingsLimit">Recordings Limit</Label>
              <Input
                id="recordingsLimit"
                type="number"
                value={editForm.recordingsLimit}
                onChange={(e) => setEditForm({ ...editForm, recordingsLimit: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingOrg(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Footer Info */}
      <div className="text-xs text-muted-foreground text-center border-t pt-4">
        Quotas auto-refresh every 30 seconds
      </div>
    </div>
  );
}
