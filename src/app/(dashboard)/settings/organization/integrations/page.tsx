'use client';

import { useState } from 'react';

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/app/components/ui/tabs';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/app/components/ui/card';
import {
  ApiKeysTab,
  WebhooksTab,
  ExternalSourcesTab,
} from '@/app/components/settings';
import { DocLink } from '@/app/components/docs/doc-link';

export default function IntegrationsPage() {
  const [activeTab, setActiveTab] = useState('external-sources');

  return (
    <div className="trbd-page">
      <div className="mb-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="trbd-page-title mb-2">Integrations</h1>
          <DocLink href="/docs/integrations/browser-extension">
            Integration guides
          </DocLink>
        </div>
        <p className="text-muted-foreground">
          Connect external services, manage API keys, and configure webhooks
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-3 max-w-2xl">
          <TabsTrigger value="external-sources">External Sources</TabsTrigger>
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
        </TabsList>

        <TabsContent value="external-sources" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle>External Data Sources</CardTitle>
                  <CardDescription className="mt-1.5">
                    Connect and sync content from external platforms
                  </CardDescription>
                </div>
                <DocLink href="/docs/integrations/browser-extension">
                  Browser extension guide
                </DocLink>
              </div>
            </CardHeader>
            <CardContent>
              <ExternalSourcesTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api-keys" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle>API Keys</CardTitle>
                  <CardDescription className="mt-1.5">
                    Create and manage API keys for programmatic access to your data
                  </CardDescription>
                </div>
                <DocLink href="/docs/integrations/sdk-widget">
                  SDK widget docs
                </DocLink>
              </div>
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
                Configure webhooks to receive real-time notifications about
                events
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
