const neonPalette = document.querySelector<HTMLSelectElement>('#neon-palette')!;
const neonPaletteControl = document.querySelector<HTMLElement>('#neon-palette-control')!;
const spectrumPalette = document.querySelector<HTMLSelectElement>('#spectrum-palette')!;
const spectrumPaletteControl = document.querySelector<HTMLElement>('#spectrum-palette-control')!;
const previewButton = document.querySelector<HTMLButtonElement>('#open-preview')!;
const status = document.querySelector<HTMLElement>('#save-status')!;
const skinOptions = [...document.querySelectorAll<HTMLInputElement>('input[name="skin"]')];
const { t } = window.i18n;

let statusKey = 'settings.loading';
let savedNeonPalette: NeonPalette = 'violet-cyan';
let savedSpectrumPalette: SpectrumPalette = 'modern';

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
  spectrumPaletteControl.hidden = skin !== 'spectrum';
  spectrumPalette.disabled = skin !== 'spectrum';
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
    window.i18n.setLanguage(settings.language || window.i18n.language);
    savedNeonPalette = settings.neonPalette || 'violet-cyan';
    neonPalette.value = savedNeonPalette;
    savedSpectrumPalette = settings.spectrumPalette || 'modern';
    spectrumPalette.value = savedSpectrumPalette;
    selectSkin(settings.skin || 'luna');
    setStatus('styles.loaded');
  } catch {
    setStatus('settings.loadError');
  }
}

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

spectrumPalette.addEventListener('change', async () => {
  const selectedPalette = spectrumPalette.value as SpectrumPalette;
  spectrumPalette.disabled = true;
  setStatus('settings.saving');
  try {
    await saveSettings({ spectrumPalette: selectedPalette });
    savedSpectrumPalette = selectedPalette;
    setStatus('settings.spectrumPaletteSaved');
  } catch {
    spectrumPalette.value = savedSpectrumPalette;
    setStatus('settings.saveError');
  } finally {
    spectrumPalette.disabled = false;
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

document.addEventListener('app-language-change', () => setStatus(statusKey));

load();
