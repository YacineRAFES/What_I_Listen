const versionPicker = document.querySelector<HTMLSelectElement>('#version-picker')!;
const refreshButton = document.querySelector<HTMLButtonElement>('#refresh-releases')!;
const currentVersion = document.querySelector<HTMLElement>('#current-version')!;
const status = document.querySelector<HTMLElement>('#status')!;
const releaseCard = document.querySelector<HTMLElement>('#release-card')!;
const emptyState = document.querySelector<HTMLElement>('#empty-state')!;
const releaseVersion = document.querySelector<HTMLElement>('#release-version')!;
const releaseTitle = document.querySelector<HTMLElement>('#release-title')!;
const releaseDate = document.querySelector<HTMLTimeElement>('#release-date')!;
const currentBadge = document.querySelector<HTMLElement>('#current-badge')!;
const releaseNotes = document.querySelector<HTMLElement>('#release-notes')!;
const installButton = document.querySelector<HTMLButtonElement>('#install-release')!;
const installHint = document.querySelector<HTMLElement>('#install-hint')!;
const { t } = window.i18n;

let releases: AppRelease[] = [];
let installedVersion = '';

function setStatus(key: string, isError = false) {
  status.textContent = t(key);
  status.classList.toggle('error', isError);
}

function formatDate(value: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(window.i18n.language, { dateStyle: 'long' }).format(date);
}

function appendInlineText(parent: HTMLElement, value: string) {
  const plainMarkdown = value
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1');
  const parts = plainMarkdown.split(/(`[^`]+`)/g);
  parts.forEach((part) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      const code = document.createElement('code');
      code.textContent = part.slice(1, -1);
      parent.append(code);
    } else {
      parent.append(document.createTextNode(part));
    }
  });
}

function compareVersions(left: string, right: string): number {
  const leftParts = left.split(/[.-]/).map((part) => Number.parseInt(part, 10));
  const rightParts = right.split(/[.-]/).map((part) => Number.parseInt(part, 10));
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const difference = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (difference) return difference;
  }
  return 0;
}

function renderNotes(notes: string) {
  releaseNotes.replaceChildren();
  const lines = notes.replace(/\r/g, '').split('\n');
  let list: HTMLUListElement | null = null;
  const finishList = () => {
    if (list) releaseNotes.append(list);
    list = null;
  };

  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) { finishList(); return; }
    const heading = line.match(/^#{1,4}\s+(.+)$/);
    if (heading) {
      finishList();
      const element = document.createElement('h3');
      appendInlineText(element, heading[1]);
      releaseNotes.append(element);
      return;
    }
    const bullet = line.match(/^[-*+]\s+(.+)$/);
    if (bullet) {
      list ??= document.createElement('ul');
      const item = document.createElement('li');
      appendInlineText(item, bullet[1]);
      list.append(item);
      return;
    }
    finishList();
    const paragraph = document.createElement('p');
    appendInlineText(paragraph, line);
    releaseNotes.append(paragraph);
  });
  finishList();

  if (!releaseNotes.childElementCount) {
    const paragraph = document.createElement('p');
    paragraph.textContent = t('changelog.noNotes');
    releaseNotes.append(paragraph);
  }
}

function selectedRelease(): AppRelease | undefined {
  return releases.find((release) => release.version === versionPicker.value);
}

function renderRelease() {
  const release = selectedRelease();
  releaseCard.hidden = !release;
  if (!release) return;

  releaseVersion.textContent = `v${release.version}`;
  releaseTitle.textContent = release.title || `v${release.version}`;
  releaseDate.dateTime = release.publishedAt;
  releaseDate.textContent = formatDate(release.publishedAt);
  currentBadge.hidden = !release.isCurrent;
  renderNotes(release.notes);

  installButton.hidden = release.isCurrent || !release.canInstall;
  installButton.textContent = compareVersions(release.version, installedVersion) > 0
    ? t('changelog.install')
    : t('changelog.installOlder');
  installHint.textContent = release.isCurrent
    ? t('changelog.currentHint')
    : release.canInstall ? t('changelog.installHint') : t('changelog.noInstaller');
}

function populateVersions(selectedVersion?: string) {
  const options = releases.map((release) => {
    const suffix = release.isCurrent ? ` — ${t('changelog.current')}` : '';
    return new Option(`v${release.version}${suffix}`, release.version);
  });
  versionPicker.replaceChildren(...options);
  versionPicker.disabled = releases.length === 0;
  if (selectedVersion && releases.some((release) => release.version === selectedVersion)) versionPicker.value = selectedVersion;
  else versionPicker.value = releases.find((release) => release.isCurrent)?.version ?? releases[0]?.version ?? '';
  renderRelease();
}

async function load(forceRefresh = false) {
  const previousSelection = versionPicker.value;
  refreshButton.disabled = true;
  versionPicker.disabled = true;
  emptyState.hidden = true;
  releaseCard.hidden = true;
  setStatus(forceRefresh ? 'changelog.refreshing' : 'changelog.loading');
  try {
    if (!window.whatIListen?.getUpdateInfo) throw new Error('Release information unavailable');
    const info = await window.whatIListen.getUpdateInfo(forceRefresh);
    installedVersion = info.currentVersion;
    releases = info.releases;
    currentVersion.textContent = `v${installedVersion}`;
    populateVersions(previousSelection);
    emptyState.hidden = releases.length > 0;
    setStatus(releases.length ? 'changelog.loaded' : 'changelog.emptyStatus');
  } catch {
    releases = [];
    versionPicker.replaceChildren(new Option(t('changelog.unavailable'), ''));
    emptyState.hidden = false;
    currentVersion.textContent = installedVersion ? `v${installedVersion}` : '—';
    setStatus('changelog.loadError', true);
  } finally {
    refreshButton.disabled = false;
    versionPicker.disabled = releases.length === 0;
  }
}

versionPicker.addEventListener('change', renderRelease);
refreshButton.addEventListener('click', () => { void load(true); });
installButton.addEventListener('click', async () => {
  const release = selectedRelease();
  if (!release || release.isCurrent || !release.canInstall) return;
  if (!window.confirm(t('changelog.installConfirm').replace('{version}', release.version))) return;
  installButton.disabled = true;
  versionPicker.disabled = true;
  refreshButton.disabled = true;
  setStatus('changelog.installing');
  try {
    await window.whatIListen?.installRelease(release.version);
  } catch {
    setStatus('changelog.installError', true);
    installButton.disabled = false;
    versionPicker.disabled = false;
    refreshButton.disabled = false;
  }
});

document.addEventListener('app-language-change', () => {
  document.title = t('changelog.windowTitle');
  populateVersions(versionPicker.value);
});

void window.i18n.ready?.then(() => load());
