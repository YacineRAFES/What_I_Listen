# What I Listen — Deezer

Application Windows locale qui affiche le morceau Deezer en cours, puis fournit un overlay pour OBS. Elle lit uniquement la session média publiée par Windows : elle ne se connecte pas à Deezer, ne lit aucun fichier de Deezer et n’envoie aucune donnée sur le réseau.

Distribué sous licence [MIT](LICENSE).

## Utiliser l’application

Lance **What I Listen** : l’application démarre discrètement dans la zone de notification Windows, près de l’horloge. Elle continue de fonctionner même lorsque sa fenêtre est masquée. Clique sur son icône pour afficher l’application ; choisis **Quitter** dans ce menu uniquement si tu veux arrêter l’overlay.

La page **Visualiseur** permet de choisir une animation synchronisée à l’audio système (barres, ondes, halo ou aucune). Le choix est mémorisé et OBS se met à jour automatiquement. Le bouton **Ouvrir l’aperçu** affiche une petite fenêtre qui reproduit la source Navigateur en direct : inutile d’ouvrir OBS pour vérifier un changement de visuel. Le visualiseur réagit au son lu par Windows ; évite donc les notifications et les autres sources audio pour qu’il représente uniquement Deezer.

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

## Publier une release GitHub

`release-it` incrémente la version, valide le code, construit l’installateur, crée puis pousse le commit et le tag, et publie une release GitHub contenant le fichier `.exe`. La publication sur npm est désactivée.

La commande demande Node 20.19 ou une version plus récente.

Crée un jeton d’accès GitHub ayant l’autorisation de créer des releases, puis fournis-le uniquement pour la session PowerShell en cours :

```powershell
$env:GITHUB_TOKEN = "github_pat_..."
npm.cmd run release
```

La commande est interactive et propose la prochaine version. Sans `GITHUB_TOKEN`, `release-it` ouvre la page GitHub de création de release avec les champs préremplis ; le commit et le tag sont tout de même poussés automatiquement.
