'use client';

import { Shield, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useSession } from '@/lib/auth/auth-client';

import { Badge } from '@/app/components/ui/badge';
import { Separator } from '@/app/components/ui/separator';
import { Label } from '@/app/components/ui/label';

export function SecuritySettings() {
  const { data: session, isPending } = useSession();

  const user = session?.user;

  // Loading/error guards
  if (isPending || !user) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const securityChecks = [
    {
      label: 'Email Verified',
      status: !!user.emailVerified,
      description: user.emailVerified
        ? 'Your email address has been verified'
        : 'Please verify your email address',
    },
    {
      label: 'Recent Activity Review',
      status: true,
      description: 'Check the Sessions tab to review recent activity',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Security Status Overview */}
      <div className="rounded-lg border bg-muted/50 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="h-6 w-6 text-primary" />
          <h3 className="text-lg font-semibold">Security Status</h3>
        </div>
        <div className="space-y-3">
          {securityChecks.map((check, index) => (
            <div key={index} className="flex items-start gap-3">
              {check.status ? (
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              ) : (
                <XCircle className="h-5 w-5 text-amber-600 mt-0.5" />
              )}
              <div className="flex-1">
                <p className="font-medium text-sm">{check.label}</p>
                <p className="text-xs text-muted-foreground">
                  {check.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Sign-in Methods */}
      <div className="space-y-4">
        <div>
          <Label className="text-base font-semibold">Sign-in Methods</Label>
          <p className="text-sm text-muted-foreground mt-1">
            Methods you can use to sign in to your account
          </p>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div className="flex items-center gap-3">
              <div>
                <p className="text-sm font-medium">{user.email}</p>
                <p className="text-xs text-muted-foreground">Email</p>
              </div>
              {user.emailVerified && (
                <Badge variant="secondary" className="text-xs">
                  Verified
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Security Recommendations */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <h4 className="font-medium text-blue-900 mb-2">
          Security Recommendations
        </h4>
        <ul className="space-y-1 text-sm text-blue-800">
          <li>• Use a unique, strong password for your account</li>
          <li>• Enable two-factor authentication for extra security</li>
          <li>• Review your active sessions regularly</li>
          <li>• Be cautious of phishing attempts</li>
          <li>• Keep your recovery email up to date</li>
        </ul>
      </div>
    </div>
  );
}