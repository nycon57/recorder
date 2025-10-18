'use client';

import { useState } from 'react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import {
  ApiKeysTab,
  WebhooksTab,
  ExternalSourcesTab,
} from '@/app/components/settings';

export default function IntegrationsPage() {
  const [activeTab, setActiveTab] = useState('external-sources');

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Integrations</h1>
        <p className="text-muted-foreground">
          Connect external services, manage API keys, and configure webhooks
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-2xl">
          <TabsTrigger value="external-sources">External Sources</TabsTrigger>
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
        </TabsList>

        <TabsContent value="external-sources" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>External Data Sources</CardTitle>
              <CardDescription>
                Connect and sync content from external platforms
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ExternalSourcesTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api-keys" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>
                Create and manage API keys for programmatic access to your data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ApiKeysTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="webhooks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Webhooks</CardTitle>
              <CardDescription>
                Configure webhooks to receive real-time notifications about events
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WebhooksTab />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}