'use client';

import * as React from 'react';
import { Copy, Globe, Lock, Plus, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import ShareModal from './ShareModal';

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

interface SharesListProps {
  shares: Share[];
  recordingId: string;
  onShareCreated?: () => void;
  onShareRevoked?: () => void;
}

export default function SharesList({
  shares,
  recordingId,
  onShareCreated,
  onShareRevoked,
}: SharesListProps) {
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
    return `${Math.floor(diffInDays / 30)} months ago`;
  };

  const handleCopyShareLink = async (shareId: string) => {
    const shareUrl = `${window.location.origin}/s/${shareId}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Share link copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy link');
    }
  };

  const handleShareAction = () => {
    setIsModalOpen(false);
    if (onShareCreated || onShareRevoked) {
      // Refresh the page to show updated shares
      window.location.reload();
    }
  };

  const visibleShares = shares.slice(0, 3);
  const hasMoreShares = shares.length > 3;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Shares</CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsModalOpen(true)}
            >
              <Plus className="size-4" />
              Create
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {shares.length === 0 ? (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-3">
                <Globe className="size-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                No active shares. Create one to share this recording.
              </p>
              <Button
                size="sm"
                onClick={() => setIsModalOpen(true)}
              >
                <Plus className="size-4" />
                Create Share
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleShares.map((share) => (
                <div
                  key={share.id}
                  className="border rounded-md p-3 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {share.password_hash ? (
                        <Badge variant="outline" className="text-xs">
                          <Lock className="size-3" />
                          Password
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          <Globe className="size-3" />
                          Public
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {share.access_count} {share.access_count === 1 ? 'view' : 'views'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => handleCopyShareLink(share.share_id)}
                      >
                        <Copy className="size-3.5" />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => window.open(`/s/${share.share_id}`, '_blank')}
                      >
                        <ExternalLink className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Created {getRelativeTime(share.created_at)}
                  </p>
                </div>
              ))}

              {hasMoreShares && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => setIsModalOpen(true)}
                >
                  View All Shares ({shares.length})
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <ShareModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        recordingId={recordingId}
        shares={shares}
        onShareCreated={handleShareAction}
        onShareRevoked={handleShareAction}
      />
    </>
  );
}
