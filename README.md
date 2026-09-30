# AlterEgo — Estimation immobilière

Outil d'estimation en ligne d'AlterEgo Patrimoine : l'utilisateur décrit son bien, vérifie
son téléphone par SMS et obtient une valeur calculée à partir des ventes réelles
(DVF) autour de l'adresse. Chaque estimation crée un lead dans l'admin et dans Brevo.

- Tunnel d'estimation : `/` (intégrable en iframe avec `/?embed=1`)
- Administration des leads : `/admin`
- Administration des données DVF : `/admin/dvf`

## Démarrer en local

```bash
yarn install
cp .env.example .env   # puis compléter les valeurs
yarn dev               # http://localhost:3000
yarn test              # tests unitaires du moteur d'estimation et de l'import DVF
yarn build && yarn test:api   # tests d'intégration de l'API (MongoDB local requis, base alterego_test vidée)
yarn test:e2e          # parcours complet dans un navigateur (après yarn build)
```

## Charger les données DVF

```bash
node scripts/ingest-dvf.js 75 92          # départements choisis
node scripts/ingest-dvf.js all-idf        # toute l'Île-de-France
node scripts/ingest-all-france.js         # toute la France (plusieurs heures)
```

L'import récupère les 5 dernières années publiées sur data.gouv.fr (`DVF_YEARS` pour
choisir), ne garde que les ventes d'un seul logement (les ventes « en bloc » faussent
le prix au m²) et ne supprime jamais les données d'un département si le
téléchargement échoue.

## Recalibrer le modèle

Après chaque import DVF important :

```bash
yarn backtest 500 75     # 500 ventes récentes de Paris, rejouées à leur date de vente
```

Le script estime des ventes réelles en les retirant des comparables et affiche l'erreur
médiane, la part d'estimations à ±10 % et le `CALIBRATION_OFFSET` recommandé.

## Déploiement (Dokploy + Traefik)

L'application est déployée sur Dokploy comme **Application** (build *Dockerfile*). Dans ce
mode, `docker-compose.yml` n'est pas utilisé : le routage Traefik vient **uniquement de
l'onglet Domains** de l'application Dokploy. Réglages attendus :

| Champ | Valeur |
|---|---|
| Host | `app.alteregopatrimoine.com` |
| Path | `/` |
| Container Port | `3000` |
| HTTPS | activé, certificat Let's Encrypt |

Des étiquettes Traefik ajoutées à la main sur le conteneur sont effacées à chaque
redéploiement : ne pas s'en servir.

### « 404 page not found »

Sur le serveur (SSH, en root), depuis le dossier du code :

```bash
sh scripts/diagnostic-traefik.sh
```

Le script ne modifie rien. Il affiche les versions, la route déclarée par Dokploy, teste
l'application depuis Traefik puis en HTTP/HTTPS, et termine par une conclusion. Causes
reproduites :

| Symptôme | Cause | Correction |
|---|---|---|
| 404 en HTTP et HTTPS | aucun domaine dans l'onglet Domains | ajouter le domaine (tableau ci-dessus) |
| HTTP 200, **HTTPS 404** | domaine créé sans HTTPS | activer HTTPS sur le domaine |
| 502 Bad Gateway | mauvais port (≠ 3000) ou conteneur arrêté | corriger le port, voir les logs |
| 404 sur les routes `docker-compose` | Traefik < 3.6 avec Docker 29+ | mettre Traefik à jour |

`docker-compose.yml` reste utilisable si l'application est un jour déployée en mode
*Docker Compose* : il porte alors lui-même ses étiquettes Traefik.

Les scripts d'import DVF fonctionnent dans le conteneur :
`docker exec -it <conteneur> node scripts/ingest-dvf.js 75`.

## Configuration

Voir `.env.example`. Sans `JWT_SECRET`, `ADMIN_USERNAME` et `ADMIN_PASSWORD`,
l'administration est désactivée.

## Organisation du code

| Dossier | Contenu |
|---|---|
| `app/page.js` | Tunnel d'estimation (charte AlterEgo 2026) |
| `app/api/*/route.js` | Une route par fichier : `estimate`, `leads`, `verification/*`, `auth/*`, `admin/*`, `geo/resolve`, `dvf/comparables` |
| `lib/server/` | Logique partagée des routes : estimation, leads, envoi des codes SMS |
| `lib/api-helpers.js` | Réponses JSON, CORS, session admin, limitation de débit |
| `lib/dvf-enhanced.js` | Recherche adaptative des ventes comparables |
| `lib/dvf-adjustments.js` | Ajustements (étage, DPE, vue…), confiance et fourchette |
| `lib/config-adjustments.js` | **Tous les réglages du modèle** (poids, bornes, calibrage) |
| `lib/dvf-ingestion.js` | Import des fichiers DVF |
| `docs/AUDIT_2026.md` | Audit, corrections et pistes d'amélioration |
| `docs/GUIDE_AJUSTEMENT.md` | Guide de réglage du modèle |
