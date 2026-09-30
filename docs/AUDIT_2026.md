# Audit de l'outil d'estimation et refonte charte 2026

## 1. Erreurs corrigées

### Sécurité (critique)

| Problème | Risque | Correction |
|---|---|---|
| `JWT_SECRET` valait `'fallback-secret'` par défaut | N'importe qui pouvait forger un jeton admin et lire tous les leads | Plus aucun secret par défaut : sans `JWT_SECRET` (16 caractères min.), l'admin est désactivé |
| Login admin : `username === ADMIN_USERNAME` | Si les variables n'étaient pas définies, un corps vide `{}` donnait accès à l'admin (`undefined === undefined`) | Login refusé si non configuré, comparaison à temps constant, limite de 10 essais / 15 min |
| `/api/test-env` public | Exposait les 15 premiers caractères de la clé API Brevo | Supprimé |
| `/test-mongo` et `/api/test-mongo` publics | Écrivaient `MONGO_URL` (avec mot de passe) dans les logs et exposaient la base | Supprimés |
| Numéro de contournement SMS codé en dur (`0698793430`) | Toute personne saisissant ce numéro passait la vérification | Contournement actif uniquement si `BYPASS_PHONE_NUMBER` est défini |
| Code OTP généré avec `Math.random()` | Prévisible | `crypto.randomInt` |
| `/api/leads` acceptait n'importe quoi (`...leadData`) | Faux leads sans vérification SMS, injection de champs (`status`, etc.) | Téléphone vérifié **côté serveur** (30 min), liste blanche des champs, email / consentement validés |
| Envoi de SMS sans limite | Coût Brevo (SMS bombing) | 10 SMS/h par IP, 5 SMS/h par numéro |
| CORS `*` sur toute l'API, `X-Frame-Options: ALLOWALL` | N'importe quel site pouvait appeler l'API et intégrer l'outil | CORS limité à alteregopatrimoine.com (`CORS_ORIGINS`), iframe autorisée seulement pour alteregopatrimoine.com (`FRAME_ANCESTORS`), admin non intégrable et non indexé |
| Emails et téléphones dans les logs Brevo | RGPD | Logs anonymisés |
| `error.message` renvoyé au client | Fuite d'informations internes | Message générique en production |

### Fonctionnement

| Problème | Conséquence | Correction |
|---|---|---|
| Le front créait **2 leads par estimation** (avant et après le calcul) | Doublons dans l'admin et double synchro Brevo | 1 lead créé, puis l'estimation y est rattachée via `leadId` |
| Scraping SeLoger avec Puppeteer à chaque estimation | 30 à 40 s d'attente, échec quasi systématique (anti-bot, sélecteurs obsolètes, code postal passé comme code INSEE), risque juridique | Supprimé (ainsi que Puppeteer et Chromium de l'image Docker) : l'estimation est instantanée |
| Carte : annonces placées **au hasard** autour du bien | Information fausse | Retiré. La carte montre les vraies ventes DVF et le vrai rayon de recherche (au lieu d'un cercle fixe de 1 km) |
| Ascenseur déduit de « nombre d'étages > 0 » | Ajustement étage faux pour la plupart des appartements | Question « Ascenseur oui/non » ajoutée |
| Pénalité de dispersion jamais appliquée (`dvfStats.stdDev` au lieu de `dvfStats.stats.stdDev`) | Confiance surestimée dans les zones hétérogènes | Corrigé |
| Poids de pondération pouvant être nuls ou négatifs | Vente en bord de rayon/période ignorée ou comptée à l'envers | Plancher à 0,1 |
| Résultats : « Prix estimé » affichait la **fourchette basse** et « Prix conseillé » le prix médian | Valeur affichée 6 à 10 % sous l'estimation réelle | Affichage de la valeur estimée + fourchette basse/haute |
| « Nouvelle estimation » ne réinitialisait ni la vérification SMS ni la raison | État incohérent | Réinitialisation propre (le téléphone vérifié reste valable 30 min, pas de nouveau SMS) |
| Recherche d'adresse à chaque frappe, sans annulation | Suggestions dans le désordre, charge inutile | Temporisation 250 ms + annulation + navigation clavier |
| Compte à rebours SMS avec `setInterval` non nettoyé | Fuites / double décompte | `useEffect` |
| Aucun résultat affiché quand il n'y a pas de comparables | Page quasi vide | Message dédié + prise de rendez-vous |
| Écran de lead titré « Votre estimation est prête ! » avant tout calcul | Promesse trompeuse | « Votre estimation est presque prête » ; le calcul se lance automatiquement après le code SMS (un clic en moins) |
| Consentement « dans mon projet de vente » y compris pour les acheteurs | Texte incohérent | « projet immobilier » |
| `.gitignore` corrompu (40 blocs `-e` dupliqués) | Illisible | Nettoyé |

## 2. Refonte visuelle (charte AlterEgo 2026)

- Polices **Bricolage Grotesque** (titres, 800) et **Instrument Sans** (texte), auto-hébergées dans `public/fonts` (pas de Google Fonts).
- Couleurs de la charte (`ink`, `paper`, `sand`, `line`, `brique`, `sauge`, `muted`) disponibles en Tailwind (`bg-ae-ink`, `text-ae-brique`…) et branchées sur les variables shadcn : l'admin adopte aussi la charte.
- Cartes blanches rayon 22 px bordure `line`, boutons pilule (plein `ink`, action `brique`, contour `ink` 1,5 px), surtitres majuscules brique.
- Logos officiels (`public/brand`) au lieu de l'image hébergée chez Emergent.
- Suppression des emojis, dégradés bleus/verts et couleurs génériques.
- Barre de progression « Étape X sur 6 », formulaires accessibles (labels associés, `aria-pressed`, navigation clavier), vraie mise en page mobile (grilles adaptatives).
- Page de résultats : bande sombre avec la valeur, détail du calcul, ventes comparables listées, carte sobre (fond CARTO clair, marqueurs ink/brique), appel à l'action « Prendre rendez-vous ».

## 3. Intégration dans alteregopatrimoine.com

Deux options :

**A. Sous-domaine (recommandé)** : `estimation.alteregopatrimoine.com`. L'outil a son propre en-tête (logo + « Retour au site ») et pied de page aux couleurs du site. Aucun code côté WordPress, meilleur pour le SEO et le suivi Google Ads.

**B. Iframe dans une page WordPress** : ajouter `?embed=1` masque l'en-tête et le pied de page. La hauteur est transmise automatiquement au site parent :

```html
<iframe id="ae-estimation" src="https://estimation.alteregopatrimoine.com/?embed=1"
        style="width:100%;border:0;min-height:900px" title="Estimation immobilière"></iframe>
<script>
  window.addEventListener('message', function (e) {
    if (e.origin !== 'https://estimation.alteregopatrimoine.com') return;
    if (e.data && e.data.type === 'alterego-estimation:height') {
      document.getElementById('ae-estimation').style.height = e.data.height + 'px';
    }
  });
</script>
```

## 4. Variables d'environnement

| Variable | Rôle |
|---|---|
| `JWT_SECRET` | **Obligatoire** pour l'admin (≥ 16 caractères aléatoires) |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Identifiants admin |
| `MONGO_URL`, `DB_NAME`, `BREVO_API_KEY` | Inchangés |
| `BYPASS_PHONE_NUMBER` | Optionnel, numéro de test sans SMS (à ne pas définir en production) |
| `CORS_ORIGINS` | Optionnel, origines autorisées (défaut : alteregopatrimoine.com et www) |
| `FRAME_ANCESTORS` | Optionnel, sites autorisés à intégrer l'outil en iframe |
| `NEXT_PUBLIC_MAIN_SITE_URL` | Lien « Retour au site » (défaut : https://alteregopatrimoine.com) |
| `NEXT_PUBLIC_CONTACT_URL` | Lien du bouton « Prendre rendez-vous » (à pointer vers la page contact / prise de RDV) |
| `CALIBRATION_OFFSET` | Ajustement de prudence global (défaut `-0.08`), à recalibrer après réimport DVF |
| `DVF_YEARS` | Années DVF importées (défaut : les 5 dernières) |

## 5. Deuxième passe

### Qualité des données DVF (impact direct sur les prix)

- **Ventes « en bloc »** : dans DVF, `valeur_fonciere` est le prix de toute la vente, répété
  sur chaque lot. Une vente de 3 appartements pour 900 000 € produisait 3 comparables
  à 900 000 € chacun. L'import regroupe désormais les lignes par mutation et ne garde
  que les ventes d'un seul logement (cave ou parking acceptés).
- Maisons sur plusieurs parcelles/cultures : dédoublonnées, surface de terrain additionnée.
- VEFA (neuf), échanges, adjudications et ventes mixtes avec local commercial écartés.
- L'import ne chargeait que **2024** alors que le code visait 5 ans et que la recherche
  remonte jusqu'à 36 mois : il charge maintenant les 5 dernières années publiées.
- Un département n'est plus vidé si le téléchargement échoue.
- Noms de rue affichés en casse normale, sans le faux numéro « XX ».

**À faire après déploiement : relancer l'import DVF** (`node scripts/ingest-all-france.js`
ou depuis `/admin/dvf`), puis revoir `CALIBRATION_OFFSET`. Le -8 % appliqué à toutes les
estimations servait probablement à compenser la surévaluation due aux ventes en bloc.

### Modèle

- Fiabilité : plancher abaissé de 65 à 30, pénalité quand il y a moins de 6 ventes,
  fourchette élargie à ±13 % quand la fiabilité est faible. Un seul indicateur à l'écran
  (l'avertissement suit la fiabilité affichée).
- Le détail du calcul affiche l'ajustement de prudence et signale les plafonnements :
  les pourcentages affichés expliquent enfin le prix retenu.

### Sécurité et dépôt

- **Secrets publiés dans le dépôt** : mot de passe MongoDB de production, mot de passe
  admin et exemples de `JWT_SECRET` figuraient dans ~15 fichiers de documentation et dans
  `docker-compose.yml`. Fichiers supprimés, valeurs par défaut retirées du compose ;
  l'API refuse ces anciennes valeurs. **Ils restent dans l'historique git : il faut les
  changer.**
- Index MongoDB créés automatiquement (TTL sur les codes OTP, unicité des leads).
- Admin : charte, logo local, retour à l'écran de connexion si la session expire, prix
  estimé (et non fourchette basse) dans la liste, l'export CSV et la fiche lead.
- Dépendances inutilisées retirées (`puppeteer`, `cheerio`, `axios`, `bcryptjs`),
  package renommé, `README.md` et `.env.example` réécrits.
- 17 tests unitaires (`yarn test`) et CI GitHub Actions (tests + build) sur chaque PR.

## 6. Troisième passe

- **Next.js 14.2.3 → 15.5** et React 19 : la branche 14 n'est plus maintenue et plusieurs
  failles critiques/hautes n'y sont pas corrigées. `yarn audit` : 0 vulnérabilité sur les
  dépendances de production.
- 40 composants d'interface et 37 dépendances inutilisés supprimés (installation et build
  plus rapides, image Docker plus légère), Docker passé en Node 22, `.env` exclu de l'image.
- **Session admin par cookie `httpOnly` / `SameSite=Strict`** au lieu du `localStorage`
  (un script injecté ne peut plus voler la session) ; bouton de déconnexion côté serveur.
- La liste des leads n'envoie plus les 20 ventes comparables de chaque estimation.
- Routes `DELETE` qui faisaient des lectures supprimées.
- Débordement horizontal sur mobile corrigé (adresses longues dans les résultats).
- Tests de bout en bout Playwright (tunnel complet sur ordinateur et mobile, mode intégré,
  admin) exécutés par la CI à chaque pull request.

## 7. Quatrième passe

### « 404 page not found » de Traefik à chaque déploiement

Reproduit localement (Docker 29 + Traefik + réseau `dokploy-network`) :

- **Cause 1 (dans le dépôt, corrigée)** : les étiquettes Traefik de `docker-compose.yml`
  étaient sous `deploy.labels`, lues uniquement en mode Swarm. Avec `docker compose up`,
  le conteneur démarrait sans aucune étiquette Traefik → 404 en HTTP comme en HTTPS.
  De plus, le routeur unique `web,websecure` + TLS ne pouvait jamais répondre en HTTP.
  Désormais : étiquettes au niveau du service, un routeur HTTPS et une redirection HTTP.
  Vérifié : HTTPS 200, HTTP 301 vers HTTPS, et un redéploiement ne coûte qu'une requête.
- **Cause 2 (sur le serveur, à vérifier)** : Traefik < 3.6 ne sait plus dialoguer avec
  Docker 29+ (« client version 1.24 is too old ») et répond 404 à tout, même avec une
  configuration correcte. Reproduit avec Traefik 3.3. Correctif : mettre Traefik à jour.
- La CI vérifie maintenant la configuration Compose et la présence des étiquettes.

### Autres corrections

- Scripts d'import DVF inutilisables dans l'image de production (`csv-parse` absent) :
  corrigé, vérifié dans le conteneur.
- **Évolution des prix dans le temps** : la tendance du quartier (ventes du même type
  dans 1 km sur 4 ans) est estimée par régression et chaque vente est ramenée à sa valeur
  d'aujourd'hui (seulement si la tendance est statistiquement nette, bornée à ±15 %/an).
- **Outil de recalibrage** `yarn backtest` : rejoue des ventes réelles à leur date, mesure
  l'erreur et recommande `CALIBRATION_OFFSET`.
- Parcours complet testé sur une vraie base MongoDB derrière Traefik (vérification SMS,
  lead unique, champs injectés ignorés, index, session admin par cookie).

## 8. Cinquième passe

- **API découpée** : le routeur unique de 650 lignes (`[[...path]]/route.js`) est remplacé
  par une route Next.js par fichier (`app/api/estimate/route.js`, `app/api/leads/route.js`…)
  et une logique partagée dans `lib/server/`. Erreurs et accès admin gérés par
  `handler()` / `adminHandler()`. Les routes inconnues répondent toujours en JSON.
- **Tests d'intégration de l'API** (`yarn test:api`) contre un vrai serveur et une vraie
  base MongoDB : validation, CORS, estimation, vérification SMS, lead unique, admin par
  cookie. Écrits avant le découpage pour garantir un comportement identique, et exécutés
  par la CI avec un service MongoDB.

## 9. Axes d'amélioration restants

1. **Modèle** : exploiter nombre de pièces et année de construction une fois le
   recalibrage fait sur les vraies données.
2. **Recherche géographique** : index `2dsphere` + `$geoNear` au lieu de la boîte englobante.
4. **RGPD** : faire valider la mention « ses partenaires » du consentement ; définir une
   durée de conservation des leads.
5. **Déploiement sans coupure** : passer en mode Stack (Swarm) avec `update_config.order:
   start-first` si même une seconde d'interruption est gênante.
