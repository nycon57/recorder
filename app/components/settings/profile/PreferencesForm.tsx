'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Loader2, Bell, Monitor, Globe } from 'lucide-react';

import { useToast } from '@/app/components/ui/use-toast';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Label } from '@/app/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Switch } from '@/app/components/ui/switch';
import { Separator } from '@/app/components/ui/separator';

interface NotificationPreferences {
  email: {
    recordings_completed: boolean;
    share_received: boolean;
    mention: boolean;
    weekly_digest: boolean;
    security_alerts: boolean;
    billing_updates: boolean;
  };
  in_app: {
    recordings_completed: boolean;
    share_received: boolean;
    mention: boolean;
    system_updates: boolean;
  };
  push: {
    enabled: boolean;
    recordings_completed: boolean;
    mention: boolean;
  };
}

interface UIPreferences {
  theme: 'light' | 'dark' | 'system';
  sidebar_collapsed: boolean;
  recordings_view: 'grid' | 'list' | 'table';
  default_recording_visibility: 'private' | 'department' | 'org' | 'public';
  language: string;
  items_per_page: number;
  compact_mode: boolean;
}

export function PreferencesForm() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>({
    email: {
      recordings_completed: true,
      share_received: true,
      mention: true,
      weekly_digest: false,
      security_alerts: true,
      billing_updates: true,
    },
    in_app: {
      recordings_completed: true,
      share_received: true,
      mention: true,
      system_updates: true,
    },
    push: {
      enabled: false,
      recordings_completed: true,
      mention: true,
    },
  });

  const [uiPrefs, setUiPrefs] = useState<UIPreferences>({
    theme: 'system',
    sidebar_collapsed: false,
    recordings_view: 'grid',
    default_recording_visibility: 'org',
    language: 'en',
    items_per_page: 50,
    compact_mode: false,
  });

  // Listen for system theme changes when theme is set to 'system'
  useEffect(() => {
    if (uiPrefs.theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    mediaQuery.addEventListener('change', handleChange);

    // Apply initial system preference
    if (mediaQuery.matches) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [uiPrefs.theme]);

  // Fetch current preferences
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch('/api/profile');
        if (!response.ok) return;

        const data = await response.json();
        const profile = data.data;

        if (profile.notification_preferences) {
          setNotificationPrefs(prev => ({
            ...prev,
            ...profile.notification_preferences,
          }));
        }

        if (profile.ui_preferences) {
          setUiPrefs(prev => ({
            ...prev,
            ...profile.ui_preferences,
          }));
        }
      } catch (error) {
        console.error('Error fetching preferences:', error);
      } finally {
        setIsFetching(false);
      }
    };

    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const savePreferences = async () => {
    setIsLoading(true);
    try {
      // Save preferences to localStorage for now
      // In production, these would be saved to the database via API
      localStorage.setItem('notification_preferences', JSON.stringify(notificationPrefs));
      localStorage.setItem('ui_preferences', JSON.stringify(uiPrefs));

      // Apply theme change immediately
      if (uiPrefs.theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else if (uiPrefs.theme === 'light') {
        document.documentElement.classList.remove('dark');
      } else if (uiPrefs.theme === 'system') {
        // Use system preference
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (isDark) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }

      toast({
        title: 'Success',
        description: 'Your preferences have been saved',
      });
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast({
        title: 'Error',
        description: 'Failed to save preferences',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Preferences
          </CardTitle>
          <CardDescription>
            Choose how you want to be notified about activity
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Email Notifications */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold">Email Notifications</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="email-recordings" className="flex-1">
                  Recording completed
                  <p className="text-xs text-muted-foreground">Get notified when your recordings finish processing</p>
                </Label>
                <Switch
                  id="email-recordings"
                  checked={notificationPrefs.email.recordings_completed}
                  onCheckedChange={(checked) =>
                    setNotificationPrefs({
                      ...notificationPrefs,
                      email: { ...notificationPrefs.email, recordings_completed: checked },
                    })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="email-shares" className="flex-1">
                  Content shared with you
                  <p className="text-xs text-muted-foreground">Know when someone shares recordings or documents</p>
                </Label>
                <Switch
                  id="email-shares"
                  checked={notificationPrefs.email.share_received}
                  onCheckedChange={(checked) =>
                    setNotificationPrefs({
                      ...notificationPrefs,
                      email: { ...notificationPrefs.email, share_received: checked },
                    })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="email-digest" className="flex-1">
                  Weekly digest
                  <p className="text-xs text-muted-foreground">Summary of your weekly activity and insights</p>
                </Label>
                <Switch
                  id="email-digest"
                  checked={notificationPrefs.email.weekly_digest}
                  onCheckedChange={(checked) =>
                    setNotificationPrefs({
                      ...notificationPrefs,
                      email: { ...notificationPrefs.email, weekly_digest: checked },
                    })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="email-security" className="flex-1">
                  Security alerts
                  <p className="text-xs text-muted-foreground">Important security and account notifications</p>
                </Label>
                <Switch
                  id="email-security"
                  checked={notificationPrefs.email.security_alerts}
                  onCheckedChange={(checked) =>
                    setNotificationPrefs({
                      ...notificationPrefs,
                      email: { ...notificationPrefs.email, security_alerts: checked },
                    })
                  }
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* In-App Notifications */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold">In-App Notifications</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="app-recordings" className="flex-1">
                  Recording completed
                  <p className="text-xs text-muted-foreground">Show in-app alerts for completed recordings</p>
                </Label>
                <Switch
                  id="app-recordings"
                  checked={notificationPrefs.in_app.recordings_completed}
                  onCheckedChange={(checked) =>
                    setNotificationPrefs({
                      ...notificationPrefs,
                      in_app: { ...notificationPrefs.in_app, recordings_completed: checked },
                    })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="app-system" className="flex-1">
                  System updates
                  <p className="text-xs text-muted-foreground">Important system and feature announcements</p>
                </Label>
                <Switch
                  id="app-system"
                  checked={notificationPrefs.in_app.system_updates}
                  onCheckedChange={(checked) =>
                    setNotificationPrefs({
                      ...notificationPrefs,
                      in_app: { ...notificationPrefs.in_app, system_updates: checked },
                    })
                  }
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* UI Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Interface Preferences
          </CardTitle>
          <CardDescription>
            Customize how the application looks and behaves
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="theme">Theme</Label>
              <Select
                value={uiPrefs.theme}
                onValueChange={(value: 'light' | 'dark' | 'system') =>
                  setUiPrefs({ ...uiPrefs, theme: value })
                }
              >
                <SelectTrigger id="theme">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="recordings-view">Default Recordings View</Label>
              <Select
                value={uiPrefs.recordings_view}
                onValueChange={(value: 'grid' | 'list' | 'table') =>
                  setUiPrefs({ ...uiPrefs, recordings_view: value })
                }
              >
                <SelectTrigger id="recordings-view">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="grid">Grid</SelectItem>
                  <SelectItem value="list">List</SelectItem>
                  <SelectItem value="table">Table</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="visibility">Default Recording Visibility</Label>
              <Select
                value={uiPrefs.default_recording_visibility}
                onValueChange={(value: 'private' | 'department' | 'org' | 'public') =>
                  setUiPrefs({ ...uiPrefs, default_recording_visibility: value })
                }
              >
                <SelectTrigger id="visibility">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">Private</SelectItem>
                  <SelectItem value="department">Department</SelectItem>
                  <SelectItem value="org">Organization</SelectItem>
                  <SelectItem value="public">Public</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="items-per-page">Items Per Page</Label>
              <Select
                value={String(uiPrefs.items_per_page)}
                onValueChange={(value) =>
                  setUiPrefs({ ...uiPrefs, items_per_page: parseInt(value) })
                }
              >
                <SelectTrigger id="items-per-page">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="compact-mode" className="flex-1">
                Compact Mode
                <p className="text-xs text-muted-foreground">Reduce spacing and use smaller UI elements</p>
              </Label>
              <Switch
                id="compact-mode"
                checked={uiPrefs.compact_mode}
                onCheckedChange={(checked) =>
                  setUiPrefs({ ...uiPrefs, compact_mode: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="sidebar-collapsed" className="flex-1">
                Start with Sidebar Collapsed
                <p className="text-xs text-muted-foreground">Sidebar will be collapsed by default</p>
              </Label>
              <Switch
                id="sidebar-collapsed"
                checked={uiPrefs.sidebar_collapsed}
                onCheckedChange={(checked) =>
                  setUiPrefs({ ...uiPrefs, sidebar_collapsed: checked })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={savePreferences} disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Preferences
        </Button>
      </div>
    </div>
  );
}