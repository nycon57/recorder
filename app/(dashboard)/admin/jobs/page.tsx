'use client';

import { useEffect } from 'react';
import { Zap } from 'lucide-react';

// Component imports
import JobsQueue from '../components/JobsQueue';

export default function JobsPage() {
  // Set page title
  useEffect(() => {
    document.title = 'Job Queue - Admin - Record';
  }, []);

  return (
    <div className="flex flex-col gap-8 p-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Zap className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Job Queue</h1>
            <p className="text-muted-foreground">Background job processing status</p>
          </div>
        </div>
      </div>

      {/* Job Queue Component */}
      <JobsQueue />

      {/* Footer Info */}
      <div className="text-xs text-muted-foreground text-center border-t pt-4">
        Job queue auto-refreshes every 5 seconds
      </div>
    </div>
  );
}
