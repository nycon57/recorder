/**
 * widget.ts — Floating chat widget for the Tribora SDK.
 *
 * Renders a FAB (floating action button) that expands into a chat-style
 * panel. Uses Shadow DOM to encapsulate styles from the host page.
 *
 * The widget is self-contained — it manages its own DOM tree, event
 * listeners, message history, and streaming state.
 */

import type { QueryClient, CitationEvent, ElementRefEvent, SdkInitResponse } from './query-client';
import type { SdkOverlay } from './overlay';
import { buildPageContext } from './context';
import widgetStyles from './styles.css?inline';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WidgetTheme {
  primaryColor?: string;
  logoUrl?: string;
  productName?: string;
}

export interface WidgetOptions {
  container?: string | HTMLElement;
  theme?: WidgetTheme;
  queryClient: QueryClient;
  overlay: SdkOverlay;
}

interface Message {
  role: 'user' | 'assistant';
  text: string;
  citations: CitationEvent[];
  streaming: boolean;
}

// ─── SVG Icons (safe DOM methods) ───────────────────────────────────────────

function createChatIcon(): SVGSVGElement {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'currentColor');
  svg.setAttribute('width', '24');
  svg.setAttribute('height', '24');
  // Chat bubble icon
  const path = document.createElementNS(NS, 'path');
  path.setAttribute(
    'd',
    'M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4V4c0-1.1-.9-2-2-2zm0 15.17L18.83 16H4V4h16v13.17zM7 9h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z',
  );
  svg.appendChild(path);
  return svg;
}

function createCloseIcon(): SVGSVGElement {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'currentColor');
  svg.setAttribute('width', '18');
  svg.setAttribute('height', '18');
  const path = document.createElementNS(NS, 'path');
  path.setAttribute(
    'd',
    'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
  );
  svg.appendChild(path);
  return svg;
}

function createSendIcon(): SVGSVGElement {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'currentColor');
  svg.setAttribute('width', '18');
  svg.setAttribute('height', '18');
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', 'M2.01 21L23 12 2.01 3 2 10l15 2-15 2z');
  svg.appendChild(path);
  return svg;
}

// ─── Widget Class ───────────────────────────────────────────────────────────

export class Widget {
  private host: HTMLElement;
  private shadow: ShadowRoot;
  private queryClient: QueryClient;
  private overlay: SdkOverlay;
  private theme: WidgetTheme;

  // DOM references
  private fab!: HTMLButtonElement;
  private panel!: HTMLDivElement;
  private messagesContainer!: HTMLDivElement;
  private input!: HTMLTextAreaElement;
  private sendBtn!: HTMLButtonElement;

  // State
  private isOpen = false;
  private messages: Message[] = [];
  private isStreaming = false;
  private abortQuery: (() => void) | null = null;

  constructor(options: WidgetOptions) {
    this.queryClient = options.queryClient;
    this.overlay = options.overlay;
    this.theme = options.theme ?? {};

    // Resolve container
    let container: HTMLElement;
    if (options.container) {
      if (typeof options.container === 'string') {
        const el = document.querySelector(options.container);
        if (!el || !(el instanceof HTMLElement)) {
          container = document.createElement('div');
          document.body.appendChild(container);
        } else {
          container = el;
        }
      } else {
        container = options.container;
      }
    } else {
      container = document.createElement('div');
      container.id = 'tribora-sdk-widget-host';
      document.body.appendChild(container);
    }

    this.host = container;
    this.shadow = container.attachShadow({ mode: 'open' });

    this.buildDOM();
    this.attachEventListeners();
  }

  // ── Branding Update ─────────────────────────────────────────────────────

  applyBranding(config: SdkInitResponse['branding']): void {
    if (config.primary_color) {
      this.theme.primaryColor = config.primary_color;
      this.shadow.host.setAttribute(
        'style',
        `--tribora-primary: ${config.primary_color}`,
      );
      this.overlay.setAccentColor(config.primary_color);
    }

    if (config.logo_url) {
      this.theme.logoUrl = config.logo_url;
      // Update FAB logo
      const fabImg = this.fab.querySelector('img');
      if (fabImg) {
        fabImg.src = config.logo_url;
      } else {
        // Replace SVG icon with logo image
        while (this.fab.firstChild) this.fab.removeChild(this.fab.firstChild);
        const img = document.createElement('img');
        img.src = config.logo_url;
        img.alt = config.product_name ?? 'Help';
        this.fab.appendChild(img);
      }
      // Update header logo
      const headerLogo = this.shadow.querySelector(
        '.tribora-header-logo',
      ) as HTMLImageElement | null;
      if (headerLogo) {
        headerLogo.src = config.logo_url;
        headerLogo.style.display = 'block';
      }
    }

    if (config.product_name) {
      this.theme.productName = config.product_name;
      const title = this.shadow.querySelector('.tribora-header-title');
      if (title) title.textContent = config.product_name;
    }
  }

  // ── DOM Construction ────────────────────────────────────────────────────

  private buildDOM(): void {
    // Inject styles
    const style = document.createElement('style');
    style.textContent = widgetStyles;

    // Apply custom primary color
    if (this.theme.primaryColor) {
      this.host.setAttribute(
        'style',
        `--tribora-primary: ${this.theme.primaryColor}`,
      );
    }

    // FAB button
    this.fab = document.createElement('button');
    this.fab.className = 'tribora-fab';
    this.fab.setAttribute('aria-label', 'Open help widget');
    this.fab.setAttribute('type', 'button');

    if (this.theme.logoUrl) {
      const img = document.createElement('img');
      img.src = this.theme.logoUrl;
      img.alt = this.theme.productName ?? 'Help';
      this.fab.appendChild(img);
    } else {
      this.fab.appendChild(createChatIcon());
    }

    // Panel
    this.panel = document.createElement('div');
    this.panel.className = 'tribora-panel';
    this.panel.setAttribute('role', 'dialog');
    this.panel.setAttribute('aria-label', 'Help chat');

    // Header
    const header = document.createElement('div');
    header.className = 'tribora-header';

    const headerLogo = document.createElement('img');
    headerLogo.className = 'tribora-header-logo';
    headerLogo.alt = '';
    if (this.theme.logoUrl) {
      headerLogo.src = this.theme.logoUrl;
    } else {
      headerLogo.style.display = 'none';
    }

    const headerTitle = document.createElement('div');
    headerTitle.className = 'tribora-header-title';
    headerTitle.textContent = this.theme.productName ?? 'Help';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'tribora-close-btn';
    closeBtn.setAttribute('aria-label', 'Close help widget');
    closeBtn.setAttribute('type', 'button');
    closeBtn.appendChild(createCloseIcon());

    header.appendChild(headerLogo);
    header.appendChild(headerTitle);
    header.appendChild(closeBtn);

    // Messages
    this.messagesContainer = document.createElement('div');
    this.messagesContainer.className = 'tribora-messages';

    // Welcome message
    this.renderWelcome();

    // Input area
    const inputArea = document.createElement('div');
    inputArea.className = 'tribora-input-area';

    this.input = document.createElement('textarea');
    this.input.className = 'tribora-input';
    this.input.placeholder = 'Ask a question...';
    this.input.rows = 1;
    this.input.setAttribute('aria-label', 'Type your question');

    this.sendBtn = document.createElement('button');
    this.sendBtn.className = 'tribora-send-btn';
    this.sendBtn.setAttribute('aria-label', 'Send question');
    this.sendBtn.setAttribute('type', 'button');
    this.sendBtn.appendChild(createSendIcon());

    inputArea.appendChild(this.input);
    inputArea.appendChild(this.sendBtn);

    // Assemble panel
    this.panel.appendChild(header);
    this.panel.appendChild(this.messagesContainer);
    this.panel.appendChild(inputArea);

    // Attach to shadow root
    this.shadow.appendChild(style);
    this.shadow.appendChild(this.fab);
    this.shadow.appendChild(this.panel);
  }

  private renderWelcome(): void {
    const welcome = document.createElement('div');
    welcome.className = 'tribora-welcome';

    const icon = document.createElement('span');
    icon.className = 'tribora-welcome-icon';
    icon.textContent = '\u{1F4AC}'; // speech bubble emoji

    const h3 = document.createElement('h3');
    h3.textContent = this.theme.productName
      ? `Welcome to ${this.theme.productName}`
      : 'How can I help?';

    const p = document.createElement('p');
    p.textContent = 'Ask me anything about this page. I can guide you through steps and highlight relevant elements.';

    welcome.appendChild(icon);
    welcome.appendChild(h3);
    welcome.appendChild(p);
    this.messagesContainer.appendChild(welcome);
  }

  // ── Event Listeners ─────────────────────────────────────────────────────

  private attachEventListeners(): void {
    // FAB click → open
    this.fab.addEventListener('click', () => this.open());

    // Close button
    const closeBtn = this.shadow.querySelector('.tribora-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    // Send button
    this.sendBtn.addEventListener('click', () => this.handleSend());

    // Enter to send (Shift+Enter for newline)
    this.input.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    });

    // Auto-resize textarea
    this.input.addEventListener('input', () => {
      this.input.style.height = 'auto';
      this.input.style.height = `${Math.min(this.input.scrollHeight, 120)}px`;
    });

    // Close on Escape
    this.shadow.addEventListener('keydown', (e: Event) => {
      if ((e as KeyboardEvent).key === 'Escape' && this.isOpen) {
        this.close();
      }
    });
  }

  // ── Open / Close ────────────────────────────────────────────────────────

  open(): void {
    this.isOpen = true;
    this.fab.classList.add('tribora-fab--hidden');
    this.panel.classList.add('tribora-panel--open');
    // Focus input after the animation
    setTimeout(() => this.input.focus(), 220);
  }

  close(): void {
    this.isOpen = false;
    this.panel.classList.remove('tribora-panel--open');
    this.fab.classList.remove('tribora-fab--hidden');
    this.overlay.clear();
  }

  // ── Send Logic ──────────────────────────────────────────────────────────

  private handleSend(): void {
    const question = this.input.value.trim();
    if (!question || this.isStreaming) return;

    this.sendQuestion(question);
  }

  /**
   * Programmatic question submission (used by Tribora.ask()).
   */
  sendQuestion(question: string): void {
    // Clear welcome message if present
    const welcome = this.messagesContainer.querySelector('.tribora-welcome');
    if (welcome) welcome.remove();

    // Add user message
    this.messages.push({
      role: 'user',
      text: question,
      citations: [],
      streaming: false,
    });
    this.renderMessage(this.messages[this.messages.length - 1]);

    // Clear input
    this.input.value = '';
    this.input.style.height = 'auto';

    // Start assistant message
    const assistantMsg: Message = {
      role: 'assistant',
      text: '',
      citations: [],
      streaming: true,
    };
    this.messages.push(assistantMsg);
    const msgEl = this.renderMessage(assistantMsg);

    // Stream the response
    this.isStreaming = true;
    this.sendBtn.disabled = true;
    this.overlay.clear();

    const context = buildPageContext();

    this.abortQuery = this.queryClient.query(question, context, {
      onTextChunk: (text: string) => {
        assistantMsg.text += text;
        this.updateMessageText(msgEl, assistantMsg);
        this.scrollToBottom();
      },

      onElementRef: (event) => {
        this.handleElementRef(event);
      },

      onCitation: (event: CitationEvent) => {
        assistantMsg.citations.push(event);
        this.updateMessageCitations(msgEl, assistantMsg);
      },

      onDone: () => {
        assistantMsg.streaming = false;
        this.isStreaming = false;
        this.sendBtn.disabled = false;
        this.abortQuery = null;
        // Remove streaming cursor
        const textEl = msgEl.querySelector('.tribora-msg--streaming');
        if (textEl) textEl.classList.remove('tribora-msg--streaming');
      },

      onError: (error: string) => {
        assistantMsg.streaming = false;
        this.isStreaming = false;
        this.sendBtn.disabled = false;
        this.abortQuery = null;

        if (!assistantMsg.text) {
          assistantMsg.text = 'Sorry, something went wrong. Please try again.';
          this.updateMessageText(msgEl, assistantMsg);
        }

        // Show error inline
        const errorEl = document.createElement('div');
        errorEl.className = 'tribora-error';
        errorEl.textContent = error;
        msgEl.appendChild(errorEl);
        this.scrollToBottom();
      },
    });
  }

  // ── Element Ref Handling ────────────────────────────────────────────────

  private handleElementRef(event: ElementRefEvent): void {
    switch (event.action) {
      case 'point':
        this.overlay.pointAt(event.selector, event.label);
        break;
      case 'highlight':
        this.overlay.highlight(event.selector);
        break;
      case 'pulse':
        this.overlay.pulse(event.selector);
        break;
    }
  }

  // ── Rendering ───────────────────────────────────────────────────────────

  private renderMessage(msg: Message): HTMLDivElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'tribora-msg-wrapper';

    const bubble = document.createElement('div');
    bubble.className = `tribora-msg tribora-msg--${msg.role}`;
    if (msg.streaming) bubble.classList.add('tribora-msg--streaming');
    bubble.textContent = msg.text || '\u200B'; // Zero-width space for empty streaming

    wrapper.appendChild(bubble);
    this.messagesContainer.appendChild(wrapper);
    this.scrollToBottom();

    return wrapper;
  }

  private updateMessageText(el: HTMLDivElement, msg: Message): void {
    const bubble = el.querySelector('.tribora-msg');
    if (bubble) {
      bubble.textContent = msg.text;
      if (msg.streaming) {
        bubble.classList.add('tribora-msg--streaming');
      }
    }
  }

  private updateMessageCitations(el: HTMLDivElement, msg: Message): void {
    // Remove existing citations container
    const existing = el.querySelector('.tribora-citations');
    if (existing) existing.remove();

    if (msg.citations.length === 0) return;

    const citationsEl = document.createElement('div');
    citationsEl.className = 'tribora-citations';

    msg.citations.forEach((citation, i) => {
      const row = document.createElement('div');
      row.className = 'tribora-citation';

      const idx = document.createElement('span');
      idx.className = 'tribora-citation-idx';
      idx.textContent = `[${i + 1}]`;

      const title = document.createElement('span');
      title.className = 'tribora-citation-title';
      title.textContent = citation.title;

      row.appendChild(idx);
      row.appendChild(title);
      citationsEl.appendChild(row);
    });

    el.appendChild(citationsEl);
  }

  private scrollToBottom(): void {
    requestAnimationFrame(() => {
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    });
  }

  // ── Cleanup ─────────────────────────────────────────────────────────────

  destroy(): void {
    if (this.abortQuery) {
      this.abortQuery();
      this.abortQuery = null;
    }
    this.overlay.destroy();
    this.host.remove();
  }
}
