'use client';

import * as React from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  MessageSquare,
  Clock,
  Edit2,
  Trash2,
  Loader2,
  Send,
  Check,
  X,
} from 'lucide-react';

import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Textarea } from '@/app/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/app/components/ui/avatar';
import { Badge } from '@/app/components/ui/badge';
import { ScrollArea } from '@/app/components/ui/scroll-area';
import { Separator } from '@/app/components/ui/separator';
import { toast } from 'sonner';

import type { CommentWithUser } from '@/lib/types/database';

interface TimeStampedCommentsProps {
  /**
   * Recording ID
   */
  recordingId: string;

  /**
   * Current playback time in seconds (for adding timestamps to new comments)
   */
  currentTime?: number;

  /**
   * Callback when user clicks on a timestamp (to seek video/audio)
   */
  onSeekToTimestamp?: (seconds: number) => void;

  /**
   * Current user ID (for ownership checks)
   */
  currentUserId: string;

  /**
   * Whether timestamps are supported (video/audio content)
   */
  supportsTimestamps?: boolean;
}

/**
 * TimeStampedComments - Display and manage comments on recordings
 *
 * Features:
 * - List comments with user info and timestamps
 * - Add new comments (with optional timestamp)
 * - Edit/delete own comments
 * - Click timestamp to seek video/audio
 * - Real-time relative timestamps ("2 hours ago")
 *
 * @example
 * <TimeStampedComments
 *   recordingId={recording.id}
 *   currentTime={playerCurrentTime}
 *   onSeekToTimestamp={handleSeek}
 *   currentUserId={userId}
 *   supportsTimestamps={contentType === 'video' || contentType === 'audio'}
 * />
 */
export default function TimeStampedComments({
  recordingId,
  currentTime,
  onSeekToTimestamp,
  currentUserId,
  supportsTimestamps = false,
}: TimeStampedCommentsProps) {
  const [comments, setComments] = React.useState<CommentWithUser[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [newCommentText, setNewCommentText] = React.useState('');
  const [includeTimestamp, setIncludeTimestamp] = React.useState(true);
  const [editingCommentId, setEditingCommentId] = React.useState<string | null>(null);
  const [editText, setEditText] = React.useState('');

  // Fetch comments on mount
  React.useEffect(() => {
    fetchComments();
  }, [recordingId]);

  const fetchComments = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/comments?content_id=${recordingId}&limit=100`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch comments');
      }

      const data = await response.json();
      setComments(data.comments || []);
    } catch (error) {
      console.error('Fetch comments error:', error);
      toast.error('Failed to load comments');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!newCommentText.trim()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content_id: recordingId,
          text: newCommentText.trim(),
          timestamp_sec:
            supportsTimestamps && includeTimestamp && currentTime !== undefined
              ? currentTime
              : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add comment');
      }

      const data = await response.json();
      setComments((prev) => [data.comment, ...prev]);
      setNewCommentText('');
      toast.success('Comment added');
    } catch (error) {
      console.error('Add comment error:', error);
      toast.error('Failed to add comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditComment = async (commentId: string) => {
    if (!editText.trim()) {
      return;
    }

    try {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: editText.trim() }),
      });

      if (!response.ok) {
        throw new Error('Failed to update comment');
      }

      const data = await response.json();
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, ...data.comment } : c))
      );
      setEditingCommentId(null);
      setEditText('');
      toast.success('Comment updated');
    } catch (error) {
      console.error('Update comment error:', error);
      toast.error('Failed to update comment');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete comment');
      }

      setComments((prev) => prev.filter((c) => c.id !== commentId));
      toast.success('Comment deleted');
    } catch (error) {
      console.error('Delete comment error:', error);
      toast.error('Failed to delete comment');
    }
  };

  const formatTimestamp = (seconds: number | null) => {
    if (seconds === null) return null;

    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 flex items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare className="size-4" />
          Comments ({comments.length})
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Add Comment Form */}
        <div className="space-y-2">
          <Textarea
            placeholder="Add a comment..."
            value={newCommentText}
            onChange={(e) => setNewCommentText(e.target.value)}
            disabled={isSubmitting}
            rows={3}
            maxLength={5000}
            className="resize-none"
          />

          <div className="flex items-center justify-between">
            {supportsTimestamps && currentTime !== undefined && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={includeTimestamp}
                  onChange={(e) => setIncludeTimestamp(e.target.checked)}
                  disabled={isSubmitting}
                  className="rounded border-border"
                />
                <span className="text-muted-foreground">
                  Add timestamp ({formatTimestamp(currentTime)})
                </span>
              </label>
            )}

            <Button
              onClick={handleAddComment}
              disabled={isSubmitting || !newCommentText.trim()}
              size="sm"
              className="ml-auto"
            >
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin mr-2" />
              ) : (
                <Send className="size-4 mr-2" />
              )}
              Comment
            </Button>
          </div>
        </div>

        <Separator />

        {/* Comments List */}
        {comments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="size-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No comments yet</p>
            <p className="text-xs mt-1">Be the first to comment!</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {comments.map((comment) => {
                const isOwner = comment.user_id === currentUserId;
                const isEditing = editingCommentId === comment.id;

                return (
                  <div key={comment.id} className="space-y-2">
                    <div className="flex items-start gap-3">
                      {/* User Avatar */}
                      <Avatar className="size-8 flex-shrink-0">
                        <AvatarFallback className="text-xs">
                          {getInitials(comment.user_name)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0 space-y-1">
                        {/* User Info & Timestamp */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">
                            {comment.user_name}
                          </span>

                          {comment.timestamp_sec !== null && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                onSeekToTimestamp?.(comment.timestamp_sec!)
                              }
                              className="h-5 px-1.5 text-xs text-primary hover:text-primary"
                            >
                              <Clock className="size-3 mr-1" />
                              {formatTimestamp(comment.timestamp_sec)}
                            </Button>
                          )}

                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(comment.created_at), {
                              addSuffix: true,
                            })}
                          </span>

                          {comment.edited && (
                            <Badge variant="outline" className="text-xs h-5">
                              edited
                            </Badge>
                          )}
                        </div>

                        {/* Comment Text */}
                        {isEditing ? (
                          <div className="space-y-2">
                            <Textarea
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              rows={2}
                              maxLength={5000}
                              className="text-sm"
                            />
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEditComment(comment.id)}
                                disabled={!editText.trim()}
                                className="h-7 px-2"
                              >
                                <Check className="size-3 mr-1" />
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditingCommentId(null);
                                  setEditText('');
                                }}
                                className="h-7 px-2"
                              >
                                <X className="size-3 mr-1" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                            {comment.text}
                          </p>
                        )}

                        {/* Owner Actions */}
                        {isOwner && !isEditing && (
                          <div className="flex items-center gap-1 pt-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingCommentId(comment.id);
                                setEditText(comment.text);
                              }}
                              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                            >
                              <Edit2 className="size-3 mr-1" />
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteComment(comment.id)}
                              className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="size-3 mr-1" />
                              Delete
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
