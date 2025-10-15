'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import { Checkbox } from '@/app/components/ui/checkbox';
import { useToast } from '@/app/components/ui/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import {
  Key,
  Copy,
  AlertTriangle,
  Loader2,
  Calendar,
  Shield,
  Zap
} from 'lucide-react';
import { format, addDays, addMonths } from 'date-fns';

interface GenerateApiKeyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onKeyGenerated?: (keyData: { id: string; full_key: string }) => void;
}

const AVAILABLE_SCOPES = [
  { value: 'read:recordings', label: 'Read Recordings' },
  { value: 'write:recordings', label: 'Write Recordings' },
  { value: 'delete:recordings', label: 'Delete Recordings' },
  { value: 'read:users', label: 'Read Users' },
  { value: 'write:users', label: 'Write Users' },
  { value: 'read:analytics', label: 'Read Analytics' },
  { value: 'read:organization', label: 'Read Organization' },
  { value: 'write:organization', label: 'Write Organization' },
];

const EXPIRY_OPTIONS = [
  { value: 'never', label: 'Never' },
  { value: '7days', label: '7 days' },
  { value: '30days', label: '30 days' },
  { value: '90days', label: '90 days' },
  { value: '1year', label: '1 year' },
];

export function GenerateApiKeyModal({
  open,
  onOpenChange,
  onKeyGenerated,
}: GenerateApiKeyModalProps) {
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>([]);
  const [rateLimit, setRateLimit] = useState('1000');
  const [ipWhitelist, setIpWhitelist] = useState('');
  const [expiry, setExpiry] = useState('never');
  const [generatedKey, setGeneratedKey] = useState<{ id: string; key: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const { toast } = useToast();

  const generateMutation = useMutation({
    mutationFn: async () => {
      let expiresAt = null;
      if (expiry !== 'never') {
        const now = new Date();
        switch (expiry) {
          case '7days':
            expiresAt = addDays(now, 7).toISOString();
            break;
          case '30days':
            expiresAt = addDays(now, 30).toISOString();
            break;
          case '90days':
            expiresAt = addDays(now, 90).toISOString();
            break;
          case '1year':
            expiresAt = addMonths(now, 12).toISOString();
            break;
        }
      }

      const response = await fetch('/api/organizations/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          scopes,
          rate_limit: parseInt(rateLimit),
          ip_whitelist: ipWhitelist
            .split('\n')
            .map(ip => ip.trim())
            .filter(Boolean),
          expires_at: expiresAt,
        }),
      });

      if (!response.ok) throw new Error('Failed to generate API key');
      return response.json();
    },
    onSuccess: (data) => {
      setGeneratedKey({ id: data.data.id, key: data.data.key });
      setStep('success');
      if (onKeyGenerated) {
        onKeyGenerated({ id: data.data.id, full_key: data.data.key });
      }
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to generate API key. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleScopeChange = (scope: string, checked: boolean) => {
    if (checked) {
      setScopes([...scopes, scope]);
    } else {
      setScopes(scopes.filter(s => s !== scope));
    }
  };

  const handleCopyKey = async () => {
    if (generatedKey) {
      try {
        await navigator.clipboard.writeText(generatedKey.key);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast({
          title: 'Copied',
          description: 'API key copied to clipboard',
        });
      } catch (err) {
        toast({
          title: 'Error',
          description: 'Failed to copy to clipboard',
          variant: 'destructive',
        });
      }
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset form after animation
    setTimeout(() => {
      setStep('form');
      setName('');
      setScopes([]);
      setRateLimit('1000');
      setIpWhitelist('');
      setExpiry('never');
      setGeneratedKey(null);
      setCopied(false);
    }, 200);
  };

  const canGenerate = name && scopes.length > 0 && rateLimit;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        {step === 'form' ? (
          <>
            <DialogHeader>
              <DialogTitle>Generate API Key</DialogTitle>
              <DialogDescription>
                Create a new API key for programmatic access to your organization's data
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Production App Key"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Scopes *</Label>
                <div className="grid grid-cols-2 gap-3">
                  {AVAILABLE_SCOPES.map(scope => (
                    <div key={scope.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={scope.value}
                        checked={scopes.includes(scope.value)}
                        onCheckedChange={(checked) =>
                          handleScopeChange(scope.value, checked as boolean)
                        }
                      />
                      <Label
                        htmlFor={scope.value}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {scope.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rateLimit">
                    <Zap className="h-3 w-3 inline mr-1" />
                    Rate Limit (requests/hour) *
                  </Label>
                  <Input
                    id="rateLimit"
                    type="number"
                    min="1"
                    max="10000"
                    value={rateLimit}
                    onChange={(e) => setRateLimit(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expiry">
                    <Calendar className="h-3 w-3 inline mr-1" />
                    Expiration
                  </Label>
                  <Select value={expiry} onValueChange={setExpiry}>
                    <SelectTrigger id="expiry">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPIRY_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ipWhitelist">
                  <Shield className="h-3 w-3 inline mr-1" />
                  IP Whitelist (optional)
                </Label>
                <Textarea
                  id="ipWhitelist"
                  placeholder="Enter one IP address per line (e.g., 192.168.1.1)"
                  rows={3}
                  value={ipWhitelist}
                  onChange={(e) => setIpWhitelist(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty to allow access from any IP address
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={() => generateMutation.mutate()}
                disabled={!canGenerate || generateMutation.isPending}
              >
                {generateMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Generate Key
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Key className="h-5 w-5 text-green-600" />
                <DialogTitle>API Key Generated Successfully</DialogTitle>
              </div>
            </DialogHeader>

            <div className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Make sure to copy your API key now. You won't be able to see it again!
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label>Your API Key</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-3 bg-muted rounded-md text-sm break-all">
                    {generatedKey?.key}
                  </code>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={handleCopyKey}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                {copied && (
                  <p className="text-sm text-green-600">Copied to clipboard!</p>
                )}
              </div>

              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <h4 className="font-medium">Key Details</h4>
                <div className="text-sm space-y-1">
                  <div><span className="text-muted-foreground">Name:</span> {name}</div>
                  <div>
                    <span className="text-muted-foreground">Scopes:</span>{' '}
                    {scopes.join(', ')}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Rate Limit:</span>{' '}
                    {rateLimit} requests/hour
                  </div>
                  <div>
                    <span className="text-muted-foreground">Expires:</span>{' '}
                    {expiry === 'never' ? 'Never' : EXPIRY_OPTIONS.find(o => o.value === expiry)?.label}
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Label({ children, htmlFor, className }: {
  children: React.ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={className || "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"}>
      {children}
    </label>
  );
}