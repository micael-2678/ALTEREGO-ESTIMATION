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

`docker-compose.yml` porte lui-même le routage Traefik vers `app.alteregopatrimoine.com`
(HTTPS + redirection HTTP → HTTPS). Si le site répond **« 404 page not found »** :

1. **Étiquettes Traefik absentes** : elles doivent être sous `labels:` au niveau du service
   (celles sous `deploy:` ne sont lues qu'en mode Swarm). Vérifier sur le serveur :
   `docker inspect <conteneur> --format '{{json .Config.Labels}}' | grep traefik`
2. **Traefik trop ancien pour Docker 29+** : Traefik < 3.6 ne peut plus lire Docker et
   répond 404 à toutes les applications. Vérifier :
   `docker logs dokploy-traefik 2>&1 | grep "too old"` — si le message apparaît, mettre
   Traefik à jour en v3.6 ou plus récent (image `traefik:v3.6`).
3. **Réseau** : le service doit être sur le réseau externe `dokploy-network`.

Les scripts d'import DVF fonctionnent dans le conteneur :
`docker exec -it <conteneur> node scripts/ingest-dvf.js 75`.

## Configuration

Voir `.env.example`. Sans `JWT_SECRET`, `ADMIN_USERNAME` et `ADMIN_PASSWORD`,
l'administration est désactivée.

## Organisation du code

| Dossier | Contenu |
|---|---|
| `app/page.js` | Tunnel d'estimation (charte AlterEgo 2026) |
| `app/api/[[...path]]/route.js` | API : géocodage, OTP, leads, estimation, admin |
| `lib/dvf-enhanced.js` | Recherche adaptative des ventes comparables |
| `lib/dvf-adjustments.js` | Ajustements (étage, DPE, vue…), confiance et fourchette |
| `lib/config-adjustments.js` | **Tous les réglages du modèle** (poids, bornes, calibrage) |
| `lib/dvf-ingestion.js` | Import des fichiers DVF |
| `docs/AUDIT_2026.md` | Audit, corrections et pistes d'amélioration |
| `docs/GUIDE_AJUSTEMENT.md` | Guide de réglage du modèle |
