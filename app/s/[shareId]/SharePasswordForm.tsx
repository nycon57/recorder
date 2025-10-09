'use client';

/**
 * Placeholder component for share password form
 * TODO: Implement password-protected sharing in Phase 5
 */

export default function SharePasswordForm({ shareId }: { shareId: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/20">
      <div className="max-w-md w-full bg-card rounded-lg shadow-lg p-8">
        <h1 className="text-2xl font-bold text-foreground mb-4">Password Required</h1>
        <p className="text-muted-foreground mb-4">
          This shared content is password-protected.
        </p>
        <p className="text-sm text-muted-foreground">
          Share ID: <code className="bg-muted px-2 py-1 rounded">{shareId}</code>
        </p>
      </div>
    </div>
  );
}
