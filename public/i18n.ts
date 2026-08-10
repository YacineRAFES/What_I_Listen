(() => {
  const messages: Readonly<Record<'fr' | 'en', Readonly<Record<string, string>>>> = Object.freeze({
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
      'app.track.prompt': 'Lance Deezer (application ou navigateur) et joue un titre.',
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
      'app.guide.hint': 'L’overlay s’affiche lorsqu’une lecture multimédia est détectée. Deezer reste prioritaire ; sinon la session en cours est utilisée. Masque ou affiche la source avec l’icône œil d’OBS.',
      'app.copyError': 'Copie impossible : sélectionne et copie l’URL manuellement.',
      'nav.label': 'Navigation principale',
      'nav.home': 'Accueil',
      'nav.settings': 'Paramètres',
      'settings.title': 'Paramètres — What I Listen',
      'settings.eyebrow': 'APPLICATION',
      'settings.heading': 'Paramètres',
      'settings.intro': 'Choisis la façon dont What I Listen se comporte lorsque tu le lances.',
      'settings.startHidden.title': 'Démarrer discrètement',
      'settings.startHidden.description': 'Ouvre l’application près de l’horloge Windows. L’overlay OBS fonctionne même si la fenêtre est masquée.',
      'settings.titleMarquee.title': 'Défilement continu des titres longs',
      'settings.titleMarquee.description': 'Fait défiler horizontalement le titre du morceau dans l’overlay OBS lorsqu’il ne tient pas sur une ligne.',
      'settings.skin.title': 'Style de l’overlay',
      'settings.skin.description': 'Choisis l’habillage affiché dans OBS. Chaque thème applique son animation dédiée, immédiatement dans l’aperçu et dans OBS.',
      'settings.skin.luna': 'Luna',
      'settings.skin.lunaDescription': 'Bleu Windows XP, brillant, avec ses barres animées.',
      'settings.skin.aura': 'Aura',
      'settings.skin.auraDescription': 'Le style sombre et lumineux original, avec son halo.',
      'settings.skin.winamp': 'Winamp Classic',
      'settings.skin.winampDescription': 'Métal, afficheur vert et spectrum segmenté.',
      'settings.skin.glass': 'Glass',
      'settings.skin.glassDescription': 'Verre bleuté et ondes lumineuses.',
      'settings.skin.neon': 'Néon rétro',
      'settings.skin.neonDescription': 'Grille synthwave cyan et magenta, avec barres lumineuses.',
      'settings.preview.title': 'Aperçu en direct',
      'settings.preview.description': 'Ouvre une fenêtre qui reproduit le thème sélectionné dans OBS.',
      'settings.preview.open': 'Ouvrir l’aperçu',
      'settings.preview.unavailable': 'L’aperçu est disponible dans l’application What I Listen.',
      'settings.preview.opened': 'Aperçu ouvert. Il reflète le thème sélectionné.',
      'settings.preview.error': 'Impossible d’ouvrir l’aperçu. Réessaie.',
      'settings.neonPalette.title': 'Palette néon',
      'settings.neonPalette.description': 'Change les couleurs du thème néon sans modifier sa mise en page.',
      'settings.neonPalette.label': 'Palette néon',
      'settings.neonPalette.violetCyan': 'Violet et cyan',
      'settings.neonPalette.sunset': 'Coucher de soleil',
      'settings.neonPalette.laser': 'Laser vert',
      'settings.neonPaletteSaved': 'Palette néon enregistrée.',
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
      'settings.titleMarqueeOn': 'Défilement continu activé dans l’overlay OBS.',
      'settings.titleMarqueeOff': 'Défilement continu désactivé dans l’overlay OBS.',
      'settings.skinSaved': 'Style enregistré. L’aperçu et OBS se mettent à jour automatiquement.',
      'settings.languageSaved': 'Langue enregistrée.',
      'settings.saveError': 'Enregistrement impossible. Réessaie.',
      'overlay.title': 'What I Listen — OBS',
      'overlay.coverAlt': 'Pochette de l’album',
      'overlay.label': 'À l’écoute',
      'overlay.luna.windowTitle': 'What I Listen — Lecture en cours',
      'overlay.none': 'Aucun morceau',
      'overlay.notDetected': 'Deezer non détecté',
      'overlay.prompt': 'Lance un morceau dans Deezer.',
      'overlay.diagnosticHint': 'La source se masquera automatiquement dès que la lecture est détectée.',
      'overlay.diagnostic': 'Mode diagnostic',
      'overlay.preview': 'Aperçu animé',
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
      'app.track.prompt': 'Open Deezer (desktop app or browser) and play a track.',
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
      'app.guide.hint': 'The overlay appears when media playback is detected. Deezer stays preferred; otherwise the active session is used. Use OBS’s eye icon to hide or show the source.',
      'app.copyError': 'Could not copy the URL. Select it and copy it manually.',
      'nav.label': 'Main navigation',
      'nav.home': 'Home',
      'nav.settings': 'Settings',
      'settings.title': 'Settings — What I Listen',
      'settings.eyebrow': 'APPLICATION',
      'settings.heading': 'Settings',
      'settings.intro': 'Choose how What I Listen behaves when you launch it.',
      'settings.startHidden.title': 'Start discreetly',
      'settings.startHidden.description': 'Open the application near the Windows clock. The OBS overlay still works while the window is hidden.',
      'settings.titleMarquee.title': 'Continuously scroll long titles',
      'settings.titleMarquee.description': 'Scrolls the track title horizontally in the OBS overlay when it does not fit on one line.',
      'settings.skin.title': 'Overlay style',
      'settings.skin.description': 'Choose the look shown in OBS. Each theme applies its dedicated animation immediately in the preview and OBS.',
      'settings.skin.luna': 'Luna',
      'settings.skin.lunaDescription': 'Glossy Windows XP blue, with animated bars.',
      'settings.skin.aura': 'Aura',
      'settings.skin.auraDescription': 'The original dark, luminous look, with a glow.',
      'settings.skin.winamp': 'Winamp Classic',
      'settings.skin.winampDescription': 'Metal, green display and a segmented spectrum.',
      'settings.skin.glass': 'Glass',
      'settings.skin.glassDescription': 'Blue-tinted glass with luminous waves.',
      'settings.skin.neon': 'Retro Neon',
      'settings.skin.neonDescription': 'Cyan and magenta synthwave grid with luminous bars.',
      'settings.preview.title': 'Live preview',
      'settings.preview.description': 'Opens a window that mirrors the selected OBS theme.',
      'settings.preview.open': 'Open preview',
      'settings.preview.unavailable': 'The preview is available in the What I Listen application.',
      'settings.preview.opened': 'Preview opened. It reflects the selected theme.',
      'settings.preview.error': 'Could not open the preview. Please try again.',
      'settings.neonPalette.title': 'Neon palette',
      'settings.neonPalette.description': 'Change the neon theme colors without changing its layout.',
      'settings.neonPalette.label': 'Neon palette',
      'settings.neonPalette.violetCyan': 'Violet and cyan',
      'settings.neonPalette.sunset': 'Sunset',
      'settings.neonPalette.laser': 'Green laser',
      'settings.neonPaletteSaved': 'Neon palette saved.',
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
      'settings.titleMarqueeOn': 'Continuous scrolling enabled in the OBS overlay.',
      'settings.titleMarqueeOff': 'Continuous scrolling disabled in the OBS overlay.',
      'settings.skinSaved': 'Style saved. The preview and OBS update automatically.',
      'settings.languageSaved': 'Language saved.',
      'settings.saveError': 'Could not save. Please try again.',
      'overlay.title': 'What I Listen — OBS',
      'overlay.coverAlt': 'Album cover art',
      'overlay.label': 'Now playing',
      'overlay.luna.windowTitle': 'What I Listen — Now playing',
      'overlay.none': 'No track',
      'overlay.notDetected': 'Deezer not detected',
      'overlay.prompt': 'Play a track in Deezer.',
      'overlay.diagnosticHint': 'The source will hide automatically as soon as playback is detected.',
      'overlay.diagnostic': 'Diagnostic mode',
      'overlay.preview': 'Animated preview',
      'overlay.unknownTitle': 'Unknown title',
      'overlay.unknownArtist': 'Unknown artist',
      'overlay.playing': 'Playing on Deezer',
      'overlay.paused': 'Paused on Deezer',
    },
  });

  let language: 'fr' | 'en' = 'fr';

  function isSupported(value: string): value is 'fr' | 'en' {
    return Object.hasOwn(messages, value);
  }

  function t(key: string): string {
    return messages[language][key] ?? messages.fr[key] ?? key;
  }

  function apply(root: Document | HTMLElement = document) {
    document.documentElement.lang = language;
    root.querySelectorAll('[data-i18n]').forEach((element) => {
      element.textContent = t((element as HTMLElement).dataset.i18n ?? '');
    });
    [['aria-label', 'data-i18n-aria-label'], ['title', 'data-i18n-title'], ['alt', 'data-i18n-alt']]
      .forEach(([attribute, datasetKey]) => {
        root.querySelectorAll(`[${datasetKey}]`).forEach((element) => {
          element.setAttribute(attribute, t(element.getAttribute(datasetKey) ?? ''));
        });
      });
  }

  function announceChange() {
    document.dispatchEvent(new CustomEvent('app-language-change', { detail: { language } }));
  }

  function setLanguage(nextLanguage: string): boolean {
    if (!isSupported(nextLanguage)) return false;
    const changed = language !== nextLanguage;
    if (!changed) return true;
    language = nextLanguage;
    apply();
    announceChange();
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

  const i18n: I18nApi = {
    get language() { return language; },
    languages: Object.freeze(['fr', 'en'] as const),
    t,
    apply,
    setLanguage,
    ready: null,
  };
  window.i18n = i18n;
  i18n.ready = initialize();
  Object.freeze(i18n);
})();
