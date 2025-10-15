'use client';

import { useState, useEffect } from 'react';

import BrowserNotSupported from './recorder/BrowserNotSupported';
import RecorderProviders from './recorder/RecorderProviders';
import RecorderInterface from './recorder/RecorderInterface';

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
