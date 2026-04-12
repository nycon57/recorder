'use client';

/**
 * Vendor Admin — Branding Configuration (TRIB-53)
 *
 * Client Component form for managing white-label branding:
 * logo URL, primary/secondary colors, product name, support email.
 *
 * - If no config exists: shows "Set up white-label" CTA (POST).
 * - If config exists: shows pre-filled form (PUT).
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Paintbrush, ExternalLink, Loader2 } from 'lucide-react';

import { Button } from '@/app/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';

export default function BrandingPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configExists, setConfigExists] = useState(false);

  // Form fields
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#000000');
  const [secondaryColor, setSecondaryColor] = useState('#000000');
  const [productName, setProductName] = useState('');
  const [supportEmail, setSupportEmail] = useState('');

  // Fetch existing config on mount
  useEffect(() => {
    async function fetchConfig() {
      try {
        const res = await fetch('/api/vendor/config');
        if (res.ok) {
          const json = await res.json();
          const config = json.data;
          setConfigExists(true);
          setLogoUrl(config.branding?.logo_url ?? '');
          setPrimaryColor(config.branding?.primary_color ?? '#000000');
          setSecondaryColor(
            config.branding?.secondary_color ?? '#000000'
          );
          setProductName(config.branding?.product_name ?? '');
          setSupportEmail(config.branding?.support_email ?? '');
        } else if (res.status === 404) {
          setConfigExists(false);
        }
      } catch {
        toast.error('Failed to load configuration');
      } finally {
        setLoading(false);
      }
    }
    fetchConfig();
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const branding: Record<string, string> = {};
      if (logoUrl.trim()) branding.logo_url = logoUrl.trim();
      if (primaryColor && primaryColor !== '#000000')
        branding.primary_color = primaryColor;
      if (secondaryColor && secondaryColor !== '#000000')
        branding.secondary_color = secondaryColor;
      if (productName.trim()) branding.product_name = productName.trim();
      if (supportEmail.trim())
        branding.support_email = supportEmail.trim();

      const method = configExists ? 'PUT' : 'POST';
      const res = await fetch('/api/vendor/config', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branding }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          err.error?.message ?? err.message ?? 'Failed to save'
        );
      }

      toast.success(
        configExists
          ? 'Branding updated successfully'
          : 'White-label configuration created'
      );

      if (!configExists) {
        setConfigExists(true);
      }

      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to save branding'
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div
        className="flex items-center justify-center py-16"
        role="status"
      >
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            Loading branding configuration...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 py-8">
      <header>
        <h1 className="text-3xl font-normal tracking-tight flex items-center gap-2">
          <Paintbrush className="h-7 w-7" />
          Branding
        </h1>
        <p className="mt-1 text-muted-foreground">
          Customize the look and feel of your white-label experience.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {configExists ? 'Edit Branding' : 'Set Up White-Label'}
          </CardTitle>
          <CardDescription>
            {configExists
              ? 'Update your branding configuration. Changes apply immediately.'
              : 'Create your white-label configuration to get started.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Logo URL */}
          <div className="space-y-2">
            <Label htmlFor="logo-url">Logo URL</Label>
            <Input
              id="logo-url"
              type="url"
              placeholder="https://example.com/logo.png"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
            />
            {logoUrl.trim() && (
              <div className="mt-2 flex items-center gap-3">
                <div className="h-12 w-12 rounded-md border bg-muted flex items-center justify-center overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={logoUrl}
                    alt="Logo preview"
                    className="h-full w-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display =
                        'none';
                    }}
                  />
                </div>
                <a
                  href={logoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  Preview
                </a>
              </div>
            )}
          </div>

          {/* Colors */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="primary-color">Primary Color</Label>
              <div className="flex items-center gap-2">
                <div
                  className="h-8 w-8 rounded-md border shrink-0"
                  style={{ backgroundColor: primaryColor }}
                />
                <Input
                  id="primary-color"
                  type="text"
                  placeholder="#ff5500"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  pattern="^#[0-9a-fA-F]{6}$"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Hex color, e.g. #ff5500
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="secondary-color">Secondary Color</Label>
              <div className="flex items-center gap-2">
                <div
                  className="h-8 w-8 rounded-md border shrink-0"
                  style={{ backgroundColor: secondaryColor }}
                />
                <Input
                  id="secondary-color"
                  type="text"
                  placeholder="#333333"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  pattern="^#[0-9a-fA-F]{6}$"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Hex color, e.g. #333333
              </p>
            </div>
          </div>

          {/* Product name & support email */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="product-name">Product Name</Label>
              <Input
                id="product-name"
                type="text"
                placeholder="My Product"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="support-email">Support Email</Label>
              <Input
                id="support-email"
                type="email"
                placeholder="support@example.com"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
              />
            </div>
          </div>

          {/* Save */}
          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={saving}
            >
              {saving && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {configExists ? 'Save changes' : 'Create configuration'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
