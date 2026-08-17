const applyButton = document.querySelector<HTMLButtonElement>('#apply-style')!;
const emptyState = document.querySelector<HTMLElement>('#styles-empty')!;
const filterButtons = [...document.querySelectorAll<HTMLButtonElement>('.style-filter')];
const inspectorPreview = document.querySelector<HTMLElement>('#inspector-preview')!;
const neonPaletteControl = document.querySelector<HTMLElement>('#neon-palette-control')!;
const neonPaletteOptions = [...document.querySelectorAll<HTMLInputElement>('input[name="neon-palette"]')];
const livePreviewFrame = document.querySelector<HTMLIFrameElement>('#live-preview-frame')!;
const livePreviewViewport = document.querySelector<HTMLElement>('#live-preview-viewport')!;
const searchInput = document.querySelector<HTMLInputElement>('#style-search')!;
const selectedStyleDescription = document.querySelector<HTMLElement>('#selected-style-description')!;
const selectedStyleName = document.querySelector<HTMLElement>('#selected-style-name')!;
const serviceStatus = document.querySelector<HTMLElement>('#service-status')!;
const spectrumPaletteControl = document.querySelector<HTMLElement>('#spectrum-palette-control')!;
const spectrumPaletteOptions = [...document.querySelectorAll<HTMLInputElement>('input[name="spectrum-palette"]')];
const formatOptions = [...document.querySelectorAll<HTMLInputElement>('input[name="overlay-format"]')];
const status = document.querySelector<HTMLElement>('#save-status')!;
const skinOptions = [...document.querySelectorAll<HTMLInputElement>('input[name="skin"]')];
const skinCards = [...document.querySelectorAll<HTMLElement>('.skin-option')];
const customizationInputs = [...document.querySelectorAll<HTMLInputElement>('[data-overlay-setting]')];
const customizationOutputs = [...document.querySelectorAll<HTMLOutputElement>('[data-output-for]')];
const { t } = window.i18n;

type CustomizationKey = 'showCover' | 'showAlbum' | 'showStatus' | 'showLabel' | 'textScale'
  | 'backgroundOpacity' | 'backgroundBlur' | 'accentColor' | 'autoAccent' | 'audioIntensity'
  | 'animationSpeed' | 'fadeInDuration' | 'fadeOutDuration' | 'pauseHideDelay';
type CustomizationSettings = Pick<OverlaySettings, CustomizationKey>;

const customizationDefaults: CustomizationSettings = {
  showCover: true,
  showAlbum: true,
  showStatus: true,
  showLabel: true,
  textScale: 1,
  backgroundOpacity: .92,
  backgroundBlur: 0,
  accentColor: '#8d5cff',
  autoAccent: false,
  audioIntensity: 1,
  animationSpeed: 1,
  fadeInDuration: 550,
  fadeOutDuration: 350,
  pauseHideDelay: 0,
};

let activeFilter = 'all';
let pendingNeonPalette: NeonPalette = 'violet-cyan';
let pendingSkin: OverlaySkin = 'luna';
let pendingSpectrumPalette: SpectrumPalette = 'modern';
let pendingFormat: OverlayFormat = 'horizontal';
let savedNeonPalette: NeonPalette = 'violet-cyan';
let savedSkin: OverlaySkin = 'luna';
let savedSpectrumPalette: SpectrumPalette = 'modern';
let savedFormat: OverlayFormat = 'horizontal';
let savedCustomization: CustomizationSettings = { ...customizationDefaults };
let statusKey = 'settings.loading';

function setStatus(key: string) {
  statusKey = key;
  status.textContent = t(key);
}

function setRadioValue(options: HTMLInputElement[], value: string) {
  options.forEach((option) => { option.checked = option.value === value; });
}

function selectedCard(): HTMLElement | undefined {
  return skinCards.find((card) => card.dataset.skinOption === pendingSkin);
}

function updateInspectorCopy() {
  const card = selectedCard();
  selectedStyleName.textContent = card?.querySelector('strong')?.textContent ?? pendingSkin;
  selectedStyleDescription.textContent = card?.querySelector('small')?.textContent ?? '';
}

function customizationInput(key: CustomizationKey): HTMLInputElement {
  return customizationInputs.find((input) => input.dataset.overlaySetting === key)!;
}

function readCustomization(): CustomizationSettings {
  return {
    showCover: customizationInput('showCover').checked,
    showAlbum: customizationInput('showAlbum').checked,
    showStatus: customizationInput('showStatus').checked,
    showLabel: customizationInput('showLabel').checked,
    textScale: customizationInput('textScale').valueAsNumber,
    backgroundOpacity: customizationInput('backgroundOpacity').valueAsNumber,
    backgroundBlur: customizationInput('backgroundBlur').valueAsNumber,
    accentColor: customizationInput('accentColor').value,
    autoAccent: customizationInput('autoAccent').checked,
    audioIntensity: customizationInput('audioIntensity').valueAsNumber,
    animationSpeed: customizationInput('animationSpeed').valueAsNumber,
    fadeInDuration: customizationInput('fadeInDuration').valueAsNumber,
    fadeOutDuration: customizationInput('fadeOutDuration').valueAsNumber,
    pauseHideDelay: customizationInput('pauseHideDelay').valueAsNumber,
  };
}

function formatCustomizationValue(key: string, value: number): string {
  if (key === 'textScale' || key === 'audioIntensity' || key === 'animationSpeed') return `${value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}×`;
  if (key === 'backgroundOpacity') return `${Math.round(value * 100)} %`;
  if (key === 'backgroundBlur') return `${Math.round(value)} px`;
  if (key === 'pauseHideDelay') return value === 0 ? t('styles.never') : `${Math.round(value)} s`;
  return `${Math.round(value)} ms`;
}

function refreshCustomizationUi() {
  customizationOutputs.forEach((output) => {
    const key = output.dataset.outputFor as CustomizationKey;
    output.value = formatCustomizationValue(key, customizationInput(key).valueAsNumber);
  });
  customizationInput('accentColor').disabled = customizationInput('autoAccent').checked;
}

function applyCustomization(settings: Partial<CustomizationSettings>) {
  const customization = { ...customizationDefaults, ...settings };
  (['showCover', 'showAlbum', 'showStatus', 'showLabel', 'autoAccent'] as const).forEach((key) => {
    customizationInput(key).checked = customization[key];
  });
  (['textScale', 'backgroundOpacity', 'backgroundBlur', 'accentColor', 'audioIntensity', 'animationSpeed', 'fadeInDuration', 'fadeOutDuration', 'pauseHideDelay'] as const).forEach((key) => {
    customizationInput(key).value = String(customization[key]);
  });
  refreshCustomizationUi();
}

function previewSelection() {
  livePreviewFrame.contentWindow?.postMessage({
    type: 'what-i-listen:preview-style',
    skin: pendingSkin,
    neonPalette: pendingNeonPalette,
    spectrumPalette: pendingSpectrumPalette,
    format: pendingFormat,
    ...readCustomization(),
  }, window.location.origin);
}

function clearPreviewSelection() {
  livePreviewFrame.contentWindow?.postMessage({
    type: 'what-i-listen:preview-style',
    skin: null,
  }, window.location.origin);
}

function selectSkin(skin: OverlaySkin) {
  pendingSkin = skin;
  skinOptions.forEach((option) => {
    const selected = option.value === skin;
    option.checked = selected;
    option.closest('.skin-option')?.classList.toggle('selected', selected);
  });
  inspectorPreview.className = `skin-preview ${skin}-preview`;
  neonPaletteControl.hidden = skin !== 'neon';
  spectrumPaletteControl.hidden = skin !== 'spectrum';
  updateInspectorCopy();
  previewSelection();
}

function setControlsDisabled(disabled: boolean) {
  applyButton.disabled = disabled;
  skinOptions.forEach((option) => { option.disabled = disabled; });
  neonPaletteOptions.forEach((option) => { option.disabled = disabled; });
  spectrumPaletteOptions.forEach((option) => { option.disabled = disabled; });
  formatOptions.forEach((option) => { option.disabled = disabled; });
  customizationInputs.forEach((input) => { input.disabled = disabled || (input.dataset.overlaySetting === 'accentColor' && customizationInput('autoAccent').checked); });
}

function resizeLivePreview() {
  const { width, height } = overlayDimensions(pendingFormat);
  const scale = Math.min(1, livePreviewViewport.clientWidth / width);
  livePreviewFrame.style.width = `${width}px`;
  livePreviewFrame.style.height = `${height}px`;
  livePreviewFrame.style.transform = `scale(${scale})`;
  livePreviewViewport.style.height = `${Math.ceil(height * scale)}px`;
}

function overlayDimensions(format: OverlayFormat): { width: number; height: number } {
  if (format === 'compact') return { width: 360, height: 92 };
  if (format === 'square') return { width: 320, height: 320 };
  if (format === 'ticker') return { width: 760, height: 64 };
  return { width: 520, height: 130 };
}

function filterStyles() {
  const query = searchInput.value.trim().toLocaleLowerCase(window.i18n.language);
  let visibleCount = 0;
  skinCards.forEach((card) => {
    const categories = card.dataset.category?.split(' ') ?? [];
    const categoryMatches = activeFilter === 'all' || categories.includes(activeFilter);
    const searchText = card.textContent?.toLocaleLowerCase(window.i18n.language) ?? '';
    const searchMatches = !query || searchText.includes(query);
    card.hidden = !(categoryMatches && searchMatches);
    if (!card.hidden) visibleCount += 1;
  });
  emptyState.hidden = visibleCount > 0;
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

async function applySelection(): Promise<boolean> {
  setControlsDisabled(true);
  setStatus('settings.saving');
  try {
    const settings = await saveSettings({
      skin: pendingSkin,
      neonPalette: pendingNeonPalette,
      spectrumPalette: pendingSpectrumPalette,
      format: pendingFormat,
      ...readCustomization(),
    });
    savedSkin = settings.skin;
    savedNeonPalette = settings.neonPalette;
    savedSpectrumPalette = settings.spectrumPalette;
    savedFormat = settings.format;
    savedCustomization = Object.fromEntries((Object.keys(customizationDefaults) as CustomizationKey[]).map((key) => [key, settings[key]])) as CustomizationSettings;
    pendingNeonPalette = savedNeonPalette;
    pendingSpectrumPalette = savedSpectrumPalette;
    pendingFormat = savedFormat;
    setRadioValue(neonPaletteOptions, pendingNeonPalette);
    setRadioValue(spectrumPaletteOptions, pendingSpectrumPalette);
    setRadioValue(formatOptions, pendingFormat);
    applyCustomization(savedCustomization);
    clearPreviewSelection();
    setStatus('settings.skinSaved');
    return true;
  } catch {
    pendingNeonPalette = savedNeonPalette;
    pendingSpectrumPalette = savedSpectrumPalette;
    pendingFormat = savedFormat;
    setRadioValue(neonPaletteOptions, pendingNeonPalette);
    setRadioValue(spectrumPaletteOptions, pendingSpectrumPalette);
    setRadioValue(formatOptions, pendingFormat);
    applyCustomization(savedCustomization);
    resizeLivePreview();
    selectSkin(savedSkin);
    setStatus('settings.saveError');
    return false;
  } finally {
    setControlsDisabled(false);
  }
}

async function load() {
  try {
    const response = await fetch('/api/settings', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const settings = await response.json() as OverlaySettings;
    window.i18n.setLanguage(settings.language || window.i18n.language);
    savedSkin = settings.skin || 'luna';
    savedNeonPalette = settings.neonPalette || 'violet-cyan';
    savedSpectrumPalette = settings.spectrumPalette || 'modern';
    savedFormat = settings.format || 'horizontal';
    savedCustomization = { ...customizationDefaults, ...Object.fromEntries((Object.keys(customizationDefaults) as CustomizationKey[]).map((key) => [key, settings[key]])) };
    pendingNeonPalette = savedNeonPalette;
    pendingSpectrumPalette = savedSpectrumPalette;
    pendingFormat = savedFormat;
    setRadioValue(neonPaletteOptions, pendingNeonPalette);
    setRadioValue(spectrumPaletteOptions, pendingSpectrumPalette);
    setRadioValue(formatOptions, pendingFormat);
    applyCustomization(savedCustomization);
    resizeLivePreview();
    selectSkin(savedSkin);
    serviceStatus.classList.remove('offline');
    setStatus('styles.loaded');
  } catch {
    serviceStatus.classList.add('offline');
    const serviceStatusText = serviceStatus.querySelector<HTMLElement>('span')!;
    serviceStatusText.dataset.i18n = 'styles.offline';
    serviceStatusText.textContent = t('styles.offline');
    setStatus('settings.loadError');
  }
}

skinOptions.forEach((option) => option.addEventListener('change', () => {
  if (!option.checked) return;
  selectSkin(option.value as OverlaySkin);
  setStatus('styles.readyToApply');
}));

neonPaletteOptions.forEach((option) => option.addEventListener('change', () => {
  if (!option.checked) return;
  pendingNeonPalette = option.value as NeonPalette;
  previewSelection();
  setStatus('styles.readyToApply');
}));

spectrumPaletteOptions.forEach((option) => option.addEventListener('change', () => {
  if (!option.checked) return;
  pendingSpectrumPalette = option.value as SpectrumPalette;
  previewSelection();
  setStatus('styles.readyToApply');
}));

formatOptions.forEach((option) => option.addEventListener('change', () => {
  if (!option.checked) return;
  pendingFormat = option.value as OverlayFormat;
  resizeLivePreview();
  previewSelection();
  setStatus('styles.readyToApply');
}));

customizationInputs.forEach((input) => input.addEventListener('input', () => {
  refreshCustomizationUi();
  previewSelection();
  setStatus('styles.readyToApply');
}));

filterButtons.forEach((button) => button.addEventListener('click', () => {
  activeFilter = button.dataset.filter ?? 'all';
  filterButtons.forEach((candidate) => {
    const active = candidate === button;
    candidate.classList.toggle('active', active);
    candidate.setAttribute('aria-pressed', String(active));
  });
  filterStyles();
}));

searchInput.addEventListener('input', filterStyles);
applyButton.addEventListener('click', () => { void applySelection(); });
livePreviewFrame.addEventListener('load', previewSelection);

document.addEventListener('app-language-change', () => {
  updateInspectorCopy();
  filterStyles();
  refreshCustomizationUi();
  setStatus(statusKey);
});

new ResizeObserver(resizeLivePreview).observe(livePreviewViewport);
resizeLivePreview();
load();
