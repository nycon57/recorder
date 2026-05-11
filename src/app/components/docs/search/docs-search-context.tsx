'use client';

import React, { createContext, useCallback, use, useState } from 'react';

import type { Audience } from '@/lib/docs';

// ── Context types ─────────────────────────────────────────────────────────────

interface DocsSearchContextValue {
  /** Whether the ⌘K search dialog is open. */
  isOpen: boolean;
  /** The resolved audience, used to fetch the correct index. */
  audience: Audience;
  /** Open the search dialog. */
  open: () => void;
  /** Close the search dialog. */
  close: () => void;
  /** Toggle the search dialog. */
  toggle: () => void;
}

const DocsSearchContext = createContext<DocsSearchContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

interface DocsSearchProviderProps {
  children: React.ReactNode;
  audience: Audience;
}

/**
 * Provide ⌘K open/close state to the docs shell.
 * Wrap `{children}` in `src/app/(docs)/layout.tsx`.
 */
export function DocsSearchProvider({ children, audience }: DocsSearchProviderProps) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  return (
    <DocsSearchContext.Provider value={{ isOpen, audience, open, close, toggle }}>
      {children}
    </DocsSearchContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/** Consume search context inside the docs shell. */
export function useDocsSearch(): DocsSearchContextValue {
  const ctx = use(DocsSearchContext);
  if (!ctx) {
    throw new Error('useDocsSearch must be used inside <DocsSearchProvider>');
  }
  return ctx;
}
