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

import { useReducer } from 'react';
import { useQuery } from '@tanstack/react-query';
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

type KnowledgeConfigResult = {
  configExists: boolean;
  selectedApps: string[];
  availableApps: string[];
};

type KnowledgeState = {
  saving: boolean;
  configExists: boolean;
  availableApps: string[];
  selectedApps: Set<string>;
};

type KnowledgeAction =
  | { type: 'toggle'; app: string }
  | { type: 'patch'; patch: Partial<KnowledgeState> };

const emptyKnowledgeState: KnowledgeState = {
  saving: false,
  configExists: false,
  availableApps: [],
  selectedApps: new Set(),
};

function createKnowledgeState(result: KnowledgeConfigResult): KnowledgeState {
  return {
    ...emptyKnowledgeState,
    configExists: result.configExists,
    availableApps: result.availableApps,
    selectedApps: new Set(result.selectedApps),
  };
}

function knowledgeReducer(
  state: KnowledgeState,
  action: KnowledgeAction,
): KnowledgeState {
  if (action.type === 'patch') {
    return { ...state, ...action.patch };
  }

  if (action.type === 'toggle') {
    const selectedApps = new Set(state.selectedApps);
    if (selectedApps.has(action.app)) {
      selectedApps.delete(action.app);
    } else {
      selectedApps.add(action.app);
    }
    return { ...state, selectedApps };
  }

  return state;
}

async function fetchKnowledgeConfig(
  signal: AbortSignal,
): Promise<KnowledgeConfigResult> {
  const [configRes, appsRes] = await Promise.all([
    fetch('/api/vendor/config', { signal }),
    fetch('/api/vendor/knowledge-apps', { signal }),
  ]);

  let configExists = false;
  let selectedApps: string[] = [];
  if (configRes.ok) {
    const configJson = await configRes.json();
    configExists = true;
    selectedApps = configJson.data.knowledge_scope ?? [];
  } else if (configRes.status !== 404) {
    throw new Error('Failed to load knowledge configuration');
  }

  if (!appsRes.ok) {
    throw new Error('Failed to load available knowledge apps');
  }

  const appsJson = await appsRes.json();
  return {
    configExists,
    selectedApps,
    availableApps: appsJson.data ?? [],
  };
}

export default function KnowledgePage() {
  const {
    data: configResult,
    isLoading,
    error,
  } = useQuery<KnowledgeConfigResult, Error>({
    queryKey: ['vendor', 'knowledge-config'],
    queryFn: ({ signal }) => fetchKnowledgeConfig(signal),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16" role="status">
        <div className="text-center">
          <Loader2 className="mx-auto size-8 animate-spin text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            Loading knowledge configuration…
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="trbd-page">
        <header>
          <h1 className="trbd-page-title tracking-tight flex items-center gap-2">
            <BookOpen className="size-7" />
            Knowledge Scope
          </h1>
        </header>
        <Card>
          <CardHeader>
            <CardTitle>Unable to load knowledge scope</CardTitle>
            <CardDescription>{error.message}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <KnowledgeForm
      configResult={
        configResult ?? {
          configExists: false,
          selectedApps: [],
          availableApps: [],
        }
      }
    />
  );
}

function KnowledgeForm({
  configResult,
}: {
  configResult: KnowledgeConfigResult;
}) {
  const { push, refresh } = useRouter();
  const [state, dispatch] = useReducer(
    knowledgeReducer,
    configResult,
    createKnowledgeState,
  );
  const { saving, configExists, availableApps, selectedApps } = state;

  function toggleApp(app: string) {
    dispatch({ type: 'toggle', app });
  }

  async function handleSave() {
    if (!configExists) {
      toast.error(
        'Please set up your white-label configuration in Branding first.',
      );
      return;
    }

    dispatch({ type: 'patch', patch: { saving: true } });
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
        throw new Error(err.error?.message ?? err.message ?? 'Failed to save');
      }

      toast.success('Knowledge scope updated successfully');
      refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to save knowledge scope',
      );
    } finally {
      dispatch({ type: 'patch', patch: { saving: false } });
    }
  }

  if (!configExists) {
    return (
      <div className="trbd-page">
        <header>
          <h1 className="trbd-page-title tracking-tight flex items-center gap-2">
            <BookOpen className="size-7" />
            Knowledge Scope
          </h1>
        </header>
        <Card>
          <CardHeader>
            <CardTitle>Configuration required</CardTitle>
            <CardDescription>
              You need to set up your white-label configuration first. Go to
              Branding to create your config, then come back here to configure
              knowledge scoping.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => push('/vendor-admin/branding')}
            >
              Go to Branding
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="trbd-page">
      <header>
        <h1 className="trbd-page-title tracking-tight flex items-center gap-2">
          <BookOpen className="size-7" />
          Knowledge Scope
        </h1>
        <p className="mt-1 text-muted-foreground">
          Select which apps are included in your customers&apos; knowledge base.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Available Apps</CardTitle>
          <CardDescription>
            Check the apps you want to include in the knowledge scope. Unchecked
            apps will be excluded from vendor wiki queries.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {availableApps.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <Inbox className="size-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                No vendor wiki pages found. Apps will appear here once vendor
                documentation has been ingested.
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
                {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
                Save knowledge scope
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
