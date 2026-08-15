const sammiEnabled = document.querySelector<HTMLInputElement>('#sammi-enabled')!;
const sammiPort = document.querySelector<HTMLInputElement>('#sammi-port')!;
const sammiPassword = document.querySelector<HTMLInputElement>('#sammi-password')!;
const sammiWebhookTrigger = document.querySelector<HTMLInputElement>('#sammi-webhook-trigger')!;
const sammiMessageTemplate = document.querySelector<HTMLInputElement>('#sammi-message-template')!;
const sammiPlaceholderButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-sammi-placeholder]')];
const testSammiButton = document.querySelector<HTMLButtonElement>('#test-sammi')!;
const status = document.querySelector<HTMLElement>('#save-status')!;
const { t } = window.i18n;

let statusKey = 'settings.loading';
let statusDetail = '';

function setStatus(key: string, detail = '') {
  statusKey = key;
  statusDetail = detail;
  status.textContent = `${t(key)}${detail ? ` ${detail}` : ''}`;
}

async function saveSettings(payload: Partial<OverlaySettings>): Promise<OverlaySettings> {
  const response = await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json() as Promise<OverlaySettings>;
}

const sammiFields = [sammiEnabled, sammiPort, sammiPassword, sammiWebhookTrigger, sammiMessageTemplate];

function setSammiControlsDisabled(disabled: boolean) {
  sammiFields.forEach((field) => { field.disabled = disabled; });
  sammiPlaceholderButtons.forEach((button) => { button.disabled = disabled; });
  testSammiButton.disabled = disabled;
}

function sammiSettingsPayload(): Pick<OverlaySettings, 'sammiEnabled' | 'sammiPort' | 'sammiPassword' | 'sammiWebhookTrigger' | 'sammiMessageTemplate'> {
  return {
    sammiEnabled: sammiEnabled.checked,
    sammiPort: Number.parseInt(sammiPort.value, 10),
    sammiPassword: sammiPassword.value,
    sammiWebhookTrigger: sammiWebhookTrigger.value.trim(),
    sammiMessageTemplate: sammiMessageTemplate.value.trim(),
  };
}

function applySammiSettings(settings: OverlaySettings) {
  sammiEnabled.checked = settings.sammiEnabled === true;
  sammiPort.value = String(settings.sammiPort || 9450);
  sammiPassword.value = settings.sammiPassword || '';
  sammiWebhookTrigger.value = settings.sammiWebhookTrigger || 'what_i_listen_track_changed';
  sammiMessageTemplate.value = settings.sammiMessageTemplate || '🎵 En écoute : {artist} — {title}';
}

async function saveSammiSettings(): Promise<OverlaySettings> {
  const settings = await saveSettings(sammiSettingsPayload());
  applySammiSettings(settings);
  return settings;
}

async function load() {
  try {
    const response = await fetch('/api/settings', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const settings = await response.json() as OverlaySettings;
    applySammiSettings(settings);
    setStatus('settings.loaded');
  } catch {
    setStatus('settings.loadError');
  }
}

sammiFields.forEach((field) => field.addEventListener('change', async () => {
  setSammiControlsDisabled(true);
  setStatus('settings.saving');
  try {
    await saveSammiSettings();
    setStatus(sammiEnabled.checked ? 'settings.sammi.savedEnabled' : 'settings.sammi.savedDisabled');
  } catch {
    setStatus('settings.sammi.saveError');
  } finally {
    setSammiControlsDisabled(false);
  }
}));

sammiPlaceholderButtons.forEach((button) => {
  button.addEventListener('mousedown', (event) => event.preventDefault());
  button.addEventListener('click', () => {
    const placeholder = button.dataset.sammiPlaceholder;
    if (!placeholder) return;
    const hasActiveCursor = document.activeElement === sammiMessageTemplate;
    const start = hasActiveCursor ? sammiMessageTemplate.selectionStart ?? sammiMessageTemplate.value.length : sammiMessageTemplate.value.length;
    const end = hasActiveCursor ? sammiMessageTemplate.selectionEnd ?? start : start;
    sammiMessageTemplate.setRangeText(placeholder, start, end, 'end');
    sammiMessageTemplate.focus();
    sammiMessageTemplate.dispatchEvent(new Event('change'));
  });
});

testSammiButton.addEventListener('click', async () => {
  setSammiControlsDisabled(true);
  setStatus('settings.sammi.testing');
  try {
    await saveSammiSettings();
    const response = await fetch('/api/sammi/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const result = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
    setStatus('settings.sammi.testSuccess');
  } catch (error) {
    setStatus('settings.sammi.testError', error instanceof Error ? error.message : String(error));
  } finally {
    setSammiControlsDisabled(false);
  }
});

document.addEventListener('app-language-change', () => {
  setStatus(statusKey, statusDetail);
});

load();
