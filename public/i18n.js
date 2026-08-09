(() => {
  const messages = Object.freeze({
    fr: {
      'app.title': 'What I Listen — Deezer',
      'app.eyebrow': 'LECTURE EN COURS',
      'app.connection.checking': 'Connexion…',
      'app.connection.active': 'Service local actif',
      'app.connection.unavailable': 'Service indisponible',
      'app.track.coverAlt': 'Pochette du morceau en cours',
      'app.track.searching': 'Recherche de Deezer…',
      'app.track.waiting': 'En attente de Deezer',
      'app.track.none': 'Aucun morceau détecté',
      'app.track.prompt': 'Lance Deezer et joue un titre.',
      'app.track.playing': 'En lecture sur Deezer',
      'app.track.paused': 'En pause sur Deezer',
      'app.track.unknownTitle': 'Titre inconnu',
      'app.track.unknownArtist': 'Artiste inconnu',
      'app.guide.eyebrow': 'CONFIGURATION UNIQUE',
      'app.guide.title': 'Ajouter l’overlay dans OBS',
      'app.guide.badge': 'Source Navigateur',
      'app.guide.step1': 'Garde cette application ouverte pendant le stream.',
      'app.guide.step2': 'Dans OBS, dans Sources, clique sur + puis choisis Navigateur.',
      'app.guide.step3': 'Donne-lui un nom, par exemple What I Listen — Deezer.',
      'app.guide.step4': 'Colle l’URL locale ci-dessous, puis règle la taille sur 520 × 130.',
      'app.guide.copy': 'Copier l’URL',
      'app.guide.copied': 'URL copiée',
      'app.guide.hint': 'L’overlay s’affiche uniquement lorsqu’un morceau Deezer est détecté. Masque ou affiche la source avec l’icône œil d’OBS.',
      'app.copyError': 'Copie impossible : sélectionne et copie l’URL manuellement.',
      'nav.label': 'Navigation principale',
      'nav.home': 'Accueil',
      'nav.visualizer': 'Visualiseur',
      'nav.settings': 'Paramètres',
      'visualizer.title': 'Visualiseur — What I Listen',
      'visualizer.eyebrow': 'PERSONNALISATION',
      'visualizer.heading': 'Visualiseur musical',
      'visualizer.intro': 'Choisis le mouvement décoratif affiché derrière les informations du morceau dans OBS.',
      'visualizer.optionsLabel': 'Choix du visualiseur',
      'visualizer.bars': 'Barres',
      'visualizer.barsDescription': 'Un égaliseur vert animé.',
      'visualizer.ripple': 'Ondes',
      'visualizer.rippleDescription': 'Des cercles lumineux qui se propagent.',
      'visualizer.pulse': 'Halo',
      'visualizer.pulseDescription': 'Une lueur douce qui respire.',
      'visualizer.off': 'Sans animation',
      'visualizer.offDescription': 'Un overlay parfaitement statique.',
      'visualizer.loading': 'Chargement du choix actuel…',
      'visualizer.saved': 'Choix enregistré. L’overlay OBS se met à jour automatiquement.',
      'visualizer.loadError': 'Impossible de charger les réglages.',
      'visualizer.saving': 'Enregistrement…',
      'visualizer.saveError': 'Enregistrement impossible. Réessaie.',
      'visualizer.note': 'Ce sont des animations décoratives : elles suivent l’état lecture/pause, pas le rythme audio réel.',
      'settings.title': 'Paramètres — What I Listen',
      'settings.eyebrow': 'APPLICATION',
      'settings.heading': 'Paramètres',
      'settings.intro': 'Choisis la façon dont What I Listen se comporte lorsque tu le lances.',
      'settings.startHidden.title': 'Démarrer discrètement',
      'settings.startHidden.description': 'Ouvre l’application près de l’horloge Windows. L’overlay OBS fonctionne même si la fenêtre est masquée.',
      'settings.language.title': 'Langue de l’application',
      'settings.language.description': 'Choisis la langue utilisée dans l’application et dans l’overlay OBS.',
      'settings.language.label': 'Langue de l’application',
      'settings.quit.title': 'Quitter l’application',
      'settings.quit.description': 'Utilise le clic droit sur l’icône près de l’horloge, puis Quitter, pour arrêter le service et l’overlay.',
      'settings.loading': 'Chargement des paramètres…',
      'settings.loaded': 'Paramètres chargés.',
      'settings.loadError': 'Impossible de charger les paramètres.',
      'settings.saving': 'Enregistrement…',
      'settings.startHiddenOn': 'Enregistré. Au prochain lancement, l’application démarrera près de l’horloge.',
      'settings.startHiddenOff': 'Enregistré. Au prochain lancement, la fenêtre s’affichera.',
      'settings.languageSaved': 'Langue enregistrée.',
      'settings.saveError': 'Enregistrement impossible. Réessaie.',
      'overlay.title': 'What I Listen — OBS',
      'overlay.coverAlt': 'Pochette de l’album',
      'overlay.label': 'À l’écoute',
      'overlay.none': 'Aucun morceau',
      'overlay.notDetected': 'Deezer non détecté',
      'overlay.prompt': 'Lance un morceau dans Deezer.',
      'overlay.diagnosticHint': 'La source se masquera automatiquement dès que la lecture est détectée.',
      'overlay.diagnostic': 'Mode diagnostic',
      'overlay.unknownTitle': 'Titre inconnu',
      'overlay.unknownArtist': 'Artiste inconnu',
      'overlay.playing': 'En lecture sur Deezer',
      'overlay.paused': 'En pause sur Deezer',
    },
    en: {
      'app.title': 'What I Listen — Deezer',
      'app.eyebrow': 'NOW PLAYING',
      'app.connection.checking': 'Connecting…',
      'app.connection.active': 'Local service is running',
      'app.connection.unavailable': 'Service unavailable',
      'app.track.coverAlt': 'Current track cover art',
      'app.track.searching': 'Looking for Deezer…',
      'app.track.waiting': 'Waiting for Deezer',
      'app.track.none': 'No track detected',
      'app.track.prompt': 'Open Deezer and play a track.',
      'app.track.playing': 'Playing on Deezer',
      'app.track.paused': 'Paused on Deezer',
      'app.track.unknownTitle': 'Unknown title',
      'app.track.unknownArtist': 'Unknown artist',
      'app.guide.eyebrow': 'ONE-TIME SETUP',
      'app.guide.title': 'Add the overlay to OBS',
      'app.guide.badge': 'Browser source',
      'app.guide.step1': 'Keep this application open while streaming.',
      'app.guide.step2': 'In OBS, under Sources, click + then choose Browser.',
      'app.guide.step3': 'Give it a name, such as What I Listen — Deezer.',
      'app.guide.step4': 'Paste the local URL below, then set its size to 520 × 130.',
      'app.guide.copy': 'Copy URL',
      'app.guide.copied': 'URL copied',
      'app.guide.hint': 'The overlay is shown only when a Deezer track is detected. Use OBS’s eye icon to hide or show the source.',
      'app.copyError': 'Could not copy the URL. Select it and copy it manually.',
      'nav.label': 'Main navigation',
      'nav.home': 'Home',
      'nav.visualizer': 'Visualizer',
      'nav.settings': 'Settings',
      'visualizer.title': 'Visualizer — What I Listen',
      'visualizer.eyebrow': 'CUSTOMIZATION',
      'visualizer.heading': 'Music visualizer',
      'visualizer.intro': 'Choose the decorative movement shown behind the track details in OBS.',
      'visualizer.optionsLabel': 'Visualizer options',
      'visualizer.bars': 'Bars',
      'visualizer.barsDescription': 'An animated green equalizer.',
      'visualizer.ripple': 'Waves',
      'visualizer.rippleDescription': 'Glowing circles that spread outward.',
      'visualizer.pulse': 'Glow',
      'visualizer.pulseDescription': 'A soft breathing glow.',
      'visualizer.off': 'No animation',
      'visualizer.offDescription': 'A completely static overlay.',
      'visualizer.loading': 'Loading current choice…',
      'visualizer.saved': 'Choice saved. The OBS overlay updates automatically.',
      'visualizer.loadError': 'Could not load settings.',
      'visualizer.saving': 'Saving…',
      'visualizer.saveError': 'Could not save. Please try again.',
      'visualizer.note': 'These are decorative animations: they follow play/pause status, not the actual audio beat.',
      'settings.title': 'Settings — What I Listen',
      'settings.eyebrow': 'APPLICATION',
      'settings.heading': 'Settings',
      'settings.intro': 'Choose how What I Listen behaves when you launch it.',
      'settings.startHidden.title': 'Start discreetly',
      'settings.startHidden.description': 'Open the application near the Windows clock. The OBS overlay still works while the window is hidden.',
      'settings.language.title': 'Application language',
      'settings.language.description': 'Choose the language used by the application and the OBS overlay.',
      'settings.language.label': 'Application language',
      'settings.quit.title': 'Quit the application',
      'settings.quit.description': 'Right-click the icon near the clock, then choose Quit to stop the service and overlay.',
      'settings.loading': 'Loading settings…',
      'settings.loaded': 'Settings loaded.',
      'settings.loadError': 'Could not load settings.',
      'settings.saving': 'Saving…',
      'settings.startHiddenOn': 'Saved. The application will start near the clock next time.',
      'settings.startHiddenOff': 'Saved. The window will be displayed next time.',
      'settings.languageSaved': 'Language saved.',
      'settings.saveError': 'Could not save. Please try again.',
      'overlay.title': 'What I Listen — OBS',
      'overlay.coverAlt': 'Album cover art',
      'overlay.label': 'Now playing',
      'overlay.none': 'No track',
      'overlay.notDetected': 'Deezer not detected',
      'overlay.prompt': 'Play a track in Deezer.',
      'overlay.diagnosticHint': 'The source will hide automatically as soon as playback is detected.',
      'overlay.diagnostic': 'Diagnostic mode',
      'overlay.unknownTitle': 'Unknown title',
      'overlay.unknownArtist': 'Unknown artist',
      'overlay.playing': 'Playing on Deezer',
      'overlay.paused': 'Paused on Deezer',
    },
  });

  let language = 'fr';

  function isSupported(value) {
    return Object.hasOwn(messages, value);
  }

  function t(key) {
    return messages[language][key] ?? messages.fr[key] ?? key;
  }

  function apply(root = document) {
    document.documentElement.lang = language;
    root.querySelectorAll('[data-i18n]').forEach((element) => {
      element.textContent = t(element.dataset.i18n);
    });
    [['aria-label', 'data-i18n-aria-label'], ['title', 'data-i18n-title'], ['alt', 'data-i18n-alt']]
      .forEach(([attribute, datasetKey]) => {
        root.querySelectorAll(`[${datasetKey}]`).forEach((element) => {
          element.setAttribute(attribute, t(element.getAttribute(datasetKey)));
        });
      });
  }

  function announceChange() {
    document.dispatchEvent(new CustomEvent('app-language-change', { detail: { language } }));
  }

  function setLanguage(nextLanguage) {
    if (!isSupported(nextLanguage)) return false;
    const changed = language !== nextLanguage;
    language = nextLanguage;
    apply();
    if (changed) announceChange();
    return true;
  }

  async function initialize() {
    try {
      const response = await fetch('/api/settings', { cache: 'no-store' });
      if (response.ok) {
        const settings = await response.json();
        if (isSupported(settings.language)) language = settings.language;
      }
    } catch {
      // French remains available offline as the default language.
    }
    apply();
    announceChange();
  }

  const i18n = {
    get language() { return language; },
    languages: Object.freeze(['fr', 'en']),
    t,
    apply,
    setLanguage,
    ready: null,
  };
  window.i18n = i18n;
  i18n.ready = initialize();
  Object.freeze(i18n);
})();
