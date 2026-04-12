'use client';

/**
 * Vendor Admin — Knowledge Scoping (TRIB-53)
 *
 * Client Component that lists all apps with vendor wiki pages and lets
 * the vendor toggle which ones are included in their knowledge scope.
 *
 * Fetches available apps via the vendor wiki pages table (through a
 * lightweight API call) and saves the selection via PUT /api/vendor/config.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { BookOpen, Loader2, Inbox } from 'lucide-react';

import { Button } from '@/app/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/app/components/ui/card';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Label } from '@/app/components/ui/label';

export default function KnowledgePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configExists, setConfigExists] = useState(false);

  const [availableApps, setAvailableApps] = useState<string[]>([]);
  const [selectedApps, setSelectedApps] = useState<Set<string>>(
    new Set()
  );

  // Fetch config + available apps on mount
  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch config and available apps in parallel
        const [configRes, appsRes] = await Promise.all([
          fetch('/api/vendor/config'),
          fetch('/api/vendor/knowledge-apps'),
        ]);

        if (configRes.ok) {
          const configJson = await configRes.json();
          const config = configJson.data;
          setConfigExists(true);
          setSelectedApps(
            new Set(config.knowledge_scope ?? [])
          );
        } else if (configRes.status === 404) {
          setConfigExists(false);
        }

        if (appsRes.ok) {
          const appsJson = await appsRes.json();
          setAvailableApps(appsJson.data ?? []);
        }
      } catch {
        toast.error('Failed to load knowledge configuration');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  function toggleApp(app: string) {
    setSelectedApps((prev) => {
      const next = new Set(prev);
      if (next.has(app)) {
        next.delete(app);
      } else {
        next.add(app);
      }
      return next;
    });
  }

  async function handleSave() {
    if (!configExists) {
      toast.error(
        'Please set up your white-label configuration in Branding first.'
      );
      return;
    }

    setSaving(true);
    try {
      const knowledge_scope =
        selectedApps.size > 0 ? Array.from(selectedApps).sort() : null;

      const res = await fetch('/api/vendor/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ knowledge_scope }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          err.error?.message ?? err.message ?? 'Failed to save'
        );
      }

      toast.success('Knowledge scope updated successfully');
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'Failed to save knowledge scope'
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div
        className="flex items-center justify-center py-16"
        role="status"
      >
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            Loading knowledge configuration...
          </p>
        </div>
      </div>
    );
  }

  if (!configExists) {
    return (
      <div className="container mx-auto space-y-6 py-8">
        <header>
          <h1 className="text-3xl font-normal tracking-tight flex items-center gap-2">
            <BookOpen className="h-7 w-7" />
            Knowledge Scope
          </h1>
        </header>
        <Card>
          <CardHeader>
            <CardTitle>Configuration required</CardTitle>
            <CardDescription>
              You need to set up your white-label configuration first.
              Go to Branding to create your config, then come back here
              to configure knowledge scoping.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => router.push('/vendor-admin/branding')}
            >
              Go to Branding
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 py-8">
      <header>
        <h1 className="text-3xl font-normal tracking-tight flex items-center gap-2">
          <BookOpen className="h-7 w-7" />
          Knowledge Scope
        </h1>
        <p className="mt-1 text-muted-foreground">
          Select which apps are included in your customers' knowledge
          base.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Available Apps</CardTitle>
          <CardDescription>
            Check the apps you want to include in the knowledge scope.
            Unchecked apps will be excluded from vendor wiki queries.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {availableApps.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <Inbox className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                No vendor wiki pages found. Apps will appear here once
                vendor documentation has been ingested.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {availableApps.map((app) => (
                <div
                  key={app}
                  className="flex items-center gap-3 rounded-md px-3 py-2 bg-muted/50"
                >
                  <Checkbox
                    id={`app-${app}`}
                    checked={selectedApps.has(app)}
                    onCheckedChange={() => toggleApp(app)}
                  />
                  <Label
                    htmlFor={`app-${app}`}
                    className="flex-1 cursor-pointer text-sm font-medium"
                  >
                    {app}
                  </Label>
                </div>
              ))}
            </div>
          )}

          {/* Save */}
          {availableApps.length > 0 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-muted-foreground">
                {selectedApps.size} of {availableApps.length} app
                {availableApps.length !== 1 ? 's' : ''} selected
              </p>
              <Button onClick={handleSave} disabled={saving}>
                {saving && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save knowledge scope
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
