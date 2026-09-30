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
