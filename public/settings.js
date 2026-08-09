const startHidden = document.querySelector('#start-hidden');
const titleMarquee = document.querySelector('#title-marquee');
const language = document.querySelector('#language');
const status = document.querySelector('#save-status');
const { t } = window.i18n;

let statusKey = 'settings.loading';

function setStatus(key) {
  statusKey = key;
  status.textContent = t(key);
}

async function saveSettings(payload) {
  const response = await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function load() {
  try {
    const response = await fetch('/api/settings', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const settings = await response.json();
    startHidden.checked = settings.startHidden;
    titleMarquee.checked = settings.titleMarquee !== false;
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

language.addEventListener('change', async () => {
  const selectedLanguage = language.value;
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
