'use client';

import * as React from 'react';
import { Copy, ExternalLink, Trash2, Loader2, Lock, Globe } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/app/components/ui/radio-group';
import { Separator } from '@/app/components/ui/separator';
import { Badge } from '@/app/components/ui/badge';
import { ScrollArea } from '@/app/components/ui/scroll-area';

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

interface ShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordingId: string;
  shares: Share[];
  onShareCreated?: () => void;
  onShareRevoked?: () => void;
}

export default function ShareModal({
  open,
  onOpenChange,
  recordingId,
  shares,
  onShareCreated,
  onShareRevoked,
}: ShareModalProps) {
  const [shareType, setShareType] = React.useState<'public' | 'password'>('public');
  const [password, setPassword] = React.useState('');
  const [expiresAt, setExpiresAt] = React.useState('');
  const [isCreating, setIsCreating] = React.useState(false);
  const [revokingId, setRevokingId] = React.useState<string | null>(null);

  const handleCreateShare = async () => {
    setIsCreating(true);
    try {
      const body: any = {
        target_type: 'recording',
        target_id: recordingId,
      };

      if (shareType === 'password' && password) {
        body.password = password;
      }

      if (expiresAt) {
        body.expires_at = new Date(expiresAt).toISOString();
      }

      const response = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create share');
      }

      const data = await response.json();
      toast.success('Share link created successfully');

      // Copy the share URL to clipboard
      const shareUrl = `${window.location.origin}/s/${data.data.share_id}`;
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Share link copied to clipboard');

      // Reset form
      setPassword('');
      setExpiresAt('');
      setShareType('public');

      // Notify parent
      if (onShareCreated) {
        onShareCreated();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create share');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevokeShare = async (shareId: string) => {
    if (!confirm('Are you sure you want to revoke this share link?')) {
      return;
    }

    setRevokingId(shareId);
    try {
      const response = await fetch(`/api/share/${shareId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to revoke share');
      }

      toast.success('Share link revoked');

      // Notify parent
      if (onShareRevoked) {
        onShareRevoked();
      }
    } catch (error) {
      toast.error('Failed to revoke share');
    } finally {
      setRevokingId(null);
    }
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
    return formatDate(dateString);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Share Recording</DialogTitle>
          <DialogDescription>
            Create a shareable link for this recording. You can optionally add password protection.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 flex-1 overflow-y-auto">
          {/* Create New Share Form */}
          <div className="space-y-4">
            <div className="space-y-3">
              <Label>Share Type</Label>
              <RadioGroup value={shareType} onValueChange={(v: any) => setShareType(v)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="public" id="public" />
                  <Label htmlFor="public" className="font-normal cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Globe className="size-4 text-muted-foreground" />
                      <span>Public - Anyone with the link can view</span>
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="password" id="password" />
                  <Label htmlFor="password" className="font-normal cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Lock className="size-4 text-muted-foreground" />
                      <span>Password Protected - Requires password to view</span>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {shareType === 'password' && (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="expires">Expiration Date (Optional)</Label>
              <Input
                id="expires"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            <Button
              onClick={handleCreateShare}
              disabled={isCreating || (shareType === 'password' && !password)}
              className="w-full"
            >
              {isCreating ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Share Link'
              )}
            </Button>
          </div>

          {/* Existing Shares */}
          {shares.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="text-sm font-semibold">Active Shares ({shares.length})</h4>
                <ScrollArea className="max-h-[300px]">
                  <div className="space-y-3">
                    {shares.map((share) => (
                      <div
                        key={share.id}
                        className="border rounded-md p-4 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {share.password_hash ? (
                                <Badge variant="outline">
                                  <Lock className="size-3" />
                                  Password Protected
                                </Badge>
                              ) : (
                                <Badge variant="outline">
                                  <Globe className="size-3" />
                                  Public
                                </Badge>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {share.access_count} views
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Created {getRelativeTime(share.created_at)}
                            </p>
                            {share.expires_at && (
                              <p className="text-xs text-muted-foreground">
                                Expires {formatDate(share.expires_at)}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              onClick={() => handleCopyShareLink(share.share_id)}
                            >
                              <Copy className="size-4" />
                            </Button>
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              onClick={() => window.open(`/s/${share.share_id}`, '_blank')}
                            >
                              <ExternalLink className="size-4" />
                            </Button>
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              onClick={() => handleRevokeShare(share.id)}
                              disabled={revokingId === share.id}
                            >
                              {revokingId === share.id ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <Trash2 className="size-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            readOnly
                            value={`${window.location.origin}/s/${share.share_id}`}
                            className="text-xs font-mono"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
