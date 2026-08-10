const startHidden = document.querySelector<HTMLInputElement>('#start-hidden')!;
const titleMarquee = document.querySelector<HTMLInputElement>('#title-marquee')!;
const language = document.querySelector<HTMLSelectElement>('#language')!;
const status = document.querySelector<HTMLElement>('#save-status')!;
const skinOptions = [...document.querySelectorAll<HTMLInputElement>('input[name="skin"]')];
const { t } = window.i18n;

let statusKey = 'settings.loading';

function setStatus(key: string) {
  statusKey = key;
  status.textContent = t(key);
}

function selectSkin(skin: string) {
  skinOptions.forEach((option) => {
    const selected = option.value === skin;
    option.checked = selected;
    option.closest('.skin-option')?.classList.toggle('selected', selected);
  });
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

async function load() {
  try {
    const response = await fetch('/api/settings', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const settings = await response.json() as OverlaySettings;
    startHidden.checked = settings.startHidden;
    titleMarquee.checked = settings.titleMarquee !== false;
    selectSkin(settings.skin || 'luna');
    language.value = settings.language || window.i18n.language;
    setStatus('settings.loaded');
  } catch {
    language.value = window.i18n.language;
    setStatus('settings.loadError');
  }
}

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

skinOptions.forEach((option) => option.addEventListener('change', async () => {
  if (!option.checked) return;
  const previousSkin = skinOptions.find((item) => item.closest('.skin-option')?.classList.contains('selected'))?.value;
  selectSkin(option.value);
  skinOptions.forEach((item) => { item.disabled = true; });
  setStatus('settings.saving');
  try {
    await saveSettings({ skin: option.value as OverlaySkin });
    setStatus('settings.skinSaved');
  } catch {
    selectSkin(previousSkin || 'luna');
    setStatus('settings.saveError');
  } finally {
    skinOptions.forEach((item) => { item.disabled = false; });
  }
}));

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

document.addEventListener('app-language-change', () => {
  language.value = window.i18n.language;
  setStatus(statusKey);
});

load();
