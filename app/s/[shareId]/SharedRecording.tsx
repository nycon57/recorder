'use client';

/**
 * Placeholder component for shared recording view
 * TODO: Implement public sharing in Phase 5
 */

export default function SharedRecording({ share }: { share: any }) {
  return (
    <div className="min-h-screen bg-muted/20 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-card rounded-lg shadow-lg p-8">
          <h1 className="text-2xl font-bold text-foreground mb-4">Shared Recording</h1>
          <p className="text-muted-foreground">
            Public recording sharing coming soon in Phase 5.
          </p>
        </div>
      </div>
    </div>
  );
}
