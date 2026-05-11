'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Share2, Loader2 } from 'lucide-react';

import { Button } from '@/app/components/ui/button';
import ShareModal from '@/app/components/ShareModal';

interface Share {
  id: string;
  share_id: string;
  target_type: string;
  target_id: string;
  access_count: number;
  created_at: string;
  expires_at: string | null;
  password_hash: string | null;
}

interface ShareControlsProps {
  recordingId: string;
  className?: string;
}

export default function ShareControls({
  recordingId,
  className,
}: ShareControlsProps) {
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const {
    data: shares = [],
    isFetching: isFetchingShares,
    refetch: refetchShares,
  } = useQuery<Share[]>({
    queryKey: ['shares', recordingId],
    enabled: isModalOpen,
    queryFn: async () => {
      const response = await fetch(`/api/share?target_id=${recordingId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch shares');
      }

      const data = await response.json();
      return data.data || [];
    },
  });

  const handleShareCreated = () => {
    void refetchShares();
  };

  const handleShareRevoked = () => {
    void refetchShares();
  };

  return (
    <>
      <Button
        variant="outline"
        className={className}
        onClick={() => setIsModalOpen(true)}
      >
        {isFetchingShares ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Share2 className="size-4" />
        )}
        Share
      </Button>

      <ShareModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        recordingId={recordingId}
        shares={shares}
        onShareCreated={handleShareCreated}
        onShareRevoked={handleShareRevoked}
      />
    </>
  );
}
