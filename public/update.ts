const versionLabel = document.querySelector<HTMLElement>('#version-label')!;
const statusBadge = document.querySelector<HTMLElement>('#status-badge')!;
const stateIcon = document.querySelector<HTMLElement>('#state-icon')!;
const title = document.querySelector<HTMLHeadingElement>('#update-title')!;
const message = document.querySelector<HTMLParagraphElement>('#update-message')!;
const progressLabel = document.querySelector<HTMLElement>('#progress-label')!;
const progressPercent = document.querySelector<HTMLElement>('#progress-percent')!;
const progressTrack = document.querySelector<HTMLElement>('#progress-track')!;
const progressBar = document.querySelector<HTMLElement>('#progress-bar')!;
const progressDetail = document.querySelector<HTMLParagraphElement>('#progress-detail')!;
const errorDetail = document.querySelector<HTMLParagraphElement>('#error-detail')!;
const laterButton = document.querySelector<HTMLButtonElement>('#later-button')!;
const primaryButton = document.querySelector<HTMLButtonElement>('#primary-button')!;

const translations = {
  fr: {
    windowTitle: 'Mise à jour — What I Listen',
    version: (current: string, next: string) => `Version ${current} → ${next}`,
    availableBadge: 'Nouvelle version',
    availableTitle: 'Une mise à jour est disponible',
    availableMessage: 'Téléchargez-la maintenant tout en continuant à utiliser l’application.',
    ready: 'Prête à télécharger',
    staysOpen: 'L’application restera ouverte pendant le téléchargement.',
    download: 'Télécharger la mise à jour',
    later: 'Plus tard',
    downloadingBadge: 'Téléchargement',
    downloadingTitle: 'Téléchargement de la mise à jour…',
    downloadingMessage: 'Vous pouvez continuer à utiliser What I Listen pendant cette étape.',
    downloading: 'Téléchargement en cours',
    downloadedBadge: 'Mise à jour prête',
    downloadedTitle: 'La mise à jour est téléchargée',
    downloadedMessage: 'Voulez-vous redémarrer l’application maintenant pour installer la nouvelle version ?',
    downloaded: 'Téléchargement terminé',
    restart: 'Redémarrer et installer',
    installingBadge: 'Installation',
    installingTitle: 'Fermeture de l’application…',
    installingMessage: 'La mise à jour va être installée dans quelques instants.',
    installing: 'Préparation de l’installation',
    errorBadge: 'Téléchargement interrompu',
    errorTitle: 'La mise à jour n’a pas pu être téléchargée',
    errorMessage: 'Vérifiez votre connexion, puis relancez le téléchargement.',
    retry: 'Réessayer',
    unavailable: 'Les informations de mise à jour ne sont pas disponibles.',
  },
  en: {
    windowTitle: 'Update — What I Listen',
    version: (current: string, next: string) => `Version ${current} → ${next}`,
    availableBadge: 'New version',
    availableTitle: 'An update is available',
    availableMessage: 'Download it now while continuing to use the application.',
    ready: 'Ready to download',
    staysOpen: 'The application will remain open during the download.',
    download: 'Download update',
    later: 'Later',
    downloadingBadge: 'Downloading',
    downloadingTitle: 'Downloading the update…',
    downloadingMessage: 'You can keep using What I Listen during this step.',
    downloading: 'Download in progress',
    downloadedBadge: 'Update ready',
    downloadedTitle: 'The update has been downloaded',
    downloadedMessage: 'Would you like to restart the application now to install the new version?',
    downloaded: 'Download complete',
    restart: 'Restart and install',
    installingBadge: 'Installing',
    installingTitle: 'Closing the application…',
    installingMessage: 'The update will be installed in a few moments.',
    installing: 'Preparing installation',
    errorBadge: 'Download interrupted',
    errorTitle: 'The update could not be downloaded',
    errorMessage: 'Check your connection, then start the download again.',
    retry: 'Try again',
    unavailable: 'Update information is unavailable.',
  },
} as const;

let latestState: AutomaticUpdateState | null = null;

function formatBytes(value: number, language: AutomaticUpdateState['language']): string {
  if (!Number.isFinite(value) || value <= 0) return '0 MB';
  return new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(value / 1024 / 1024) + ' MB';
}

function renderInstalling(state: AutomaticUpdateState): void {
  const copy = translations[state.language] ?? translations.fr;
  document.body.dataset.status = 'installing';
  statusBadge.textContent = copy.installingBadge;
  stateIcon.textContent = '…';
  title.textContent = copy.installingTitle;
  message.textContent = copy.installingMessage;
  progressLabel.textContent = copy.installing;
  progressDetail.textContent = copy.installingMessage;
  laterButton.hidden = false;
  laterButton.disabled = true;
  primaryButton.textContent = copy.installing;
  primaryButton.disabled = true;
}

function render(state: AutomaticUpdateState): void {
  latestState = state;
  const copy = translations[state.language] ?? translations.fr;
  const percent = Math.round(Math.max(0, Math.min(100, state.percent)));
  document.documentElement.lang = state.language;
  document.title = copy.windowTitle;
  document.body.dataset.status = state.status;
  versionLabel.textContent = copy.version(state.currentVersion, state.version);
  progressPercent.textContent = `${percent} %`;
  progressBar.style.width = `${percent}%`;
  progressTrack.setAttribute('aria-valuenow', String(percent));
  errorDetail.hidden = true;
  errorDetail.textContent = '';
  laterButton.textContent = copy.later;
  laterButton.hidden = false;
  laterButton.disabled = false;
  primaryButton.disabled = false;

  if (state.status === 'available') {
    statusBadge.textContent = copy.availableBadge;
    stateIcon.textContent = '↓';
    title.textContent = copy.availableTitle;
    message.textContent = copy.availableMessage;
    progressLabel.textContent = copy.ready;
    progressDetail.textContent = copy.staysOpen;
    primaryButton.textContent = copy.download;
    return;
  }

  if (state.status === 'downloading') {
    statusBadge.textContent = copy.downloadingBadge;
    stateIcon.textContent = '↓';
    title.textContent = copy.downloadingTitle;
    message.textContent = copy.downloadingMessage;
    progressLabel.textContent = copy.downloading;
    progressDetail.textContent = state.total > 0
      ? `${formatBytes(state.transferred, state.language)} / ${formatBytes(state.total, state.language)} · ${formatBytes(state.bytesPerSecond, state.language)}/s`
      : copy.staysOpen;
    laterButton.hidden = true;
    primaryButton.textContent = copy.downloading;
    primaryButton.disabled = true;
    return;
  }

  if (state.status === 'downloaded') {
    statusBadge.textContent = copy.downloadedBadge;
    stateIcon.textContent = '✓';
    title.textContent = copy.downloadedTitle;
    message.textContent = copy.downloadedMessage;
    progressLabel.textContent = copy.downloaded;
    progressDetail.textContent = state.total > 0 ? formatBytes(state.total, state.language) : copy.downloaded;
    primaryButton.textContent = copy.restart;
    return;
  }

  statusBadge.textContent = copy.errorBadge;
  stateIcon.textContent = '!';
  title.textContent = copy.errorTitle;
  message.textContent = copy.errorMessage;
  progressLabel.textContent = copy.errorBadge;
  progressDetail.textContent = copy.staysOpen;
  errorDetail.textContent = state.error || copy.unavailable;
  errorDetail.hidden = false;
  primaryButton.textContent = copy.retry;
}

primaryButton.addEventListener('click', async () => {
  if (!latestState || primaryButton.disabled) return;
  primaryButton.disabled = true;
  try {
    if (latestState.status === 'downloaded') {
      renderInstalling(latestState);
      await window.whatIListen?.restartAndInstallUpdate();
    } else {
      await window.whatIListen?.downloadAutomaticUpdate();
    }
  } catch (error) {
    if (latestState.status !== 'error') {
      render({ ...latestState, status: 'error', error: error instanceof Error ? error.message : String(error) });
    }
  }
});

laterButton.addEventListener('click', () => { void window.whatIListen?.closeUpdateWindow(); });

const unsubscribe = window.whatIListen?.onAutomaticUpdateState(render);
window.addEventListener('unload', () => unsubscribe?.());

void window.whatIListen?.getAutomaticUpdateState().then((state) => {
  if (state) render(state);
});
