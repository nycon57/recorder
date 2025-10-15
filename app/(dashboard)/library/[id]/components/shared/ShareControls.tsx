'use client';

import * as React from 'react';
import { Share2, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

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
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [shares, setShares] = React.useState<Share[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  // Fetch existing shares when modal opens
  React.useEffect(() => {
    if (isModalOpen) {
      fetchShares();
    }
  }, [isModalOpen]);

  const fetchShares = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/share?target_id=${recordingId}`);
      if (response.ok) {
        const data = await response.json();
        setShares(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch shares:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleShareCreated = () => {
    fetchShares();
  };

  const handleShareRevoked = () => {
    fetchShares();
  };

  return (
    <>
      <Button
        variant="outline"
        className={className}
        onClick={() => setIsModalOpen(true)}
      >
        {isLoading ? (
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
