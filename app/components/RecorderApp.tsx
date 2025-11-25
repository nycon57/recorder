'use client';

/**
 * PERF-FE-002: Code-split RecorderInterface
 *
 * The entire recorder UI is dynamically imported to reduce the main bundle size.
 * Users only download the recording code when they visit /record.
 * Estimated savings: ~200KB+ initial bundle reduction
 */

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

import BrowserNotSupported from './recorder/BrowserNotSupported';
import RecorderProviders from './recorder/RecorderProviders';

// PERF-FE-002: Dynamically import the entire recorder interface
// This delays loading all recorder components until user visits /record page
const RecorderInterface = dynamic(
  () => import('./recorder/RecorderInterface'),
  {
    loading: () => (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="size-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading recording studio...</p>
        </div>
      </div>
    ),
    ssr: false, // Recording requires browser APIs
  }
);

export default function RecorderApp() {
  const [isSupported, setIsSupported] = useState<boolean | null>(null);

  useEffect(() => {
    // Check browser support
    const checkSupport = () => {
      const hasDocumentPictureInPicture = 'documentPictureInPicture' in window;
      const hasMediaStreamTrackProcessor =
        'MediaStreamTrackProcessor' in window;
      const hasMediaStreamTrackGenerator =
        'MediaStreamTrackGenerator' in window;

      const supported =
        hasDocumentPictureInPicture &&
        hasMediaStreamTrackProcessor &&
        hasMediaStreamTrackGenerator;

      setIsSupported(supported);
    };

    checkSupport();
  }, []);

  if (isSupported === null) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">
            Checking browser compatibility...
          </p>
        </div>
      </div>
    );
  }

  if (!isSupported) {
    return <BrowserNotSupported />;
  }

  return (
    <RecorderProviders>
      <RecorderInterface />
    </RecorderProviders>
  );
}
