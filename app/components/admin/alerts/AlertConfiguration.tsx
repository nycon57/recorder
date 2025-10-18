'use client';

import { useState } from 'react';
import { Settings, Save } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Switch } from '@/app/components/ui/switch';
import { Separator } from '@/app/components/ui/separator';

export default function AlertConfiguration() {
  const [config, setConfig] = useState({
    storageThreshold: 90,
    costThreshold: 1000,
    enableEmailNotifications: true,
    enableSlackNotifications: false,
    checkInterval: 15,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{
    storageThreshold?: string;
    costThreshold?: string;
    checkInterval?: string;
  }>({});

  const validateConfig = (): boolean => {
    const errors: typeof validationErrors = {};

    // Validate storage threshold
    if (config.storageThreshold < 0 || config.storageThreshold > 100) {
      errors.storageThreshold = 'Must be between 0 and 100';
    }

    // Validate cost threshold
    if (config.costThreshold <= 0) {
      errors.costThreshold = 'Must be a positive number';
    }

    // Validate check interval
    if (config.checkInterval < 5 || config.checkInterval > 60) {
      errors.checkInterval = 'Must be between 5 and 60 minutes';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    setError(null);

    // Validate before saving
    if (!validateConfig()) {
      setError('Please fix the validation errors before saving');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/analytics/alert-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to save configuration' }));
        throw new Error(errorData.message || 'Failed to save configuration');
      }

      // Success - could show a toast notification here
      console.log('Configuration saved successfully');
    } catch (err) {
      console.error('Error saving configuration:', err);
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Alert Configuration
        </CardTitle>
        <CardDescription>
          Configure thresholds and notification settings for storage alerts
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Threshold Settings */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium">Alert Thresholds</h3>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="storageThreshold">
                Storage Usage Threshold (%)
              </Label>
              <Input
                id="storageThreshold"
                type="number"
                min="0"
                max="100"
                value={config.storageThreshold}
                onChange={(e) => {
                  const parsed = parseInt(e.target.value);
                  const newValue = Number.isNaN(parsed) ? 0 : parsed;
                  setConfig({ ...config, storageThreshold: newValue });

                  // Real-time validation
                  if (newValue < 0 || newValue > 100) {
                    setValidationErrors(prev => ({
                      ...prev,
                      storageThreshold: 'Must be between 0 and 100'
                    }));
                  } else {
                    setValidationErrors(prev => {
                      const { storageThreshold, ...rest } = prev;
                      return rest;
                    });
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                Alert when storage usage exceeds this percentage
              </p>
              {validationErrors.storageThreshold && (
                <p className="text-xs text-destructive">{validationErrors.storageThreshold}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="costThreshold">
                Monthly Cost Threshold ($)
              </Label>
              <Input
                id="costThreshold"
                type="number"
                min="0"
                value={config.costThreshold}
                onChange={(e) => {
                  const parsed = parseInt(e.target.value);
                  const newValue = Number.isNaN(parsed) ? 0 : parsed;
                  setConfig({ ...config, costThreshold: newValue });

                  // Real-time validation
                  if (newValue <= 0) {
                    setValidationErrors(prev => ({
                      ...prev,
                      costThreshold: 'Must be a positive number'
                    }));
                  } else {
                    setValidationErrors(prev => {
                      const { costThreshold, ...rest } = prev;
                      return rest;
                    });
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                Alert when monthly costs exceed this amount
              </p>
              {validationErrors.costThreshold && (
                <p className="text-xs text-destructive">{validationErrors.costThreshold}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="checkInterval">
              Alert Check Interval (minutes)
            </Label>
            <Input
              id="checkInterval"
              type="number"
              min="5"
              max="60"
              value={config.checkInterval}
              onChange={(e) => {
                const parsed = parseInt(e.target.value);
                const newValue = Number.isNaN(parsed) ? 5 : parsed;
                setConfig({ ...config, checkInterval: newValue });

                // Real-time validation
                if (newValue < 5 || newValue > 60) {
                  setValidationErrors(prev => ({
                    ...prev,
                    checkInterval: 'Must be between 5 and 60 minutes'
                  }));
                } else {
                  setValidationErrors(prev => {
                    const { checkInterval, ...rest } = prev;
                    return rest;
                  });
                }
              }}
              className="max-w-xs"
            />
            <p className="text-xs text-muted-foreground">
              How often to check for alert conditions (5-60 minutes)
            </p>
            {validationErrors.checkInterval && (
              <p className="text-xs text-destructive">{validationErrors.checkInterval}</p>
            )}
          </div>
        </div>

        <Separator />

        {/* Notification Settings */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium">Notification Channels</h3>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="emailNotifications">Email Notifications</Label>
                <p className="text-xs text-muted-foreground">
                  Send alerts to configured email addresses
                </p>
              </div>
              <Switch
                id="emailNotifications"
                checked={config.enableEmailNotifications}
                onCheckedChange={(checked) =>
                  setConfig({ ...config, enableEmailNotifications: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="slackNotifications">Slack Notifications</Label>
                <p className="text-xs text-muted-foreground">
                  Send alerts to Slack workspace
                </p>
              </div>
              <Switch
                id="slackNotifications"
                checked={config.enableSlackNotifications}
                onCheckedChange={(checked) =>
                  setConfig({ ...config, enableSlackNotifications: checked })
                }
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
            {error}
          </div>
        )}

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={saving || Object.keys(validationErrors).length > 0}
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Configuration'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
