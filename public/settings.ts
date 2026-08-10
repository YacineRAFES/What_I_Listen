const startHidden = document.querySelector<HTMLInputElement>('#start-hidden')!;
const titleMarquee = document.querySelector<HTMLInputElement>('#title-marquee')!;
const language = document.querySelector<HTMLSelectElement>('#language')!;
const neonPalette = document.querySelector<HTMLSelectElement>('#neon-palette')!;
const neonPaletteControl = document.querySelector<HTMLElement>('#neon-palette-control')!;
const previewButton = document.querySelector<HTMLButtonElement>('#open-preview')!;
const status = document.querySelector<HTMLElement>('#save-status')!;
const skinOptions = [...document.querySelectorAll<HTMLInputElement>('input[name="skin"]')];
const { t } = window.i18n;

let statusKey = 'settings.loading';
let savedNeonPalette: NeonPalette = 'violet-cyan';

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
  neonPaletteControl.hidden = skin !== 'neon';
  neonPalette.disabled = skin !== 'neon';
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
    savedNeonPalette = settings.neonPalette || 'violet-cyan';
    neonPalette.value = savedNeonPalette;
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

neonPalette.addEventListener('change', async () => {
  const selectedPalette = neonPalette.value as NeonPalette;
  neonPalette.disabled = true;
  setStatus('settings.saving');
  try {
    await saveSettings({ neonPalette: selectedPalette });
    savedNeonPalette = selectedPalette;
    setStatus('settings.neonPaletteSaved');
  } catch {
    neonPalette.value = savedNeonPalette;
    setStatus('settings.saveError');
  } finally {
    neonPalette.disabled = false;
  }
});

previewButton.addEventListener('click', async () => {
  if (!window.whatIListen?.openPreview) {
    setStatus('settings.preview.unavailable');
    return;
  }

  previewButton.disabled = true;
  try {
    await window.whatIListen.openPreview();
    setStatus('settings.preview.opened');
  } catch {
    setStatus('settings.preview.error');
  } finally {
    previewButton.disabled = false;
  }
});

document.addEventListener('app-language-change', () => {
  language.value = window.i18n.language;
  setStatus(statusKey);
});

load();
