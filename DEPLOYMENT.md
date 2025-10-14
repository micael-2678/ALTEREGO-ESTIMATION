# 🚀 Guide de Déploiement - AlterEgo

## 📦 Fichiers de Déploiement

Tous les fichiers nécessaires sont créés :

```
/app/
├── Dockerfile              ← Configuration Docker
├── docker-compose.yml      ← Orchestration avec MongoDB
├── .dockerignore          ← Optimisation du build
└── .env.example           ← Template des variables d'environnement
```

## 🐳 Déploiement avec Docker

### Option 1 : Docker Compose (Recommandé)

Le plus simple avec MongoDB inclus :

```bash
# 1. Copier les variables d'environnement
cp .env.example .env

# 2. Éditer .env et configurer vos valeurs
nano .env

# 3. Lancer avec Docker Compose
docker-compose up -d

# 4. Voir les logs
docker-compose logs -f

# 5. Arrêter
docker-compose down
```

### Option 2 : Docker seul

Si vous avez déjà MongoDB ailleurs :

```bash
# 1. Build l'image
docker build -t alterego-app .

# 2. Lancer le container
docker run -d \
  --name alterego \
  -p 3000:3000 \
  -e MONGO_URL="mongodb://votre-mongo:27017/alterego_db" \
  -e NEXT_PUBLIC_BASE_URL="https://votre-domaine.com" \
  -e JWT_SECRET="votre-secret-jwt" \
  -e ADMIN_USERNAME="admin" \
  -e ADMIN_PASSWORD="votre-mot-de-passe" \
  alterego-app

# 3. Voir les logs
docker logs -f alterego
```

## ☁️ Déploiement sur Platforms Cloud

### Vercel (Recommandé pour Next.js)

```bash
# Installer Vercel CLI
npm i -g vercel

# Déployer
vercel

# Configurer les variables d'environnement dans le dashboard Vercel
# - MONGO_URL
# - JWT_SECRET
# - ADMIN_USERNAME
# - ADMIN_PASSWORD
```

### Railway

```bash
# 1. Installer Railway CLI
npm i -g @railway/cli

# 2. Login
railway login

# 3. Initialiser
railway init

# 4. Ajouter MongoDB
railway add

# 5. Déployer
railway up
```

### Render

1. Connecter votre repo GitHub
2. Choisir "Web Service"
3. Build Command: `yarn install && yarn build`
4. Start Command: `yarn start`
5. Ajouter les variables d'environnement

### AWS / Azure / GCP

Utiliser le Dockerfile fourni avec leurs services de container :
- AWS ECS/Fargate
- Azure Container Instances
- Google Cloud Run

## 🗄️ Base de Données MongoDB

### MongoDB Atlas (Cloud - Gratuit jusqu'à 512MB)

1. Créer un compte sur [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Créer un cluster gratuit
3. Obtenir l'URL de connexion : `mongodb+srv://user:pass@cluster.mongodb.net/alterego_db`
4. Configurer dans `.env` : `MONGO_URL=mongodb+srv://...`

### MongoDB Local

```bash
# Avec Docker
docker run -d -p 27017:27017 --name mongodb mongo:7

# URL : mongodb://localhost:27017/alterego_db
```

## 🔐 Variables d'Environnement

**OBLIGATOIRES** :

```env
MONGO_URL=mongodb://...                      # URL MongoDB
NEXT_PUBLIC_BASE_URL=https://votre-site.com  # URL publique
JWT_SECRET=votre-secret-tres-long            # Secret JWT (32+ caractères)
ADMIN_USERNAME=admin                         # Login admin
ADMIN_PASSWORD=VotreMotDePasse123            # Mot de passe admin
```

**OPTIONNELLES** :

```env
NODE_ENV=production
PORT=3000
```

## 📊 Ingestion des Données DVF

Après le déploiement, ingérer les données DVF :

```bash
# Via Docker Compose
docker-compose exec app node scripts/ingest-all-france.js

# Via Docker seul
docker exec alterego node scripts/ingest-all-france.js

# Local
node scripts/ingest-all-france.js
```

## 🔍 Vérification du Déploiement

1. **Santé de l'API** : `curl https://votre-site.com/api/`
2. **Admin Panel** : `https://votre-site.com/admin`
3. **Estimation** : `https://votre-site.com/`

## 🛠️ Maintenance

### Backup MongoDB

```bash
# Docker Compose
docker-compose exec mongodb mongodump --out /backup

# Copier le backup
docker cp alterego-mongodb-1:/backup ./backup-$(date +%Y%m%d)
```

### Mise à jour de l'application

```bash
# Docker Compose
docker-compose pull
docker-compose up -d --build

# Vercel
vercel --prod
```

## 📝 Support

- **Logs** : `docker-compose logs -f app`
- **Restart** : `docker-compose restart app`
- **Shell** : `docker-compose exec app sh`

---

🎉 **Votre application AlterEgo est prête à être déployée !**
