'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { ApiKeysTab } from './components/ApiKeysTab';
import { WebhooksTab } from './components/WebhooksTab';

export default function IntegrationsPage() {
  const [activeTab, setActiveTab] = useState('api-keys');

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Integrations</h1>
        <p className="text-muted-foreground">
          Manage API keys and webhooks to integrate with external services
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
        </TabsList>

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