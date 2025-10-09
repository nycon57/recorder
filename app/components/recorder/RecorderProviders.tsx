'use client';

import { RecordingProvider } from '@/app/(dashboard)/record/contexts/RecordingContext';

interface RecorderProvidersProps {
  children: React.ReactNode;
}

export default function RecorderProviders({
  children,
}: RecorderProvidersProps) {
  return <RecordingProvider>{children}</RecordingProvider>;
}
