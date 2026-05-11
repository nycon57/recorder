'use client';

import { useReducer, useCallback, useRef, useEffect } from 'react';
import { Pencil, Merge, Trash2, Loader2, Check } from 'lucide-react';

import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/app/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { type ConceptType, CONCEPT_TYPES } from '@/lib/validations/knowledge';

type CorrectionMode = 'edit' | 'merge' | 'incorrect';

interface ConceptCorrectionProps {
  conceptId: string;
  conceptName: string;
  conceptType: ConceptType;
  onCorrected?: (action: 'updated' | 'merged' | 'deleted') => void;
}

const TYPE_LABELS: Record<ConceptType, string> = {
  tool: 'Tool',
  process: 'Process',
  person: 'Person',
  organization: 'Organization',
  technical_term: 'Technical Term',
  general: 'General',
};

const MODE_ACTIONS: Record<CorrectionMode, 'updated' | 'merged' | 'deleted'> = {
  edit: 'updated',
  merge: 'merged',
  incorrect: 'deleted',
};

const MODE_LABELS: Record<CorrectionMode, string> = {
  edit: 'Save',
  merge: 'Merge',
  incorrect: 'Remove',
};

interface ConceptCorrectionState {
  open: boolean;
  mode: CorrectionMode;
  name: string;
  type: ConceptType;
  mergeTargetId: string;
  mergeSearch: string;
  mergeResults: Array<{ id: string; name: string; conceptType: ConceptType }>;
  isSearching: boolean;
  isSaving: boolean;
  error: string | null;
}

const createInitialConceptCorrectionState = ({
  conceptName,
  conceptType,
}: Pick<
  ConceptCorrectionProps,
  'conceptName' | 'conceptType'
>): ConceptCorrectionState => ({
  open: false,
  mode: 'edit',
  name: conceptName,
  type: conceptType,
  mergeTargetId: '',
  mergeSearch: '',
  mergeResults: [],
  isSearching: false,
  isSaving: false,
  error: null,
});

const conceptCorrectionReducer = (
  state: ConceptCorrectionState,
  patch: Partial<ConceptCorrectionState>,
): ConceptCorrectionState => ({
  ...state,
  ...patch,
});

export function ConceptCorrection(
  props: Parameters<typeof useConceptCorrectionImplementation>[0],
) {
  return useConceptCorrectionImplementation(props);
}

function useConceptCorrectionImplementation({
  conceptId,
  conceptName,
  conceptType,
  onCorrected,
}: ConceptCorrectionProps) {
  const [
    {
      open,
      mode,
      name,
      type,
      mergeTargetId,
      mergeSearch,
      mergeResults,
      isSearching,
      isSaving,
      error,
    },
    updateCorrectionState,
  ] = useReducer(
    conceptCorrectionReducer,
    { conceptName, conceptType },
    createInitialConceptCorrectionState,
  );

  const resetState = useCallback(() => {
    updateCorrectionState({
      mode: 'edit',
      name: conceptName,
      type: conceptType,
      mergeTargetId: '',
      mergeSearch: '',
      mergeResults: [],
      error: null,
    });
  }, [conceptName, conceptType]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      updateCorrectionState({ open: nextOpen });
      if (nextOpen) resetState();
    },
    [resetState],
  );

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      abortControllerRef.current?.abort();
    };
  }, []);

  const searchConcepts = useCallback(
    async (query: string) => {
      if (query.length < 2) {
        updateCorrectionState({
          mergeResults: [],
          isSearching: false,
        });
        return;
      }

      // Abort any in-flight request before starting a new one.
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      updateCorrectionState({ isSearching: true });
      try {
        const params = new URLSearchParams({ search: query, limit: '10' });
        const res = await fetch(`/api/knowledge/concepts?${params}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error('Search failed');
        const result = await res.json();
        const concepts = (result.data?.concepts ?? []).filter(
          (c: { id: string }) => c.id !== conceptId,
        );
        updateCorrectionState({ mergeResults: concepts });
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        updateCorrectionState({ mergeResults: [] });
      } finally {
        if (!controller.signal.aborted) {
          updateCorrectionState({ isSearching: false });
        }
      }
    },
    [conceptId],
  );

  const handleMergeSearchChange = useCallback(
    (value: string) => {
      updateCorrectionState({
        mergeSearch: value,
        mergeTargetId: '',
      });
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (value.length < 2) {
        updateCorrectionState({ mergeResults: [] });
        return;
      }
      updateCorrectionState({ isSearching: true });
      debounceTimerRef.current = setTimeout(() => searchConcepts(value), 250);
    },
    [searchConcepts],
  );

  const handleSave = useCallback(async () => {
    updateCorrectionState({
      isSaving: true,
      error: null,
    });

    try {
      let body: Record<string, unknown>;

      if (mode === 'merge') {
        if (!mergeTargetId) {
          updateCorrectionState({
            error: 'Select a concept to merge into',
            isSaving: false,
          });
          return;
        }
        body = { merge_into_id: mergeTargetId };
      } else if (mode === 'incorrect') {
        body = { marked_incorrect: true };
      } else {
        body = {};
        if (name.trim() && name !== conceptName) body.name = name.trim();
        if (type !== conceptType) body.concept_type = type;
        if (Object.keys(body).length === 0) {
          updateCorrectionState({ open: false });
          return;
        }
      }

      const res = await fetch(`/api/concepts/${conceptId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to update concept');
      }

      updateCorrectionState({ open: false });
      onCorrected?.(MODE_ACTIONS[mode]);
    } catch (err) {
      updateCorrectionState({
        error: err instanceof Error ? err.message : 'Something went wrong',
      });
    } finally {
      updateCorrectionState({ isSaving: false });
    }
  }, [
    mode,
    name,
    type,
    mergeTargetId,
    conceptId,
    conceptName,
    conceptType,
    onCorrected,
  ]);

  const selectedMergeTarget = mergeResults.find((c) => c.id === mergeTargetId);

  return (
    <>
      <button
        type="button"
        onClick={() => handleOpenChange(true)}
        className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        aria-label={`Edit concept "${conceptName}"`}
      >
        <Pencil aria-hidden="true" className="size-3.5" />
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Concept</DialogTitle>
          </DialogHeader>

          <div
            className="flex gap-1 rounded-lg bg-muted/50 p-1"
            role="tablist"
            aria-label="Correction mode"
          >
            {(
              [
                { key: 'edit', label: 'Edit', icon: Pencil },
                { key: 'merge', label: 'Merge', icon: Merge },
                { key: 'incorrect', label: 'Remove', icon: Trash2 },
              ] as const
            ).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                role="tab"
                aria-selected={mode === key}
                aria-controls={`correction-panel-${key}`}
                id={`correction-tab-${key}`}
                onClick={() => updateCorrectionState({ mode: key })}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
                  mode === key
                    ? 'bg-background font-medium text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon aria-hidden="true" className="size-3.5" />
                {label}
              </button>
            ))}
          </div>

          {mode === 'edit' && (
            <div
              id="correction-panel-edit"
              role="tabpanel"
              aria-labelledby="correction-tab-edit"
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="concept-name">Name</Label>
                <Input
                  id="concept-name"
                  value={name}
                  onChange={(e) =>
                    updateCorrectionState({ name: e.target.value })
                  }
                  placeholder="Concept name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="concept-type">Type</Label>
                <Select
                  value={type}
                  onValueChange={(v) =>
                    updateCorrectionState({ type: v as ConceptType })
                  }
                >
                  <SelectTrigger id="concept-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONCEPT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {mode === 'merge' && (
            <div
              id="correction-panel-merge"
              role="tabpanel"
              aria-labelledby="correction-tab-merge"
              className="space-y-3"
            >
              <p className="text-sm text-muted-foreground">
                Merge <strong>{conceptName}</strong> into another concept. All
                mentions will be reassigned.
              </p>
              <div className="space-y-2">
                <Label htmlFor="merge-search">Search for target concept</Label>
                <Input
                  id="merge-search"
                  value={mergeSearch}
                  onChange={(e) => handleMergeSearchChange(e.target.value)}
                  placeholder="Type to search…"
                />
              </div>
              {isSearching && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2
                    aria-hidden="true"
                    className="size-3.5 animate-spin"
                  />
                  Searching…
                </div>
              )}
              {mergeResults.length > 0 && (
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-1">
                  {mergeResults.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() =>
                        updateCorrectionState({ mergeTargetId: c.id })
                      }
                      className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors ${
                        mergeTargetId === c.id
                          ? 'bg-accent/20 text-foreground'
                          : 'hover:bg-muted'
                      }`}
                    >
                      {mergeTargetId === c.id && (
                        <Check
                          aria-hidden="true"
                          className="size-3.5 text-accent"
                        />
                      )}
                      <span className="truncate">{c.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground capitalize">
                        {TYPE_LABELS[c.conceptType]}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {selectedMergeTarget && (
                <p className="text-sm">
                  Will merge into: <strong>{selectedMergeTarget.name}</strong>
                </p>
              )}
            </div>
          )}

          {mode === 'incorrect' && (
            <div
              id="correction-panel-incorrect"
              role="tabpanel"
              aria-labelledby="correction-tab-incorrect"
              className="space-y-2"
            >
              <p className="text-sm text-muted-foreground">
                Mark <strong>{conceptName}</strong> as incorrect. This will
                remove the concept and all its mentions from the knowledge
                graph.
              </p>
              <p className="text-sm font-medium text-destructive">
                This action cannot be undone.
              </p>
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isSaving}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              variant={mode === 'incorrect' ? 'destructive' : 'default'}
            >
              {isSaving && (
                <Loader2
                  aria-hidden="true"
                  className="mr-2 size-4 animate-spin"
                />
              )}
              {MODE_LABELS[mode]}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
