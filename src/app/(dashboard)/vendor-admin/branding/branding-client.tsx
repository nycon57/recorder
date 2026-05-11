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

import { useQuery } from '@tanstack/react-query';
import { Paintbrush, ExternalLink, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useReducer } from 'react';
import { toast } from 'sonner';

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

type VendorConfigResult = {
  exists: boolean;
  config: any | null;
};

type BrandingState = {
  saving: boolean;
  configExists: boolean;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  productName: string;
  supportEmail: string;
};

type BrandingAction = { type: 'patch'; patch: Partial<BrandingState> };

const emptyBrandingState: BrandingState = {
  saving: false,
  configExists: false,
  logoUrl: '',
  primaryColor: '#000000',
  secondaryColor: '#000000',
  productName: '',
  supportEmail: '',
};

function createBrandingState(result: VendorConfigResult): BrandingState {
  const config = result.config;
  return {
    ...emptyBrandingState,
    configExists: result.exists,
    logoUrl: config?.branding?.logo_url ?? '',
    primaryColor: config?.branding?.primary_color ?? '#000000',
    secondaryColor: config?.branding?.secondary_color ?? '#000000',
    productName: config?.branding?.product_name ?? '',
    supportEmail: config?.branding?.support_email ?? '',
  };
}

function brandingReducer(
  state: BrandingState,
  action: BrandingAction,
): BrandingState {
  return { ...state, ...action.patch };
}

async function fetchVendorConfig(
  signal: AbortSignal,
): Promise<VendorConfigResult> {
  const res = await fetch('/api/vendor/config', { signal });

  if (res.status === 404) {
    return { exists: false, config: null };
  }

  if (!res.ok) {
    throw new Error('Failed to load configuration');
  }

  const json = await res.json();
  return { exists: true, config: json.data };
}

export default function BrandingPage() {
  const {
    data: configResult,
    isLoading,
    error,
  } = useQuery<VendorConfigResult, Error>({
    queryKey: ['vendor', 'config'],
    queryFn: ({ signal }) => fetchVendorConfig(signal),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16" role="status">
        <div className="text-center">
          <Loader2 className="mx-auto size-8 animate-spin text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            Loading branding configuration…
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="trbd-page">
        <header>
          <h1 className="trbd-page-title tracking-tight flex items-center gap-2">
            <Paintbrush className="size-7" />
            Branding
          </h1>
        </header>
        <Card>
          <CardHeader>
            <CardTitle>Unable to load branding</CardTitle>
            <CardDescription>{error.message}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <BrandingForm
      configResult={configResult ?? { exists: false, config: null }}
    />
  );
}

function BrandingForm({ configResult }: { configResult: VendorConfigResult }) {
  const { refresh } = useRouter();
  const [state, dispatch] = useReducer(
    brandingReducer,
    configResult,
    createBrandingState,
  );
  const {
    saving,
    configExists,
    logoUrl,
    primaryColor,
    secondaryColor,
    productName,
    supportEmail,
  } = state;

  async function handleSave() {
    dispatch({ type: 'patch', patch: { saving: true } });
    try {
      const branding: Record<string, string> = {};
      if (logoUrl.trim()) branding.logo_url = logoUrl.trim();
      if (primaryColor && primaryColor !== '#000000')
        branding.primary_color = primaryColor;
      if (secondaryColor && secondaryColor !== '#000000')
        branding.secondary_color = secondaryColor;
      if (productName.trim()) branding.product_name = productName.trim();
      if (supportEmail.trim()) branding.support_email = supportEmail.trim();

      const method = configExists ? 'PUT' : 'POST';
      const res = await fetch('/api/vendor/config', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branding }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message ?? err.message ?? 'Failed to save');
      }

      toast.success(
        configExists
          ? 'Branding updated successfully'
          : 'White-label configuration created',
      );

      if (!configExists) {
        dispatch({ type: 'patch', patch: { configExists: true } });
      }

      refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to save branding',
      );
    } finally {
      dispatch({ type: 'patch', patch: { saving: false } });
    }
  }

  return (
    <div className="trbd-page">
      <header>
        <h1 className="trbd-page-title tracking-tight flex items-center gap-2">
          <Paintbrush className="size-7" />
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
              onChange={(e) =>
                dispatch({
                  type: 'patch',
                  patch: { logoUrl: e.target.value },
                })
              }
            />
            {logoUrl.trim() && (
              <div className="mt-2 flex items-center gap-3">
                <div className="relative size-12 rounded-md border bg-muted flex items-center justify-center overflow-hidden">
                  <Image
                    src={logoUrl}
                    alt="Logo preview"
                    fill
                    sizes="48px"
                    className="object-contain"
                    unoptimized
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
                <a
                  href={logoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <ExternalLink className="size-3" />
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
                  className="size-8 rounded-md border shrink-0"
                  style={{ backgroundColor: primaryColor }}
                />
                <Input
                  id="primary-color"
                  type="text"
                  placeholder="#ff5500"
                  value={primaryColor}
                  onChange={(e) =>
                    dispatch({
                      type: 'patch',
                      patch: { primaryColor: e.target.value },
                    })
                  }
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
                  className="size-8 rounded-md border shrink-0"
                  style={{ backgroundColor: secondaryColor }}
                />
                <Input
                  id="secondary-color"
                  type="text"
                  placeholder="#333333"
                  value={secondaryColor}
                  onChange={(e) =>
                    dispatch({
                      type: 'patch',
                      patch: { secondaryColor: e.target.value },
                    })
                  }
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
                onChange={(e) =>
                  dispatch({
                    type: 'patch',
                    patch: { productName: e.target.value },
                  })
                }
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
                onChange={(e) =>
                  dispatch({
                    type: 'patch',
                    patch: { supportEmail: e.target.value },
                  })
                }
              />
            </div>
          </div>

          {/* Save */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              {configExists ? 'Save changes' : 'Create configuration'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
