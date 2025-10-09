'use client';

import { useState } from 'react';
import { CreditCard, Download, AlertCircle } from 'lucide-react';

export default function BillingSettingsPage() {
  const [isLoading, setIsLoading] = useState(false);

  // Placeholder data - in production, fetch from API
  const currentPlan = 'Free';
  const usageStats = {
    recordings: 2,
    recordingsLimit: 5,
    storage: '150 MB',
    storageLimit: '1 GB',
  };

  const handleUpgrade = async () => {
    setIsLoading(true);
    try {
      // Call API to create Stripe checkout session
      const response = await fetch('/api/billing/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId: 'price_pro' }),
      });

      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManageBilling = async () => {
    setIsLoading(true);
    try {
      // Call API to create Stripe customer portal session
      const response = await fetch('/api/billing/create-portal', {
        method: 'POST',
      });

      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error('Error creating portal session:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Billing & Subscription</h1>
        <p className="text-muted-foreground">
          Manage your subscription, billing information, and usage
        </p>
      </div>

      {/* Current Plan */}
      <div className="border border-border rounded-lg p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold mb-1">Current Plan</h2>
            <p className="text-3xl font-bold text-primary">{currentPlan}</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-accent/10 text-accent rounded-full text-sm font-medium">
            Active
          </div>
        </div>

        {currentPlan === 'Free' && (
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground mb-1">
                  Upgrade to unlock more features
                </p>
                <p className="text-sm text-muted-foreground">
                  Get unlimited recordings, advanced AI features, and team collaboration with Pro.
                </p>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={currentPlan === 'Free' ? handleUpgrade : handleManageBilling}
          disabled={isLoading}
          className="px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition disabled:opacity-50"
        >
          {isLoading
            ? 'Loading...'
            : currentPlan === 'Free'
              ? 'Upgrade to Pro'
              : 'Manage Subscription'}
        </button>
      </div>

      {/* Usage Stats */}
      <div className="border border-border rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Current Usage</h2>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>Recordings</span>
              <span className="text-muted-foreground">
                {usageStats.recordings} / {usageStats.recordingsLimit}
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full"
                style={{
                  width: `${(usageStats.recordings / usageStats.recordingsLimit) * 100}%`,
                }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>Storage</span>
              <span className="text-muted-foreground">
                {usageStats.storage} / {usageStats.storageLimit}
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div className="bg-primary h-2 rounded-full" style={{ width: '15%' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Payment Method */}
      <div className="border border-border rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Payment Method</h2>
          {currentPlan !== 'Free' && (
            <button
              onClick={handleManageBilling}
              className="text-primary hover:underline text-sm"
            >
              Update
            </button>
          )}
        </div>

        {currentPlan === 'Free' ? (
          <p className="text-muted-foreground">No payment method on file</p>
        ) : (
          <div className="flex items-center gap-3 p-4 border border-border rounded-lg">
            <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <p className="font-medium">Visa ending in 4242</p>
              <p className="text-sm text-muted-foreground">Expires 12/2025</p>
            </div>
          </div>
        )}
      </div>

      {/* Billing History */}
      <div className="border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Billing History</h2>
        </div>

        {currentPlan === 'Free' ? (
          <p className="text-muted-foreground">No billing history</p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 border border-border rounded-lg">
              <div>
                <p className="font-medium">Pro Plan</p>
                <p className="text-sm text-muted-foreground">Jan 1, 2025</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-semibold">$29.00</span>
                <button className="text-primary hover:underline text-sm flex items-center gap-1">
                  <Download className="w-4 h-4" />
                  Invoice
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 border border-border rounded-lg">
              <div>
                <p className="font-medium">Pro Plan</p>
                <p className="text-sm text-muted-foreground">Dec 1, 2024</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-semibold">$29.00</span>
                <button className="text-primary hover:underline text-sm flex items-center gap-1">
                  <Download className="w-4 h-4" />
                  Invoice
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
