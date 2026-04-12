'use client';

/**
 * Vendor Admin — Voice Configuration (TRIB-53)
 *
 * Client Component form for managing ElevenLabs voice settings:
 * voice ID, stability slider, and similarity boost slider.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Mic, Loader2 } from 'lucide-react';

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
import { Slider } from '@/app/components/ui/slider';

export default function VoicePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configExists, setConfigExists] = useState(false);

  // Form fields
  const [voiceId, setVoiceId] = useState('');
  const [stability, setStability] = useState(0.5);
  const [similarityBoost, setSimilarityBoost] = useState(0.75);

  // Fetch existing config on mount
  useEffect(() => {
    async function fetchConfig() {
      try {
        const res = await fetch('/api/vendor/config');
        if (res.ok) {
          const json = await res.json();
          const config = json.data;
          setConfigExists(true);
          setVoiceId(config.voice_config?.elevenlabs_voice_id ?? '');
          setStability(config.voice_config?.stability ?? 0.5);
          setSimilarityBoost(
            config.voice_config?.similarity_boost ?? 0.75
          );
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
    if (!configExists) {
      toast.error(
        'Please set up your white-label configuration in Branding first.'
      );
      return;
    }

    setSaving(true);
    try {
      const voice_config: Record<string, string | number> = {};
      if (voiceId.trim())
        voice_config.elevenlabs_voice_id = voiceId.trim();
      voice_config.stability = stability;
      voice_config.similarity_boost = similarityBoost;

      const res = await fetch('/api/vendor/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice_config }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          err.error?.message ?? err.message ?? 'Failed to save'
        );
      }

      toast.success('Voice settings updated successfully');
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'Failed to save voice settings'
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
            Loading voice configuration...
          </p>
        </div>
      </div>
    );
  }

  if (!configExists) {
    return (
      <div className="container mx-auto space-y-6 py-8">
        <header>
          <h1 className="text-3xl font-normal tracking-tight flex items-center gap-2">
            <Mic className="h-7 w-7" />
            Voice Settings
          </h1>
        </header>
        <Card>
          <CardHeader>
            <CardTitle>Configuration required</CardTitle>
            <CardDescription>
              You need to set up your white-label configuration first.
              Go to Branding to create your config, then come back here
              to configure voice settings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => router.push('/vendor-admin/branding')}
            >
              Go to Branding
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 py-8">
      <header>
        <h1 className="text-3xl font-normal tracking-tight flex items-center gap-2">
          <Mic className="h-7 w-7" />
          Voice Settings
        </h1>
        <p className="mt-1 text-muted-foreground">
          Configure the AI voice for your white-label experience.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            ElevenLabs Voice Configuration
          </CardTitle>
          <CardDescription>
            Set the voice ID and tune stability and similarity boost
            parameters.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Voice ID */}
          <div className="space-y-2">
            <Label htmlFor="voice-id">ElevenLabs Voice ID</Label>
            <Input
              id="voice-id"
              type="text"
              placeholder="e.g. 21m00Tcm4TlvDq8ikWAM"
              value={voiceId}
              onChange={(e) => setVoiceId(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Find voice IDs in your ElevenLabs dashboard under Voice
              Lab.
            </p>
          </div>

          {/* Stability */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="stability">Stability</Label>
              <span className="text-sm text-muted-foreground tabular-nums">
                {stability.toFixed(2)}
              </span>
            </div>
            <Slider
              id="stability"
              min={0}
              max={1}
              step={0.01}
              value={[stability]}
              onValueChange={([v]) => setStability(v)}
            />
            <p className="text-xs text-muted-foreground">
              Higher values produce more consistent output. Lower
              values add more expressiveness.
            </p>
          </div>

          {/* Similarity Boost */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="similarity-boost">
                Similarity Boost
              </Label>
              <span className="text-sm text-muted-foreground tabular-nums">
                {similarityBoost.toFixed(2)}
              </span>
            </div>
            <Slider
              id="similarity-boost"
              min={0}
              max={1}
              step={0.01}
              value={[similarityBoost]}
              onValueChange={([v]) => setSimilarityBoost(v)}
            />
            <p className="text-xs text-muted-foreground">
              Higher values make the voice more closely match the
              original. Lower values allow more variation.
            </p>
          </div>

          {/* Save */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save voice settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
