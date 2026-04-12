'use client';

/**
 * Vendor Admin — Domain Management (TRIB-58)
 *
 * Client Component for managing custom domain configuration:
 * - Input custom domain
 * - Start DNS verification (shows TXT record to add)
 * - Check verification status
 * - Integration instructions with SDK embed snippet
 *
 * Auth: handled by middleware + API route (requireAdmin).
 */

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Globe,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Copy,
  AlertCircle,
  Code,
  Trash2,
} from 'lucide-react';

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
import { Badge } from '@/app/components/ui/badge';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TxtRecord {
  host: string;
  type: string;
  value: string;
}

interface DomainStatus {
  domain: string | null;
  verified: boolean;
  verifiedAt?: string;
  dnsRecordFound?: boolean;
  txtRecord: TxtRecord | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DomainPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);

  const [domain, setDomain] = useState('');
  const [status, setStatus] = useState<DomainStatus | null>(null);

  // ─── Fetch current status ──────────────────────────────────────────

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/vendor/domain');
      if (res.ok) {
        const json = await res.json();
        setStatus(json.data);
        if (json.data.domain) {
          setDomain(json.data.domain);
        }
      }
    } catch {
      toast.error('Failed to load domain status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // ─── Start verification ────────────────────────────────────────────

  async function handleStartVerification() {
    if (!domain.trim()) {
      toast.error('Please enter a domain');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/vendor/domain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: domain.trim() }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message ?? json.error ?? 'Failed to start verification');
      }

      setStatus(json.data);
      toast.success('Verification started. Add the TXT record to your DNS.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start verification');
    } finally {
      setSaving(false);
    }
  }

  // ─── Check DNS ─────────────────────────────────────────────────────

  async function handleCheckDns() {
    setChecking(true);
    try {
      const res = await fetch('/api/vendor/domain');
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message ?? 'Failed to check DNS');
      }

      setStatus(json.data);
      if (json.data.dnsRecordFound) {
        toast.success('DNS record found. You can now confirm verification.');
      } else {
        toast.info('DNS record not found yet. It may take up to 48 hours to propagate.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to check DNS');
    } finally {
      setChecking(false);
    }
  }

  // ─── Confirm verification ─────────────────────────────────────────

  async function handleConfirmVerification() {
    setConfirming(true);
    try {
      const res = await fetch('/api/vendor/domain', { method: 'PUT' });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message ?? 'Verification failed');
      }

      setStatus(json.data);
      toast.success('Domain verified successfully!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setConfirming(false);
    }
  }

  // ─── Remove domain ─────────────────────────────────────────────────

  async function handleRemoveDomain() {
    setRemoving(true);
    try {
      const res = await fetch('/api/vendor/domain', { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.message ?? 'Failed to remove domain');
      }

      setStatus({ domain: null, verified: false, txtRecord: null });
      setDomain('');
      toast.success('Custom domain removed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove domain');
    } finally {
      setRemoving(false);
    }
  }

  // ─── Copy to clipboard helper ──────────────────────────────────────

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text).then(
      () => toast.success(`${label} copied to clipboard`),
      () => toast.error('Failed to copy to clipboard'),
    );
  }

  // ─── Loading state ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16" role="status">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            Loading domain configuration...
          </p>
        </div>
      </div>
    );
  }

  // Derived state
  const hasDomain = status?.domain !== null && status?.domain !== undefined;
  const isVerified = status?.verified === true;
  const isPending = hasDomain && !isVerified;
  const dnsFound = status?.dnsRecordFound === true;

  return (
    <div className="container mx-auto space-y-6 py-8">
      <header>
        <h1 className="flex items-center gap-2 text-3xl font-normal tracking-tight">
          <Globe className="h-7 w-7" />
          Custom Domain
        </h1>
        <p className="mt-1 text-muted-foreground">
          Serve the Tribora SDK from your own domain for a seamless white-label
          experience.
        </p>
      </header>

      {/* Status badge */}
      <div className="flex items-center gap-2">
        {isVerified && (
          <Badge variant="default" className="gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Verified
          </Badge>
        )}
        {isPending && (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            Pending verification
          </Badge>
        )}
        {!hasDomain && (
          <Badge variant="outline" className="gap-1">
            <XCircle className="h-3 w-3" />
            Not configured
          </Badge>
        )}
      </div>

      {/* Domain input card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Domain Configuration</CardTitle>
          <CardDescription>
            {isVerified
              ? 'Your custom domain is verified and active.'
              : 'Enter the domain you want to serve the SDK from (e.g. help.acme.com).'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="custom-domain">Custom Domain</Label>
            <div className="flex gap-2">
              <Input
                id="custom-domain"
                type="text"
                placeholder="help.acme.com"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                disabled={isVerified}
                className="max-w-md"
              />
              {!hasDomain && (
                <Button onClick={handleStartVerification} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Start verification
                </Button>
              )}
            </div>
          </div>

          {/* Actions for existing domain */}
          {hasDomain && (
            <div className="flex gap-2">
              {!isVerified && (
                <>
                  <Button
                    variant="outline"
                    onClick={handleCheckDns}
                    disabled={checking}
                  >
                    {checking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Check DNS
                  </Button>
                  <Button
                    onClick={handleConfirmVerification}
                    disabled={confirming || !dnsFound}
                  >
                    {confirming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirm verification
                  </Button>
                </>
              )}
              <Button
                variant="destructive"
                onClick={handleRemoveDomain}
                disabled={removing}
              >
                {removing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Remove domain
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* DNS verification instructions */}
      {isPending && status?.txtRecord && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              DNS Verification Required
            </CardTitle>
            <CardDescription>
              Add the following TXT record to your domain&apos;s DNS settings.
              DNS changes may take up to 48 hours to propagate.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/50 p-4 font-mono text-sm">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Host:</span>
                  <div className="flex items-center gap-2">
                    <code>{status.txtRecord.host}</code>
                    <button
                      onClick={() =>
                        copyToClipboard(status.txtRecord!.host, 'Host')
                      }
                      className="text-muted-foreground hover:text-foreground"
                      title="Copy host"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Type:</span>
                  <code>{status.txtRecord.type}</code>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Value:</span>
                  <div className="flex items-center gap-2">
                    <code className="max-w-xs truncate">
                      {status.txtRecord.value}
                    </code>
                    <button
                      onClick={() =>
                        copyToClipboard(status.txtRecord!.value, 'TXT value')
                      }
                      className="text-muted-foreground hover:text-foreground"
                      title="Copy value"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {dnsFound ? (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                DNS record detected. Click &quot;Confirm verification&quot; to
                complete setup.
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                Waiting for DNS propagation...
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Integration instructions — shown when verified */}
      {isVerified && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Code className="h-5 w-5" />
              Integration Instructions
            </CardTitle>
            <CardDescription>
              Embed the Tribora SDK on your website using the code snippet below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>SDK Script Tag</Label>
              <div className="relative">
                <pre className="overflow-x-auto rounded-lg border bg-muted/50 p-4 text-sm">
                  <code>{`<script src="https://${status.domain}/api/sdk/bundle"></script>
<script>
  const tribora = new Tribora({
    apiKey: 'YOUR_API_KEY',
    apiUrl: 'https://${status.domain}'
  });
  tribora.init();
</script>`}</code>
                </pre>
                <button
                  onClick={() =>
                    copyToClipboard(
                      `<script src="https://${status.domain}/api/sdk/bundle"></script>\n<script>\n  const tribora = new Tribora({\n    apiKey: 'YOUR_API_KEY',\n    apiUrl: 'https://${status.domain}'\n  });\n  tribora.init();\n</script>`,
                      'Snippet',
                    )
                  }
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                  title="Copy snippet"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Replace <code>YOUR_API_KEY</code> with your vendor API key from
                the{' '}
                <a
                  href="/vendor-admin/api-keys"
                  className="underline hover:text-foreground"
                >
                  API Keys
                </a>{' '}
                page.
              </p>
            </div>

            <div className="space-y-2">
              <Label>CNAME Record (for custom domain proxying)</Label>
              <div className="rounded-lg border bg-muted/50 p-4 font-mono text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">CNAME:</span>
                  <div className="flex items-center gap-2">
                    <code>{status.domain} &rarr; app.tribora.ai</code>
                    <button
                      onClick={() =>
                        copyToClipboard('app.tribora.ai', 'CNAME target')
                      }
                      className="text-muted-foreground hover:text-foreground"
                      title="Copy CNAME target"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Point your custom domain to <code>app.tribora.ai</code> via CNAME
                so SDK requests are routed through Tribora.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
