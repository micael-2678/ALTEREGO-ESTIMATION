# 🔧 Correction du Problème de Déploiement Dokploy

## ❌ Problème Rencontré
```
Lockfile not found.
ERROR: failed to build
```

## ✅ Solution Appliquée

### 1. Dockerfile Modifié
Le Dockerfile a été mis à jour pour **fonctionner même sans lockfile** :
- Si `yarn.lock` existe → utilise `yarn --frozen-lockfile`
- Si `package-lock.json` existe → utilise `npm ci`
- Si aucun lockfile → utilise `yarn install` (fallback)

### 2. Fichiers Ajoutés
- `.gitattributes` : S'assure que les lockfiles sont correctement gérés par Git

---

## 🚀 Actions à Faire pour Dokploy

### Option A : Redéployer Maintenant (Rapide)

Le Dockerfile corrigé va maintenant installer les dépendances même sans lockfile.

**Dans Dokploy** :
1. Allez sur votre application AlterEgo
2. Cliquez sur "Redeploy" ou "Rebuild"
3. ✅ Le build devrait maintenant fonctionner !

### Option B : Commit le yarn.lock (Recommandé pour Production)

Pour des builds plus rapides et reproductibles :

```bash
# Sur votre machine locale (ou via l'interface GitHub)
cd /chemin/vers/votre/repo

# Vérifier que yarn.lock existe
ls -la yarn.lock

# Si yarn.lock n'existe pas, le générer
yarn install

# Commit et push
git add yarn.lock .gitattributes Dockerfile
git commit -m "fix: Add yarn.lock and fix Dockerfile for deployment"
git push origin main
```

Ensuite dans Dokploy : Redeploy

---

## 📋 Variables d'Environnement Dokploy

N'oubliez pas de configurer dans Dokploy :

```env
MONGO_URL=mongodb://votre-mongo-url:27017/alterego_db
NEXT_PUBLIC_BASE_URL=https://votre-domaine.com
JWT_SECRET=un-secret-tres-long-et-securise-32-caracteres-minimum
ADMIN_USERNAME=admin
ADMIN_PASSWORD=VotreMotDePasseSecurise123!
NODE_ENV=production
```

### 🗄️ MongoDB

Si vous n'avez pas encore MongoDB configuré :

**Dans Dokploy** :
1. Créez un service MongoDB
2. Notez l'URL interne : `mongodb://mongodb:27017/alterego_db`
3. Ajoutez-la dans les variables d'environnement de votre app

**OU utilisez MongoDB Atlas** (gratuit) :
1. [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Créez un cluster gratuit
3. Copiez l'URL : `mongodb+srv://user:pass@cluster.mongodb.net/alterego_db`

---

## 🧪 Test après Déploiement

1. **API Health Check** : `https://votre-domaine.com/api/`
2. **Page d'accueil** : `https://votre-domaine.com/`
3. **Admin Panel** : `https://votre-domaine.com/admin`

---

## 🆘 Si Ça Ne Fonctionne Toujours Pas

Vérifiez les logs Dokploy pour voir l'erreur exacte :

```bash
# Dans Dokploy, section "Logs"
# Ou via CLI dokploy
dokploy logs alterego-estimation
```

Erreurs communes :
- **Port 3000 déjà utilisé** → Vérifier la config des ports dans Dokploy
- **MONGO_URL invalide** → Vérifier la connexion MongoDB
- **Variables d'env manquantes** → Vérifier toutes les vars sont définies
