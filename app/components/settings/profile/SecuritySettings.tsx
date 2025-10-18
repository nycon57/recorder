'use client';

import { useEffect } from 'react';
import { Shield, Key, Smartphone, ExternalLink, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useUser } from '@clerk/nextjs';

import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Separator } from '@/app/components/ui/separator';
import { Label } from '@/app/components/ui/label';
import { useToast } from '@/app/components/ui/use-toast';

export function SecuritySettings() {
  const { user } = useUser();
  const { toast } = useToast();

  // Auto-refresh user state after 2FA setup
  // Use a ref to avoid re-registering the listener when user changes
  const latestUserRef = React.useRef(user);

  useEffect(() => {
    latestUserRef.current = user;
  }, [user]);

  useEffect(() => {
    const handleFocus = async () => {
      // Reload user when window regains focus
      try {
        await latestUserRef.current?.reload();
      } catch (error) {
        console.error('Failed to reload user:', error);
      }
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []); // Empty dependency array - only register once

  const handlePasswordChange = () => {
    // Redirect to Clerk's password change UI
    window.open('https://accounts.clerk.dev/user/security', '_blank');
  };

  const handle2FASetup = () => {
    // Redirect to Clerk's 2FA setup - call window.open synchronously to avoid popup blocker
    const win = window.open('https://accounts.clerk.dev/user/security#two-factor', '_blank');

    if (!win) {
      toast({
        title: 'Popup Blocked',
        description: 'Please allow popups for this site to set up two-factor authentication.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Two-Factor Authentication',
      description: 'Complete the setup in the new tab. The page will update when you return.',
    });
  };

  // Loading/error guards
  if (!user) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const is2FAEnabled = user.twoFactorEnabled || false;

  const securityChecks = [
    {
      label: 'Strong Password',
      status: user.passwordEnabled || false,
      description: user.passwordEnabled
        ? 'Your password meets security requirements'
        : 'Set up a password for your account',
    },
    {
      label: 'Two-Factor Authentication',
      status: is2FAEnabled,
      description: is2FAEnabled
        ? 'Your account is protected with 2FA'
        : 'Add an extra layer of security',
    },
    {
      label: 'Email Verified',
      status: user.primaryEmailAddress?.verification?.status === 'verified',
      description: 'Your email address has been verified',
    },
    {
      label: 'Recent Activity Review',
      status: user.lastSignInAt ? true : false,
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

      {/* Password Management */}
      <div className="space-y-4">
        <div>
          <Label className="text-base font-semibold flex items-center gap-2">
            <Key className="h-4 w-4" />
            Password
          </Label>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your password through Clerk's security portal
          </p>
        </div>
        <div className="flex items-center justify-between p-4 rounded-lg border">
          <div>
            <p className="text-sm font-medium">Password</p>
            <p className="text-xs text-muted-foreground">
              Status: {user.passwordEnabled ? 'Configured' : 'Not set'}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePasswordChange}
          >
            Change Password
            <ExternalLink className="ml-2 h-3 w-3" />
          </Button>
        </div>
      </div>

      <Separator />

      {/* Two-Factor Authentication */}
      <div className="space-y-4">
        <div>
          <Label className="text-base font-semibold flex items-center gap-2">
            <Smartphone className="h-4 w-4" />
            Two-Factor Authentication
          </Label>
          <p className="text-sm text-muted-foreground mt-1">
            Add an extra layer of security to your account
          </p>
        </div>
        <div className="flex items-center justify-between p-4 rounded-lg border">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-sm font-medium">2FA Status</p>
              <p className="text-xs text-muted-foreground">
                {is2FAEnabled
                  ? 'Your account is protected with 2FA'
                  : 'Not configured'}
              </p>
            </div>
            {is2FAEnabled ? (
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                Enabled
              </Badge>
            ) : (
              <Badge variant="outline">Disabled</Badge>
            )}
          </div>
          <Button
            variant={is2FAEnabled ? 'outline' : 'default'}
            size="sm"
            onClick={handle2FASetup}
          >
            {is2FAEnabled ? 'Manage 2FA' : 'Enable 2FA'}
            <ExternalLink className="ml-2 h-3 w-3" />
          </Button>
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
          {user?.emailAddresses.map((email) => (
            <div
              key={email.id}
              className="flex items-center justify-between p-3 rounded-lg border"
            >
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-sm font-medium">{email.emailAddress}</p>
                  <p className="text-xs text-muted-foreground">Email</p>
                </div>
                {email.verification?.status === 'verified' && (
                  <Badge variant="secondary" className="text-xs">
                    Verified
                  </Badge>
                )}
              </div>
            </div>
          ))}

          {user?.externalAccounts.map((account) => (
            <div
              key={account.id}
              className="flex items-center justify-between p-3 rounded-lg border"
            >
              <div>
                <p className="text-sm font-medium capitalize">{account.provider}</p>
                <p className="text-xs text-muted-foreground">
                  Connected as {account.emailAddress}
                </p>
              </div>
            </div>
          ))}
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