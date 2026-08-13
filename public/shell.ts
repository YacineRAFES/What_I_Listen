const versionLabels = [...document.querySelectorAll<HTMLElement>('[data-app-version]')];

function isAppTheme(value: unknown): value is AppTheme {
  return value === 'dark' || value === 'light';
}

function applyAppTheme(theme: AppTheme) {
  document.documentElement.dataset.appTheme = theme;
  localStorage.setItem('app-theme', theme);
}

const cachedTheme = localStorage.getItem('app-theme');
if (isAppTheme(cachedTheme)) applyAppTheme(cachedTheme);

async function renderAppVersion() {
  if (!versionLabels.length) return;
  try {
    const version = await window.whatIListen?.getAppVersion();
    const label = version ? `v${version}` : '—';
    versionLabels.forEach((element) => { element.textContent = label; });
  } catch {
    versionLabels.forEach((element) => { element.textContent = '—'; });
  }
}

async function renderAppTheme() {
  try {
    const response = await fetch('/api/settings', { cache: 'no-store' });
    if (!response.ok) return;
    const settings = await response.json() as OverlaySettings;
    applyAppTheme(settings.appTheme || 'dark');
  } catch {
    // The cached theme or the dark default remains active while offline.
  }
}

void renderAppVersion();
void renderAppTheme();
