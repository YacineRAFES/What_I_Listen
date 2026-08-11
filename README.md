# What I Listen — Deezer

Application Windows qui affiche le morceau Deezer en cours, puis fournit un overlay pour OBS. Elle lit la session média publiée par Windows. Si Windows conserve une jaquette en retard, l’application recherche une seule fois la piste dans le catalogue public Deezer, avec son titre et son artiste, afin d’afficher la bonne image. Cette recherche ne se connecte pas au compte Deezer et ne lit aucun fichier audio.

Distribué sous licence [MIT](LICENSE).

## Utiliser l’application

Lance **What I Listen** : l’application démarre discrètement dans la zone de notification Windows, près de l’horloge. Elle continue de fonctionner même lorsque sa fenêtre est masquée. Clique sur son icône pour afficher l’application ; choisis **Quitter** dans ce menu uniquement si tu veux arrêter l’overlay.

Depuis l’**Accueil**, le bouton **Ouvrir l’aperçu en direct** affiche une petite fenêtre qui reproduit la source Navigateur OBS : inutile d’ouvrir OBS pour vérifier le rendu. Le spectrum y suit réellement la sortie audio sélectionnée ; il reste immobile lorsqu’aucun son ne sort de ce périphérique.

Dans OBS, le visualiseur réagit en temps réel au son qui sort de Windows. Dans **Paramètres**, choisis la sortie audio exacte à analyser, par exemple `SteelSeries Sonar - Media` pour Deezer ; aucune installation de câble audio virtuel n’est nécessaire. Tu peux aussi choisir le style de l’overlay : **Luna** affiche des barres, **Winamp Classic** son spectrum segmenté, **Glass** des ondes, **Aura** un halo, **Néon rétro** une grille synthwave et des barres lumineuses, **Spectrum** un spectrum pleine largeur de 32 bandes en miroir, **Battery** des halos et ondes abstraites, et **VU Meter LED** des colonnes segmentées vertes, jaunes et rouges avec leurs crêtes. Spectrum propose les palettes **Moderne**, **Ocean Mist**, **Fire Storm** et **Scope**. Le choix est mémorisé et s’applique immédiatement dans l’aperçu et dans OBS.

## Ajouter l’overlay dans OBS

Cette configuration se fait une seule fois :

1. Dans OBS, dans le panneau **Sources**, clique sur **+**.
2. Choisis **Navigateur**.
3. Donne un nom à la source, par exemple `What I Listen — Deezer`.
4. Dans **URL**, colle `http://127.0.0.1:38491/`.
5. Règle la largeur sur `520` et la hauteur sur `130`.
6. Valide puis place la source où tu le souhaites.

L’overlay apparaît automatiquement quand Deezer publie un morceau dans les contrôles multimédia Windows, puis disparaît lorsqu’aucun morceau n’est détecté. Pour l’afficher ou le masquer pendant un stream, utilise l’icône œil de cette source dans OBS.

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
