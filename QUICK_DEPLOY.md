# 🚀 Déploiement Rapide sur Dokploy - AlterEgo

## ✅ Problèmes Résolus

1. ✅ **Lockfile manquant** → Dockerfile modifié pour utiliser `yarn install` en fallback
2. ✅ **MONGO_URL au build** → Code modifié pour vérifier MongoDB seulement au runtime

## 📋 Checklist Avant Déploiement

- [x] Dockerfile optimisé
- [x] Code MongoDB corrigé (runtime uniquement)
- [x] package.json avec scripts build/start
- [x] .dockerignore configuré
- [x] .gitignore configuré
- [x] Build local testé avec succès ✅

## 🔧 Étapes de Déploiement sur Dokploy

### 1️⃣ Push sur GitHub

```bash
# Vérifier les modifications
git status

# Ajouter tous les fichiers importants
git add Dockerfile .dockerignore .gitattributes lib/mongodb.js BUILD_FIX.md

# Commit
git commit -m "fix: Docker build and MongoDB runtime configuration"

# Push
git push origin main
```

### 2️⃣ Configuration MongoDB dans Dokploy

**Option A : Service MongoDB Dokploy**
1. Dans Dokploy → Créer un nouveau service "MongoDB"
2. Noter l'URL interne : `mongodb://mongodb:27017`

**Option B : MongoDB Atlas (Cloud Gratuit)**
1. Aller sur [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Créer un cluster gratuit (512MB)
3. Créer un utilisateur de base de données
4. Obtenir l'URL : `mongodb+srv://user:pass@cluster.mongodb.net/alterego_db`
5. Ajouter `0.0.0.0/0` aux IP autorisées (pour développement)

### 3️⃣ Variables d'Environnement Dokploy

Dans votre application Dokploy, configurer :

```env
# Base de données (REQUIS)
MONGO_URL=mongodb://votre-url:27017/alterego_db
# OU pour Atlas:
# MONGO_URL=mongodb+srv://user:pass@cluster.mongodb.net/alterego_db

# URL publique (REQUIS)
NEXT_PUBLIC_BASE_URL=https://votre-domaine.com

# Sécurité (REQUIS)
JWT_SECRET=votre-secret-jwt-minimum-32-caracteres-long-et-securise
ADMIN_USERNAME=admin
ADMIN_PASSWORD=MotDePasseSecurise123!

# Environnement
NODE_ENV=production
```

**⚠️ IMPORTANT** : Changez `JWT_SECRET` et `ADMIN_PASSWORD` !

### 4️⃣ Déployer

1. Dans Dokploy → Aller sur votre application
2. Cliquer sur **"Redeploy"** ou **"Rebuild"**
3. Attendre la fin du build (2-3 minutes)
4. ✅ Vérifier que le déploiement est réussi

### 5️⃣ Vérification Post-Déploiement

**Test 1 : API Health Check**
```bash
curl https://votre-domaine.com/api/
# Devrait retourner: {"message":"AlterEgo API is running","version":"2.0.0"}
```

**Test 2 : Page d'accueil**
- Ouvrir : `https://votre-domaine.com/`
- Devrait afficher le formulaire d'estimation

**Test 3 : Admin Panel**
- Ouvrir : `https://votre-domaine.com/admin`
- Se connecter avec ADMIN_USERNAME / ADMIN_PASSWORD
- Devrait afficher le dashboard admin

### 6️⃣ Ingestion des Données DVF (Optionnel)

Une fois l'application déployée, vous pouvez ingérer les données DVF :

**Via Dokploy Console** :
```bash
# Se connecter au container
dokploy exec alterego-estimation sh

# Lancer l'ingestion
node scripts/ingest-all-france.js
```

**Via API Admin** (à implémenter si besoin) :
```bash
curl -X POST https://votre-domaine.com/api/admin/dvf/ingest \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"departments": ["75", "92", "93"]}'
```

## 🎯 Résultat Attendu

- ✅ Build Docker réussi en 2-3 minutes
- ✅ Application accessible sur votre domaine
- ✅ Admin panel fonctionnel
- ✅ Estimations immobilières disponibles

## 🆘 En Cas de Problème

### Build échoue encore
```bash
# Vérifier les logs Dokploy
dokploy logs alterego-estimation

# Erreurs communes :
# - "Cannot connect to MongoDB" → Normal au build, vérifier les vars d'env
# - "Lockfile not found" → Vérifier que le Dockerfile est à jour
# - "Memory error" → Augmenter les ressources dans Dokploy
```

### Application ne démarre pas
```bash
# Vérifier les variables d'environnement
# Notamment MONGO_URL, JWT_SECRET, etc.

# Tester MongoDB
mongosh "mongodb://votre-url"
```

### Admin Panel : Login impossible
- Vérifier `ADMIN_USERNAME` et `ADMIN_PASSWORD` dans les variables d'env
- Vérifier que `JWT_SECRET` est défini

## 📚 Documentation Complète

- `DEPLOYMENT.md` - Guide complet de déploiement
- `DOKPLOY_FIX.md` - Résolution du problème lockfile
- `BUILD_FIX.md` - Résolution du problème MongoDB build
- `.env.example` - Variables d'environnement nécessaires

---

**🎉 Bon déploiement !**

Pour toute question ou problème, consultez les logs Dokploy ou les fichiers de documentation.
