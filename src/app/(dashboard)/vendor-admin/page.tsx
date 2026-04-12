/**
 * Vendor Admin Dashboard — Overview (TRIB-53)
 *
 * Server Component that shows white-label config status, customer count
 * (placeholder until TRIB-54 ships vendor-customer linking), and quick
 * navigation to sub-pages (branding, voice, knowledge).
 *
 * Auth: requireAdmin() — org owner/admin only.
 */

import { redirect } from 'next/navigation';
import Link from 'next/link';

import {
  CheckCircle2,
  XCircle,
  Paintbrush,
  Mic,
  BookOpen,
  Users,
  Activity,
  Clock,
  Globe,
} from 'lucide-react';

import { Badge } from '@/app/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { requireAdmin } from '@/lib/utils/api';
import { getWhiteLabelConfig } from '@/lib/services/white-label';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Vendor Admin | Tribora',
  description: 'Manage your white-label configuration',
};

export default async function VendorAdminPage() {
  let orgId: string;
  try {
    const ctx = await requireAdmin();
    orgId = ctx.orgId;
  } catch {
    redirect('/dashboard');
  }

  const config = await getWhiteLabelConfig(orgId);

  const hasConfig = config !== null;
  const lastUpdated = config?.updated_at
    ? new Date(config.updated_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const hasBranding =
    hasConfig &&
    (config.branding.logo_url ||
      config.branding.primary_color ||
      config.branding.product_name);

  const hasVoice =
    hasConfig && config.voice_config.elevenlabs_voice_id;

  const knowledgeScopeCount = config?.knowledge_scope?.length ?? 0;

  return (
    <div className="container mx-auto space-y-6 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-normal tracking-tight">
            Vendor Admin
          </h1>
          <p className="mt-1 text-muted-foreground">
            Manage your white-label configuration, branding, and voice
            settings.
          </p>
        </div>
        {hasConfig ? (
          <Badge
            variant={config.is_active ? 'default' : 'secondary'}
            className="text-sm"
          >
            {config.is_active ? 'Active' : 'Inactive'}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-sm">
            Not configured
          </Badge>
        )}
      </header>

      {/* Status overview */}
      {hasConfig && lastUpdated && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>Last updated: {lastUpdated}</span>
        </div>
      )}

      {!hasConfig && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-muted-foreground" />
              No white-label configuration
            </CardTitle>
            <CardDescription>
              Set up your white-label configuration to customize the
              experience for your customers. Start by configuring your
              branding.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/vendor-admin/branding">
                Set up white-label
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Quick stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Status
            </CardTitle>
            {hasConfig && config.is_active ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <XCircle className="h-4 w-4 text-muted-foreground" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {hasConfig
                ? config.is_active
                  ? 'Active'
                  : 'Inactive'
                : 'None'}
            </div>
            <p className="text-xs text-muted-foreground">
              White-label config
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Customers
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              Connected organizations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Queries Served
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">--</div>
            <p className="text-xs text-muted-foreground">
              Total queries (coming soon)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Knowledge Scope
            </CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {knowledgeScopeCount}
            </div>
            <p className="text-xs text-muted-foreground">
              Apps in scope
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sub-page navigation cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/vendor-admin/branding" className="group">
          <Card className="transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Paintbrush className="h-5 w-5" />
                Branding
              </CardTitle>
              <CardDescription>
                Customize logo, colors, product name, and support email.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {hasBranding ? (
                <Badge variant="default">Configured</Badge>
              ) : (
                <Badge variant="outline">Not set</Badge>
              )}
            </CardContent>
          </Card>
        </Link>

        <Link href="/vendor-admin/voice" className="group">
          <Card className="transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Mic className="h-5 w-5" />
                Voice Settings
              </CardTitle>
              <CardDescription>
                Configure ElevenLabs voice ID, stability, and similarity.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {hasVoice ? (
                <Badge variant="default">Configured</Badge>
              ) : (
                <Badge variant="outline">Not set</Badge>
              )}
            </CardContent>
          </Card>
        </Link>

        <Link href="/vendor-admin/knowledge" className="group">
          <Card className="transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="h-5 w-5" />
                Knowledge Scope
              </CardTitle>
              <CardDescription>
                Select which apps are included in the knowledge base.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="outline">
                {knowledgeScopeCount} app
                {knowledgeScopeCount !== 1 ? 's' : ''} selected
              </Badge>
            </CardContent>
          </Card>
        </Link>

        <Link href="/vendor-admin/domain" className="group">
          <Card className="transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Globe className="h-5 w-5" />
                Custom Domain
              </CardTitle>
              <CardDescription>
                Serve the SDK from your own domain for white-label embedding.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {hasConfig && config.domain_verified ? (
                <Badge variant="default">Verified</Badge>
              ) : hasConfig && config.custom_domain ? (
                <Badge variant="secondary">Pending</Badge>
              ) : (
                <Badge variant="outline">Not set</Badge>
              )}
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
