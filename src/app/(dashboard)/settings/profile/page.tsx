'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { User, ImageIcon, Settings2, Smartphone, Shield, AlertTriangle } from 'lucide-react';

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/app/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import {
  ProfileForm,
  AvatarUpload,
  PreferencesForm,
  SessionsList,
  SecuritySettings,
  DangerZone,
} from '@/app/components/settings';
import { cn } from '@/lib/utils';

export default function ProfilePage() {
  const { userId } = useAuth();
  const [activeTab, setActiveTab] = useState('general');

  if (!userId) {
    return null;
  }

  const tabs = [
    { value: 'general', label: 'General', icon: User, description: 'Personal details' },
    { value: 'avatar', label: 'Avatar', icon: ImageIcon, description: 'Profile picture' },
    { value: 'preferences', label: 'Preferences', icon: Settings2, description: 'App settings' },
    { value: 'sessions', label: 'Sessions', icon: Smartphone, description: 'Active devices' },
    { value: 'security', label: 'Security', icon: Shield, description: 'Authentication' },
    { value: 'danger', label: 'Danger', icon: AlertTriangle, description: 'Delete account' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-normal">Profile Settings</h1>
        <p className="text-muted-foreground">
          Manage your personal information and preferences
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="flex flex-wrap justify-start gap-1 h-auto p-1 bg-muted/50">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 text-sm data-[state=active]:bg-background",
                  tab.value === 'danger' && "data-[state=active]:text-destructive"
                )}
              >
                <Icon className="size-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>General Information</CardTitle>
              <CardDescription>
                Update your personal details and contact information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ProfileForm />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="avatar" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Profile Avatar</CardTitle>
              <CardDescription>
                Upload and manage your profile picture
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AvatarUpload />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences" className="space-y-4">
          <PreferencesForm />
        </TabsContent>

        <TabsContent value="sessions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Sessions</CardTitle>
              <CardDescription>
                Manage your active sessions and devices
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SessionsList />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>
                Manage your account security and authentication
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SecuritySettings />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="danger" className="space-y-4">
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>
                Irreversible and destructive actions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DangerZone />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}