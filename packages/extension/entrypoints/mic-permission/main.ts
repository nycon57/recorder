import {
  deriveMicPermissionViewModel,
  type MicPermissionStatusTone,
  type MicPermissionViewState,
} from '../../utils/mic-permission-view.js';
import { TRIBORA_EXTENSION_THEME } from '../../utils/tribora-theme.js';

const LOG = '[Tribora mic]';
const MIC_PERMISSION_GRANTED_KEY = 'micPermissionGranted';

const app = document.getElementById('app');
if (!app) {
  throw new Error('Mic permission root element not found');
}

const params = new URLSearchParams(window.location.search);
const resumeTabId = Number(params.get('resumeTabId') ?? '');

document.documentElement.style.background =
  TRIBORA_EXTENSION_THEME.color.surface0;
document.body.style.margin = '0';
document.body.style.minHeight = '100vh';
document.body.style.background =
  'radial-gradient(circle at 14% -12%, rgba(245,190,77,0.2), transparent 42%), linear-gradient(180deg, rgba(41,35,22,0.2) 0%, rgba(20,18,15,0.98) 44%)';
document.body.style.color = TRIBORA_EXTENSION_THEME.color.ink;
document.body.style.fontFamily = TRIBORA_EXTENSION_THEME.font.body;
document.body.style.display = 'flex';
document.body.style.alignItems = 'center';
document.body.style.justifyContent = 'center';
document.body.style.padding = '24px';

app.innerHTML = `
  <style>
    .trb-mic-card {
      width: min(100%, 560px);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 14px;
      padding: 30px;
      background: linear-gradient(180deg, rgba(26,23,19,0.94) 0%, rgba(19,17,14,0.97) 100%);
      box-shadow: 0 26px 74px rgba(0,0,0,0.44), inset 0 1px 0 rgba(255,255,255,0.04);
    }
    .trb-mic-kicker {
      margin: 0 0 14px;
      color: ${TRIBORA_EXTENSION_THEME.color.inkFaint};
      font-family: ${TRIBORA_EXTENSION_THEME.font.mono};
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }
    .trb-mic-mark {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 46px;
      height: 46px;
      border-radius: 11px;
      background: linear-gradient(145deg, ${TRIBORA_EXTENSION_THEME.color.signal} 0%, color-mix(in oklab, ${TRIBORA_EXTENSION_THEME.color.signal} 68%, ${TRIBORA_EXTENSION_THEME.color.surface2}) 100%);
      color: ${TRIBORA_EXTENSION_THEME.color.signalInk};
      font-family: ${TRIBORA_EXTENSION_THEME.font.display};
      font-size: 20px;
      font-weight: 700;
      box-shadow: 0 0 20px rgba(245,190,77,0.32);
    }
    .trb-mic-title {
      margin: 18px 0 10px;
      font-size: clamp(1.8rem, 2.4vw, 2.15rem);
      line-height: 1.02;
      letter-spacing: -0.02em;
      font-family: ${TRIBORA_EXTENSION_THEME.font.display};
      color: ${TRIBORA_EXTENSION_THEME.color.ink};
    }
    .trb-mic-title b {
      color: ${TRIBORA_EXTENSION_THEME.color.signal};
      font-weight: 600;
    }
    .trb-mic-copy {
      margin: 0 0 10px;
      color: ${TRIBORA_EXTENSION_THEME.color.inkMuted};
      line-height: 1.6;
      font-size: 14px;
    }
    .trb-mic-copy-secondary {
      margin: 0 0 24px;
      color: ${TRIBORA_EXTENSION_THEME.color.inkDim};
      line-height: 1.6;
      font-size: 13px;
    }
    .trb-mic-actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }
    .trb-btn {
      appearance: none;
      border-radius: 10px;
      padding: 12px 16px;
      font-size: 14px;
      font-weight: 600;
      letter-spacing: -0.01em;
      cursor: pointer;
      transition: transform 150ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 150ms cubic-bezier(0.16, 1, 0.3, 1), background 150ms cubic-bezier(0.16, 1, 0.3, 1);
    }
    .trb-btn:active:not(:disabled) {
      transform: translateY(1px);
    }
    .trb-btn:disabled {
      cursor: wait;
      opacity: 0.72;
    }
    .trb-btn-primary {
      border: 1px solid ${TRIBORA_EXTENSION_THEME.color.signalEdge};
      background: ${TRIBORA_EXTENSION_THEME.color.signal};
      color: ${TRIBORA_EXTENSION_THEME.color.signalInk};
      display: none;
    }
    .trb-btn-primary:hover:not(:disabled) {
      box-shadow: 0 0 0 5px ${TRIBORA_EXTENSION_THEME.color.signalSoft};
    }
    .trb-btn-secondary {
      border: 1px solid ${TRIBORA_EXTENSION_THEME.color.lineStrong};
      background: ${TRIBORA_EXTENSION_THEME.color.surface2};
      color: ${TRIBORA_EXTENSION_THEME.color.ink};
    }
    .trb-btn-secondary:hover:not(:disabled) {
      background: ${TRIBORA_EXTENSION_THEME.color.surface3};
    }
    #status {
      min-height: 24px;
      margin: 16px 0 0;
      color: ${TRIBORA_EXTENSION_THEME.color.inkDim};
      line-height: 1.5;
      font-family: ${TRIBORA_EXTENSION_THEME.font.mono};
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    @media (prefers-reduced-motion: reduce) {
      .trb-btn {
        transition-duration: 0ms !important;
      }
    }
  </style>
  <section class="trb-mic-card">
    <p class="trb-mic-kicker">§PERMISSION · MICROPHONE</p>
    <div class="trb-mic-mark">
      T
    </div>
    <h1 class="trb-mic-title">Allow microphone access<b>.</b></h1>
    <p class="trb-mic-copy">
      Tribora needs microphone access to start a live voice session. Chrome is more reliable when this permission is granted from a visible extension page.
    </p>
    <p class="trb-mic-copy-secondary">
      After access is granted, this page will close and Tribora will resume on your original tab.
    </p>
    <div class="trb-mic-actions">
      <button id="primary-action" class="trb-btn trb-btn-primary">
        Try again
      </button>
      <button id="close-page" class="trb-btn trb-btn-secondary">
        Close
      </button>
    </div>
    <p id="status"></p>
  </section>
`;

const primaryActionButton = document.getElementById('primary-action');
const closeButton = document.getElementById('close-page');
const status = document.getElementById('status');

if (!(primaryActionButton instanceof HTMLButtonElement)) {
  throw new Error('Primary action button not found');
}
if (!(closeButton instanceof HTMLButtonElement)) {
  throw new Error('Close page button not found');
}
if (!(status instanceof HTMLParagraphElement)) {
  throw new Error('Status element not found');
}

let currentViewState: MicPermissionViewState = 'initial';

function setStatus(
  message: string,
  tone: MicPermissionStatusTone = 'normal',
): void {
  status.textContent = message;

  if (tone === 'error') {
    status.style.color = TRIBORA_EXTENSION_THEME.color.danger;
    return;
  }

  if (tone === 'success') {
    status.style.color = TRIBORA_EXTENSION_THEME.color.live;
    return;
  }

  status.style.color = TRIBORA_EXTENSION_THEME.color.inkDim;
}

function setBusy(isBusy: boolean): void {
  primaryActionButton.disabled = isBusy;
  closeButton.disabled = isBusy;
  primaryActionButton.style.opacity = isBusy ? '0.7' : '1';
  closeButton.style.opacity = isBusy ? '0.7' : '1';
  primaryActionButton.style.cursor = isBusy ? 'wait' : 'pointer';
  closeButton.style.cursor = isBusy ? 'wait' : 'pointer';
}

function renderView(errorMessage?: string): void {
  const viewModel = deriveMicPermissionViewModel({
    state: currentViewState,
    errorMessage,
  });

  primaryActionButton.style.display = viewModel.primaryActionVisible
    ? 'inline-flex'
    : 'none';
  primaryActionButton.textContent = viewModel.primaryActionLabel ?? '';
  setStatus(viewModel.statusMessage, viewModel.statusTone);

  if (currentViewState === 'requesting' || currentViewState === 'success') {
    setBusy(true);
    return;
  }

  setBusy(false);
}

async function notifyBackground(ok: boolean, error?: string): Promise<void> {
  try {
    await chrome.runtime.sendMessage({
      type: 'MIC_PERMISSION_RESULT',
      ok,
      resumeTabId: Number.isFinite(resumeTabId) ? resumeTabId : undefined,
      error,
    });
  } catch (err) {
    console.warn(`${LOG} Failed to notify background:`, (err as Error).message);
  }
}

async function requestMicPermission(): Promise<void> {
  currentViewState = 'requesting';
  renderView();

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());

    await chrome.storage.local.set({ [MIC_PERMISSION_GRANTED_KEY]: true });
    currentViewState = 'success';
    renderView();
    await notifyBackground(true);
    window.close();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await chrome.storage.local
      .set({ [MIC_PERMISSION_GRANTED_KEY]: false })
      .catch(() => undefined);

    console.error(`${LOG} Microphone request failed:`, message);
    currentViewState = 'error';
    renderView(message);
    await notifyBackground(false, message);
  }
}

primaryActionButton.addEventListener('click', () => {
  void requestMicPermission();
});

closeButton.addEventListener('click', () => {
  window.close();
});

renderView();

if (deriveMicPermissionViewModel({ state: 'initial' }).autoRequestOnOpen) {
  window.setTimeout(() => {
    void requestMicPermission();
  }, 0);
}
