/**
 * Tribora SDK — Embeddable knowledge widget.
 *
 * Usage (UMD):
 *   <script src="https://cdn.tribora.ai/sdk/tribora-sdk.js"></script>
 *   <script>
 *     const tribora = new Tribora({ apiKey: 'sk_live_...' });
 *     tribora.init();
 *   </script>
 *
 * Usage (ESM):
 *   import { Tribora } from '@tribora/sdk';
 *   const tribora = new Tribora({ apiKey: 'sk_live_...' });
 *   tribora.init();
 */

import { QueryClient } from './query-client';
import { createSdkOverlay } from './overlay';
import { Widget } from './widget';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TriboraOptions {
  /** Vendor API key (sk_live_...) */
  apiKey: string;
  /** Container element or CSS selector for the widget. Default: floating FAB. */
  container?: string | HTMLElement;
  /** Tribora API base URL. Default: https://app.tribora.ai */
  apiUrl?: string;
  /** Theme overrides (can be auto-populated from vendor branding) */
  theme?: {
    primaryColor?: string;
    logoUrl?: string;
    productName?: string;
  };
}

// ─── Main Class ─────────────────────────────────────────────────────────────

export class Tribora {
  private options: Required<Pick<TriboraOptions, 'apiKey' | 'apiUrl'>> &
    Omit<TriboraOptions, 'apiKey' | 'apiUrl'>;
  private queryClient: QueryClient;
  private widget: Widget | null = null;
  private initialized = false;

  constructor(options: TriboraOptions) {
    if (!options.apiKey) {
      throw new Error('[Tribora] apiKey is required');
    }

    this.options = {
      ...options,
      apiUrl: options.apiUrl ?? 'https://app.tribora.ai',
    };

    this.queryClient = new QueryClient({
      apiKey: this.options.apiKey,
      apiUrl: this.options.apiUrl,
    });
  }

  /**
   * Initialize the widget: fetch vendor branding, render the FAB and panel.
   * Safe to call multiple times — subsequent calls are no-ops.
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    // Create overlay on the host page
    const overlay = createSdkOverlay(this.options.theme?.primaryColor);

    // Create widget with initial theme
    this.widget = new Widget({
      container: this.options.container,
      theme: this.options.theme,
      queryClient: this.queryClient,
      overlay,
    });

    // Fetch vendor branding asynchronously — don't block widget render
    this.queryClient
      .fetchInitConfig()
      .then((config) => {
        if (config.branding && this.widget) {
          this.widget.applyBranding(config.branding);
        }
      })
      .catch((err) => {
        // Branding fetch is non-critical — widget works without it
        console.warn('[Tribora] Failed to fetch branding:', err.message);
      });
  }

  /**
   * Remove the widget and clean up all event listeners / DOM nodes.
   */
  destroy(): void {
    if (this.widget) {
      this.widget.destroy();
      this.widget = null;
    }
    this.queryClient.abort();
    this.initialized = false;
  }

  /**
   * Programmatically ask a question. Opens the widget if closed.
   */
  async ask(question: string): Promise<void> {
    if (!this.initialized || !this.widget) {
      await this.init();
    }
    if (this.widget) {
      this.widget.open();
      this.widget.sendQuestion(question);
    }
  }
}

// ─── UMD Global Export ──────────────────────────────────────────────────────

// Make Tribora available on window for UMD consumers
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).Tribora = Tribora;
}
