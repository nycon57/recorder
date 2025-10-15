'use client';

import { useState, useEffect, useRef } from 'react';
import { Upload, User, X, Loader2 } from 'lucide-react';
import { useToast } from '@/app/components/ui/use-toast';
import { Button } from '@/app/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar';
import { Label } from '@/app/components/ui/label';

export function AvatarUpload() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [userName, setUserName] = useState('');

  // Fetch current avatar
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch('/api/profile');
        if (!response.ok) return;

        const data = await response.json();
        const profile = data.data;

        if (profile.avatar_url) {
          setAvatarUrl(profile.avatar_url);
        }
        setUserName(profile.name || '');
      } catch (error) {
        console.error('Error fetching profile:', error);
      }
    };

    fetchProfile();
  }, []);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a JPEG, PNG, WebP, or GIF image',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please upload an image smaller than 5MB',
        variant: 'destructive',
      });
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const uploadAvatar = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/profile/avatar', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload avatar');
      }

      const data = await response.json();
      setAvatarUrl(data.data.avatar_url);
      setPreviewUrl(null);

      toast({
        title: 'Success',
        description: 'Your avatar has been updated',
      });

      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast({
        title: 'Upload failed',
        description: 'Failed to upload avatar. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const removeAvatar = async () => {
    setIsUploading(true);
    try {
      const response = await fetch('/api/profile/avatar', {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to remove avatar');
      }

      setAvatarUrl(null);
      setPreviewUrl(null);

      toast({
        title: 'Success',
        description: 'Your avatar has been removed',
      });
    } catch (error) {
      console.error('Error removing avatar:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove avatar',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-6">
        <Avatar className="h-24 w-24">
          <AvatarImage src={previewUrl || avatarUrl || undefined} />
          <AvatarFallback className="text-2xl">
            {userName ? getInitials(userName) : <User className="h-10 w-10" />}
          </AvatarFallback>
        </Avatar>

        <div className="space-y-2">
          <Label>Profile Picture</Label>
          <p className="text-sm text-muted-foreground">
            Upload a picture to personalize your profile
          </p>
          <p className="text-xs text-muted-foreground">
            Accepted formats: JPEG, PNG, WebP, GIF (Max 5MB)
          </p>
        </div>
      </div>

      {previewUrl && (
        <div className="rounded-lg border bg-muted/50 p-4">
          <p className="mb-3 text-sm font-medium">Preview</p>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={previewUrl} />
            </Avatar>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">
                This is how your avatar will appear across the application
              </p>
            </div>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFileSelect}
        className="hidden"
        disabled={isUploading}
      />

      <div className="flex gap-2">
        {!previewUrl ? (
          <>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload Image
            </Button>
            {avatarUrl && (
              <Button
                variant="outline"
                onClick={removeAvatar}
                disabled={isUploading}
              >
                {isUploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <X className="mr-2 h-4 w-4" />
                )}
                Remove Avatar
              </Button>
            )}
          </>
        ) : (
          <>
            <Button
              onClick={uploadAvatar}
              disabled={isUploading}
            >
              {isUploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Save Avatar
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setPreviewUrl(null);
                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                }
              }}
              disabled={isUploading}
            >
              Cancel
            </Button>
          </>
        )}
      </div>
    </div>
  );
}