'use client';

/**
 * Vendor Admin — Voice Configuration (TRIB-53)
 *
 * Client Component form for managing ElevenLabs voice settings:
 * voice ID, stability slider, and similarity boost slider.
 */

import { useReducer } from 'react';
import { useQuery } from '@tanstack/react-query';
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

type VoiceConfigResult = {
  exists: boolean;
  config: any | null;
};

type VoiceState = {
  saving: boolean;
  configExists: boolean;
  voiceId: string;
  stability: number;
  similarityBoost: number;
};

type VoiceAction = { type: 'patch'; patch: Partial<VoiceState> };

const emptyVoiceState: VoiceState = {
  saving: false,
  configExists: false,
  voiceId: '',
  stability: 0.5,
  similarityBoost: 0.75,
};

function createVoiceState(result: VoiceConfigResult): VoiceState {
  const config = result.config;
  return {
    ...emptyVoiceState,
    configExists: result.exists,
    voiceId: config?.voice_config?.elevenlabs_voice_id ?? '',
    stability: config?.voice_config?.stability ?? 0.5,
    similarityBoost: config?.voice_config?.similarity_boost ?? 0.75,
  };
}

function voiceReducer(state: VoiceState, action: VoiceAction): VoiceState {
  return { ...state, ...action.patch };
}

async function fetchVoiceConfig(
  signal: AbortSignal,
): Promise<VoiceConfigResult> {
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

export default function VoicePage() {
  const {
    data: configResult,
    isLoading,
    error,
  } = useQuery<VoiceConfigResult, Error>({
    queryKey: ['vendor', 'voice-config'],
    queryFn: ({ signal }) => fetchVoiceConfig(signal),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16" role="status">
        <div className="text-center">
          <Loader2 className="mx-auto size-8 animate-spin text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            Loading voice configuration…
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
            <Mic className="size-7" />
            Voice Settings
          </h1>
        </header>
        <Card>
          <CardHeader>
            <CardTitle>Unable to load voice settings</CardTitle>
            <CardDescription>{error.message}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <VoiceForm configResult={configResult ?? { exists: false, config: null }} />
  );
}

function VoiceForm({ configResult }: { configResult: VoiceConfigResult }) {
  const { push, refresh } = useRouter();
  const [state, dispatch] = useReducer(
    voiceReducer,
    configResult,
    createVoiceState,
  );
  const { saving, configExists, voiceId, stability, similarityBoost } = state;

  async function handleSave() {
    if (!configExists) {
      toast.error(
        'Please set up your white-label configuration in Branding first.',
      );
      return;
    }

    dispatch({ type: 'patch', patch: { saving: true } });
    try {
      const voice_config: Record<string, string | number> = {};
      if (voiceId.trim()) voice_config.elevenlabs_voice_id = voiceId.trim();
      voice_config.stability = stability;
      voice_config.similarity_boost = similarityBoost;

      const res = await fetch('/api/vendor/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice_config }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message ?? err.message ?? 'Failed to save');
      }

      toast.success('Voice settings updated successfully');
      refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to save voice settings',
      );
    } finally {
      dispatch({ type: 'patch', patch: { saving: false } });
    }
  }

  if (!configExists) {
    return (
      <div className="trbd-page">
        <header>
          <h1 className="trbd-page-title tracking-tight flex items-center gap-2">
            <Mic className="size-7" />
            Voice Settings
          </h1>
        </header>
        <Card>
          <CardHeader>
            <CardTitle>Configuration required</CardTitle>
            <CardDescription>
              You need to set up your white-label configuration first. Go to
              Branding to create your config, then come back here to configure
              voice settings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => push('/vendor-admin/branding')}
            >
              Go to Branding
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="trbd-page">
      <header>
        <h1 className="trbd-page-title tracking-tight flex items-center gap-2">
          <Mic className="size-7" />
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
            Set the voice ID and tune stability and similarity boost parameters.
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
              onChange={(e) =>
                dispatch({
                  type: 'patch',
                  patch: { voiceId: e.target.value },
                })
              }
            />
            <p className="text-xs text-muted-foreground">
              Find voice IDs in your ElevenLabs dashboard under Voice Lab.
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
              onValueChange={([v]) =>
                dispatch({ type: 'patch', patch: { stability: v } })
              }
            />
            <p className="text-xs text-muted-foreground">
              Higher values produce more consistent output. Lower values add
              more expressiveness.
            </p>
          </div>

          {/* Similarity Boost */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="similarity-boost">Similarity Boost</Label>
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
              onValueChange={([v]) =>
                dispatch({
                  type: 'patch',
                  patch: { similarityBoost: v },
                })
              }
            />
            <p className="text-xs text-muted-foreground">
              Higher values make the voice more closely match the original.
              Lower values allow more variation.
            </p>
          </div>

          {/* Save */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              Save voice settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
