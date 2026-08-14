# What I Listen — Deezer

Application Windows qui affiche le morceau Deezer en cours, puis fournit un overlay pour OBS. Elle lit le titre, l’artiste et la pochette directement depuis la session média publiée par Windows, sans appeler l’API Deezer et sans lire aucun fichier audio.

Distribué sous licence [MIT](LICENSE).

## Utiliser l’application

Lance **What I Listen** : l’application démarre discrètement dans la zone de notification Windows, près de l’horloge. Elle continue de fonctionner même lorsque sa fenêtre est masquée. Clique sur son icône pour afficher l’application ; choisis **Quitter** dans ce menu uniquement si tu veux arrêter l’overlay.

La version installée vérifie automatiquement les nouvelles versions publiées dans les GitHub Releases au démarrage, puis toutes les six heures. Lorsqu’une mise à jour est disponible, une fenêtre dédiée permet de lancer le téléchargement, d’en suivre la progression sans fermer l’application, puis de confirmer le redémarrage une fois l’installation prête.

Depuis l’**Accueil**, le bouton **Ouvrir l’aperçu en direct** affiche une petite fenêtre qui reproduit la source Navigateur OBS : inutile d’ouvrir OBS pour vérifier le rendu. Les visualisations y suivent réellement la sortie audio sélectionnée ; elles restent immobiles lorsqu’aucun son ne sort de ce périphérique.

Dans OBS, le visualiseur réagit en temps réel au son qui sort de Windows. Dans **Paramètres**, choisis la sortie audio exacte à analyser, par exemple `SteelSeries Sonar - Media` pour Deezer ; aucune installation de câble audio virtuel n’est nécessaire. La capture WASAPI est convertie en flottants, fenêtrée avec Hann, analysée par une FFT de 4096 points puis regroupée en **64 bandes logarithmiques de 20 Hz à 16 kHz**. Six zones musicales (sub, bass, low-mid, mids, presence et highs) modulent séparément les rendus. Le menu **Styles** réunit les habillages WebGL/GLSL internes et quatre véritables presets MilkDrop classiques rendus par Butterchurn : **Spirale**, **Fractale**, **Néon** et **Feu liquide**. Le mode **Mix aléatoire** choisit un nouveau thème après un délai variable de 15 à 45 secondes pendant la lecture, sans répéter immédiatement le précédent. Leur moteur reçoit aussi la forme d’onde PCM du loopback WASAPI afin de conserver les équations audio originales de MilkDrop. Rotation, zoom, bruit, couleurs et réinjection de la frame précédente suivent l’audio. Si WebGL2 est indisponible ou interrompu, les presets internes basculent automatiquement sur Canvas 2D. Le choix est mémorisé et s’applique immédiatement dans l’aperçu et dans OBS. Les crédits et licences sont conservés dans `THIRD-PARTY-NOTICES.md` dans l’application distribuée.

## Ajouter l’overlay dans OBS

Cette configuration se fait une seule fois :

1. Dans OBS, dans le panneau **Sources**, clique sur **+**.
2. Choisis **Navigateur**.
3. Donne un nom à la source, par exemple `What I Listen — Deezer`.
4. Dans **URL**, colle `http://127.0.0.1:38491/`.
5. Règle la largeur sur `520` et la hauteur sur `130`.
6. Valide puis place la source où tu le souhaites.

L’overlay apparaît automatiquement quand Deezer publie un morceau dans les contrôles multimédia Windows, puis disparaît lorsqu’aucun morceau n’est détecté. Pour l’afficher ou le masquer pendant un stream, utilise l’icône œil de cette source dans OBS.

## Envoyer les nouveaux morceaux dans Twitch avec SAMMI

What I Listen peut envoyer un webhook local à SAMMI Core lorsqu’un nouveau couple titre/artiste est détecté. Une pause, une reprise ou une actualisation de pochette ne déclenche pas de second message.

1. Dans **SAMMI Core > Settings**, active **Open Local API Server**. Le port par défaut est `9450`.
2. Dans un deck SAMMI, crée un bouton et ajoute-lui un déclencheur **Webhook** dont le message est `what_i_listen_track_changed`.
3. Dans les paramètres du bouton, active **Expose Payload**.
4. Ajoute **Twitch: Send Chat Message** et saisis `/$payload.data.message$/` dans le champ du message. SAMMI encapsule les données personnalisées du webhook dans `payload.data`.
5. Dans les paramètres de What I Listen, ouvre **SAMMI Core et Twitch**, saisis le port et l’éventuel mot de passe API, puis active l’intégration.
6. Clique sur **Tester SAMMI et Twitch**. Un test réussi confirme que SAMMI Core a accepté le webhook ; le message apparaît dans Twitch lorsque le bouton et la connexion Twitch de SAMMI sont opérationnels.

Le webhook contient aussi les champs `title`, `artist`, `album`, `source`, `playback`, `test` et `sentAt`. Le modèle de message accepte les marqueurs `{title}`, `{artist}`, `{album}` et `{source}`.

## En cas de problème

- Ouvre l’application avant OBS et laisse-la ouverte.
- Lance réellement un morceau dans Deezer.
- Vérifie que le titre apparaît dans les contrôles multimédia Windows (`Win` + `A`).
- Redémarre Deezer, puis l’application.
- Dans **Paramètres**, choisis **SteelSeries Sonar - Media** dans **Sortie audio du spectrum**. L’application analyse alors uniquement le signal de cette sortie, sans accéder au microphone.
- Vérifie dans le mélangeur de volume Windows que Deezer est bien routé vers `SteelSeries Sonar - Media`.

## Développement

Installe les dépendances, puis lance l’application :

```powershell
npm.cmd install
npm.cmd start
```

Pour générer l’installateur Windows :

```powershell
npm.cmd run dist
```

Le code est écrit en TypeScript et compilé dans `.build` avant chaque démarrage. Pour valider les types sans lancer l’application :

```powershell
npm.cmd run check
```
