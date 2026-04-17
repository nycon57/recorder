import {
  deriveMicPermissionViewModel,
  type MicPermissionStatusTone,
  type MicPermissionViewState,
} from '../../utils/mic-permission-view.js';

const LOG = '[Tribora mic]';
const MIC_PERMISSION_GRANTED_KEY = 'micPermissionGranted';

const app = document.getElementById('app');
if (!app) {
  throw new Error('Mic permission root element not found');
}

const params = new URLSearchParams(window.location.search);
const resumeTabId = Number(params.get('resumeTabId') ?? '');

document.documentElement.style.background = '#08140f';
document.body.style.margin = '0';
document.body.style.minHeight = '100vh';
document.body.style.background =
  'radial-gradient(circle at top, rgba(0, 223, 130, 0.18), transparent 38%), linear-gradient(180deg, #08140f 0%, #040807 100%)';
document.body.style.color = '#f6fff9';
document.body.style.fontFamily =
  'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
document.body.style.display = 'flex';
document.body.style.alignItems = 'center';
document.body.style.justifyContent = 'center';
document.body.style.padding = '24px';

app.innerHTML = `
  <section style="width:min(100%, 520px); border:1px solid rgba(255,255,255,0.1); border-radius:24px; padding:32px; background:rgba(7,18,13,0.88); box-shadow:0 24px 80px rgba(0,0,0,0.45);">
    <div style="display:inline-flex; align-items:center; justify-content:center; width:52px; height:52px; border-radius:16px; background:linear-gradient(135deg, #03624c 0%, #2cc295 50%, #00df82 100%); color:#ffffff; font-weight:700; font-size:20px; box-shadow:0 0 24px rgba(0,223,130,0.35);">
      T
    </div>
    <h1 style="margin:20px 0 12px; font-size:28px; line-height:1.1;">Allow microphone access</h1>
    <p style="margin:0 0 12px; color:rgba(246,255,249,0.8); line-height:1.6;">
      Tribora needs microphone access to start a live voice session. Chrome is more reliable when this permission is granted from a visible extension page.
    </p>
    <p style="margin:0 0 24px; color:rgba(246,255,249,0.58); line-height:1.6;">
      After access is granted, this page will close and Tribora will resume on your original tab.
    </p>
    <div style="display:flex; gap:12px; flex-wrap:wrap;">
      <button id="primary-action" style="appearance:none; border:none; border-radius:999px; padding:14px 18px; background:#00df82; color:#032116; font-size:15px; font-weight:700; cursor:pointer; display:none;">
        Try again
      </button>
      <button id="close-page" style="appearance:none; border:1px solid rgba(255,255,255,0.14); border-radius:999px; padding:14px 18px; background:transparent; color:#f6fff9; font-size:15px; font-weight:600; cursor:pointer;">
        Close
      </button>
    </div>
    <p id="status" style="min-height:24px; margin:18px 0 0; color:rgba(246,255,249,0.72); line-height:1.5;"></p>
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
    status.style.color = '#ffb9b9';
    return;
  }

  if (tone === 'success') {
    status.style.color = '#7ff0b6';
    return;
  }

  status.style.color = 'rgba(246,255,249,0.72)';
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
