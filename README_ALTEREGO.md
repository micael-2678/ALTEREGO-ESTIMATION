# AlterEgo — Estimation & Marché Actif

Application web d'estimation immobilière basée sur les données DVF (Demandes de Valeurs Foncières) et le marché actif.

## 🎯 Fonctionnalités

### Pour les utilisateurs
- **Estimation gratuite en 3 minutes** : Obtenez une estimation de votre bien immobilier
- **Données DVF** : Comparaison avec les ventes réelles enregistrées par l'État français
- **Marché actif** : Analyse des annonces actuellement en ligne (SeLoger)
- **Carte interactive** : Visualisation des comparables sur une carte Leaflet
- **Statistiques détaillées** :
  - Moyenne et médiane €/m²
  - Moyenne pondérée (proximité + récence)
  - Indice de confiance (0-100)
  - Delta marché vs DVF
- **Génération de leads** : Formulaire pour recevoir un rapport détaillé

### Pour les administrateurs
- **Panneau d'administration** : `/admin`
- **Gestion des leads** : Consultation et export CSV
- **Authentification sécurisée** : JWT avec identifiants configurables

## 🏗️ Architecture

### Frontend
- **Framework** : Next.js 14.2.3
- **UI** : Tailwind CSS + shadcn/ui
- **Carte** : Leaflet + react-leaflet
- **Design** : Noir et blanc, mobile-first

### Backend
- **API** : Next.js API Routes
- **Base de données** : MongoDB
- **Authentification** : JWT (jsonwebtoken)
- **Scraping** : Puppeteer (SeLoger)

### Intégrations
- **API BAN** : Géocodage d'adresses françaises (api-adresse.data.gouv.fr)
- **DVF Open Data** : Données gouvernementales des ventes immobilières
- **SeLoger** : Scraping des annonces actives

## 🚀 Installation & Déploiement

### Prérequis
- Node.js 18+
- MongoDB 6+
- Yarn

### Installation des dépendances
```bash
cd /app
yarn install
```

### Configuration (.env)
```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=alterego_db
JWT_SECRET=alterego-secret-key-2025
ADMIN_USERNAME=Micael
ADMIN_PASSWORD=Micael123
NEXT_PUBLIC_BASE_URL=https://estate-data-fix.preview.emergentagent.com
```

### Peupler les données DVF (sample)
```bash
node scripts/populate-dvf-sample.js
```

### Lancer l'application
```bash
yarn dev
```

L'application sera disponible sur http://localhost:3000

## 📊 Données DVF

### Format des données
Les données DVF contiennent les informations suivantes :
- Date de mutation
- Adresse (numéro, type de voie, nom de voie, code postal, commune)
- Type de bien (Appartement / Maison)
- Surface réelle bâtie (m²)
- Nombre de pièces principales
- Valeur foncière (€)
- Coordonnées GPS (latitude, longitude)

### Import de vraies données DVF
Pour importer les données DVF officielles :

1. Télécharger les fichiers CSV sur https://www.data.gouv.fr/fr/datasets/demandes-de-valeurs-foncieres/
2. Créer un script d'import similaire à `populate-dvf-sample.js`
3. Parser le CSV et insérer dans MongoDB

Exemple :
```javascript
const { parse } = require('csv-parse/sync');
const fs = require('fs');
const { getCollection } = require('../lib/mongodb');

const csvContent = fs.readFileSync('valeursfoncieres-2024.csv', 'utf-8');
const records = parse(csvContent, { columns: true });
// ... filtrer et insérer
```

## 🔐 Authentification Admin

### Connexion
- URL : https://estate-data-fix.preview.emergentagent.com/admin
- Identifiant : **Micael**
- Mot de passe : **Micael123**

### Sécurité
- Les identifiants sont configurables via variables d'environnement
- JWT avec expiration 24h
- Token stocké dans localStorage côté client

## 📡 API Endpoints

### Public

#### GET /api/
Health check de l'API

#### GET /api/geo/resolve
Géocodage d'adresse via API BAN
```
?address=2 rue des italiens, 75009 Paris
```

#### POST /api/estimate
Estimation complète (DVF + Marché)
```json
{
  "address": "2 rue des italiens, 75009 Paris",
  "lat": 48.8712,
  "lng": 2.3378,
  "type": "appartement",
  "surface": 85
}
```

#### GET /api/dvf/comparables
Récupérer les ventes DVF comparables
```
?lat=48.8712&lng=2.3378&type=appartement&surface=85&radiusMeters=1000&months=24
```

#### GET /api/market/listings
Récupérer les annonces actives
```
?address=...&lat=...&lng=...&type=...&surface=...
```

#### POST /api/leads
Soumettre un lead
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "0612345678",
  "consent": true,
  "property": {...},
  "estimation": {...}
}
```

### Protégé (Admin)

#### POST /api/auth/login
Authentification admin
```json
{
  "username": "Micael",
  "password": "Micael123"
}
```

#### GET /api/leads
Récupérer tous les leads (requiert token JWT)
```
Authorization: Bearer <token>
```

## 🧮 Algorithme d'estimation

### 1. Filtrage des comparables DVF
- **Proximité géographique** : Rayon configurable (défaut : 1000m)
- **Type de bien** : Appartement ou Maison
- **Surface similaire** : ±30% de la surface cible
- **Période récente** : Fenêtre temporelle configurable (défaut : 24 mois)

### 2. Calculs statistiques
- **Moyenne** : Prix moyen au m²
- **Médiane** : Prix médian au m²
- **Écart-type** : Dispersion des prix
- **Moyenne pondérée** :
  - 60% poids proximité (plus proche = plus de poids)
  - 40% poids récence (plus récent = plus de poids)

### 3. Indice de confiance (0-100)
- **40 points** : Nombre de comparables (max 10)
- **30 points** : Proximité du comparable le plus proche
- **30 points** : Récence des données

### 4. Comparaison marché actif
- **Delta** : Écart en % entre marché actif et DVF
- **Prix conseillé** : Médiane du marché actif × surface

## 🗺️ Carte interactive

### Marqueurs
- **Rouge** : Bien à estimer (centre)
- **Bleu** : Ventes DVF
- **Vert** : Annonces actives

### Cercle de recherche
- Rayon : 1000m (configurable)
- Affichage des distances

### Popups
Chaque marqueur affiche :
- Adresse (approximative pour DVF)
- Prix et surface
- Prix au m²
- Date de vente (DVF) ou lien vers l'annonce (marché)

## 🎨 Design

### Palette de couleurs
- **Noir** : Texte principal, boutons primaires
- **Blanc** : Arrière-plans
- **Gris** : Bordures, textes secondaires
- **Bleu** : DVF
- **Vert** : Marché actif
- **Rouge** : Bien cible

### Typographie
- Police principale : Inter (via Tailwind)
- Hiérarchie claire : H1, H2, Body

### Composants
- Cartes avec ombres subtiles
- Boutons noirs avec hover
- Inputs avec focus states
- Tables responsives

## 🐛 Limitations connues

### SeLoger Scraping
- **Environnement conteneurisé** : Puppeteer peut échouer dans certains environnements (notamment Kubernetes)
- **Solution** : L'API gère l'erreur gracieusement et retourne un tableau vide
- **Alternative** : Utiliser une API officielle SeLoger (payante) ou un service de scraping externe

### Données DVF
- **Adresses approximatives** : Le numéro de rue est masqué dans les données DVF publiques
- **Géolocalisation** : Certaines ventes peuvent avoir des coordonnées imprécises
- **Fraîcheur** : Les données DVF ont un délai de publication (~6 mois)

## 📝 TODO / Améliorations futures

### Court terme
- [ ] Génération de rapports PDF (jsPDF ou Puppeteer)
- [ ] Email automatique avec rapport
- [ ] Plus de filtres (année construction, étage, etc.)
- [ ] Graphiques d'évolution des prix

### Moyen terme
- [ ] Import automatique des données DVF
- [ ] Intégration d'autres sites d'annonces (LeBonCoin, Logic-Immo)
- [ ] API publique avec rate limiting
- [ ] Dashboard analytics pour admin

### Long terme
- [ ] Machine Learning pour affiner les estimations
- [ ] Prédiction d'évolution des prix
- [ ] Comparaison quartier par quartier
- [ ] Application mobile

## 📄 Licence

Propriétaire - AlterEgo © 2025

## 👥 Support

Pour toute question ou support :
- Email : support@alterego-immo.fr
- Documentation : Ce fichier README

---

**Développé avec ❤️ par Emergent AI**
