const startHidden = document.querySelector<HTMLInputElement>('#start-hidden')!;
const titleMarquee = document.querySelector<HTMLInputElement>('#title-marquee')!;
const language = document.querySelector<HTMLSelectElement>('#language')!;
const audioOutputDevice = document.querySelector<HTMLSelectElement>('#audio-output-device')!;
const refreshAudioOutputsButton = document.querySelector<HTMLButtonElement>('#refresh-audio-outputs')!;
const openChangelogButton = document.querySelector<HTMLButtonElement>('#open-changelog')!;
const appThemeOptions = [...document.querySelectorAll<HTMLInputElement>('input[name="app-theme"]')];
const status = document.querySelector<HTMLElement>('#save-status')!;
const { t } = window.i18n;

let statusKey = 'settings.loading';
let savedAudioOutputDeviceId = '';
let audioOutputs: AudioOutputDevice[] = [];
let savedAppTheme: AppTheme = 'dark';

function setStatus(key: string) {
  statusKey = key;
  status.textContent = t(key);
}

function applyAppTheme(theme: AppTheme) {
  document.documentElement.dataset.appTheme = theme;
  localStorage.setItem('app-theme', theme);
  appThemeOptions.forEach((option) => { option.checked = option.value === theme; });
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

function renderAudioOutputOptions() {
  const selectedId = savedAudioOutputDeviceId;
  const knownSelectedDevice = audioOutputs.some((device) => device.id === selectedId);
  const options = [new Option(t('settings.audio.systemMix'), '')];

  if (selectedId && !knownSelectedDevice) {
    options.push(new Option(t('settings.audio.savedDevice'), selectedId));
  }
  audioOutputs.forEach((device) => {
    const name = device.isDefault ? `${device.name} — ${t('settings.audio.defaultDevice')}` : device.name;
    options.push(new Option(name, device.id));
  });

  audioOutputDevice.replaceChildren(...options);
  audioOutputDevice.value = selectedId;
}

async function refreshAudioOutputs() {
  if (!window.whatIListen?.listAudioOutputs) throw new Error('Audio output devices unavailable');
  audioOutputs = await window.whatIListen.listAudioOutputs();
  renderAudioOutputOptions();
}

async function load() {
  try {
    const response = await fetch('/api/settings', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const settings = await response.json() as OverlaySettings;
    savedAppTheme = settings.appTheme || 'dark';
    applyAppTheme(savedAppTheme);
    startHidden.checked = settings.startHidden;
    titleMarquee.checked = settings.titleMarquee !== false;
    savedAudioOutputDeviceId = settings.audioOutputDeviceId || '';
    renderAudioOutputOptions();
    try {
      await refreshAudioOutputs();
    } catch {
      // Les réglages restent utilisables ; le bouton permet une nouvelle tentative.
    }
    language.value = settings.language || window.i18n.language;
    setStatus('settings.loaded');
  } catch {
    language.value = window.i18n.language;
    setStatus('settings.loadError');
  }
}

appThemeOptions.forEach((option) => option.addEventListener('change', async () => {
  if (!option.checked) return;
  const selectedTheme = option.value as AppTheme;
  appThemeOptions.forEach((candidate) => { candidate.disabled = true; });
  applyAppTheme(selectedTheme);
  setStatus('settings.saving');
  try {
    const settings = await saveSettings({ appTheme: selectedTheme });
    savedAppTheme = settings.appTheme;
    applyAppTheme(savedAppTheme);
    setStatus(selectedTheme === 'light' ? 'settings.themeLightSaved' : 'settings.themeDarkSaved');
  } catch {
    applyAppTheme(savedAppTheme);
    setStatus('settings.saveError');
  } finally {
    appThemeOptions.forEach((candidate) => { candidate.disabled = false; });
  }
}));

startHidden.addEventListener('change', async () => {
  const value = startHidden.checked;
  startHidden.disabled = true;
  setStatus('settings.saving');
  try {
    await saveSettings({ startHidden: value });
    setStatus(value ? 'settings.startHiddenOn' : 'settings.startHiddenOff');
  } catch {
    startHidden.checked = !value;
    setStatus('settings.saveError');
  } finally {
    startHidden.disabled = false;
  }
});

titleMarquee.addEventListener('change', async () => {
  const value = titleMarquee.checked;
  titleMarquee.disabled = true;
  setStatus('settings.saving');
  try {
    await saveSettings({ titleMarquee: value });
    setStatus(value ? 'settings.titleMarqueeOn' : 'settings.titleMarqueeOff');
  } catch {
    titleMarquee.checked = !value;
    setStatus('settings.saveError');
  } finally {
    titleMarquee.disabled = false;
  }
});

refreshAudioOutputsButton.addEventListener('click', async () => {
  refreshAudioOutputsButton.disabled = true;
  audioOutputDevice.disabled = true;
  setStatus('settings.audio.searching');
  try {
    await refreshAudioOutputs();
    setStatus('settings.audio.found');
  } catch {
    setStatus('settings.audio.listError');
  } finally {
    refreshAudioOutputsButton.disabled = false;
    audioOutputDevice.disabled = false;
  }
});

audioOutputDevice.addEventListener('change', async () => {
  const previousDeviceId = savedAudioOutputDeviceId;
  const selectedDeviceId = audioOutputDevice.value;
  audioOutputDevice.disabled = true;
  refreshAudioOutputsButton.disabled = true;
  setStatus('settings.saving');
  try {
    const settings = await saveSettings({ audioOutputDeviceId: selectedDeviceId });
    savedAudioOutputDeviceId = settings.audioOutputDeviceId;
    renderAudioOutputOptions();
    setStatus(selectedDeviceId ? 'settings.audio.deviceSaved' : 'settings.audio.systemMixSaved');
  } catch {
    savedAudioOutputDeviceId = previousDeviceId;
    renderAudioOutputOptions();
    setStatus('settings.saveError');
  } finally {
    audioOutputDevice.disabled = false;
    refreshAudioOutputsButton.disabled = false;
  }
});

language.addEventListener('change', async () => {
  const selectedLanguage = language.value as OverlaySettings['language'];
  language.disabled = true;
  setStatus('settings.saving');
  try {
    const settings = await saveSettings({ language: selectedLanguage });
    window.i18n.setLanguage(settings.language);
    setStatus('settings.languageSaved');
  } catch {
    language.value = window.i18n.language;
    setStatus('settings.saveError');
  } finally {
    language.disabled = false;
  }
});

openChangelogButton.addEventListener('click', async () => {
  openChangelogButton.disabled = true;
  try {
    if (!window.whatIListen?.openChangelog) throw new Error('Changelog unavailable');
    await window.whatIListen.openChangelog();
    setStatus('settings.changelog.opened');
  } catch {
    setStatus('settings.changelog.error');
  } finally {
    openChangelogButton.disabled = false;
  }
});

document.addEventListener('app-language-change', () => {
  language.value = window.i18n.language;
  renderAudioOutputOptions();
  setStatus(statusKey);
});

load();
