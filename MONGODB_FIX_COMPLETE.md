# ✅ FIX MONGODB - Configuration Corrigée

## 🎯 Problème Résolu

**Symptôme initial:** 
- `MongoServerError: Authentication failed` lors de la lecture des données DVF
- Import réussi (~850k documents) mais lecture impossible

**Cause identifiée:**
- `.env` utilisait `mongodb://localhost:27017` au lieu des credentials Dokploy
- Pas d'authentification configurée dans l'URL de connexion

## 🔧 Changements Effectués

### 1. Correction du MONGO_URL dans `/app/.env`

**AVANT:**
```
MONGO_URL=mongodb://localhost:27017
```

**APRÈS:**
```
MONGO_URL=mongodb://mongo:ungjjv3llz1dqst0@alterego-estimation-mongodbalterego-w4vqu9:27017
```

### 2. Ajout d'outils de test

**Endpoint API de test:** `/api/test-mongo`
- Teste la connexion MongoDB
- Compte les documents DVF
- Récupère un exemple de transaction

**Page de test visuelle:** `/test-mongo`
- Interface utilisateur pour tester la connexion
- Affiche les statistiques de la base de données
- Montre un exemple de donnée DVF

## 📋 Instructions de Déploiement sur Dokploy

### Étape 1: Mettre à jour les variables d'environnement

Dans **Dokploy → Votre Application → Environment Variables**, ajoutez ou modifiez :

```env
MONGO_URL=mongodb://mongo:ungjjv3llz1dqst0@alterego-estimation-mongodbalterego-w4vqu9:27017
DB_NAME=alterego_db
NEXT_PUBLIC_BASE_URL=https://verif-portable.preview.emergentagent.com
CORS_ORIGINS=*
JWT_SECRET=alterego-secret-key-2025
ADMIN_USERNAME=Micael
ADMIN_PASSWORD=Micael123
```

⚠️ **IMPORTANT:** La variable `MONGO_URL` doit utiliser le hostname interne Docker `alterego-estimation-mongodbalterego-w4vqu9`, pas `localhost` ou l'IP publique.

### Étape 2: Déployer l'application

Dans Dokploy:
1. Cliquez sur **"Deploy"** (ou "Redeploy")
2. Attendez la fin du build et déploiement
3. L'application redémarrera avec la nouvelle configuration

### Étape 3: Tester la connexion

Une fois déployé, testez avec:

**Option A - Page de test visuelle:**
```
https://verif-portable.preview.emergentagent.com/test-mongo
```
Cliquez sur "Tester la connexion" et vérifiez:
- ✅ Connexion réussie
- ✅ Nombre de documents (devrait afficher ~850,000+)
- ✅ Exemple de transaction DVF

**Option B - API directe:**
```bash
curl https://verif-portable.preview.emergentagent.com/api/test-mongo
```

### Étape 4: Tester une estimation réelle

Allez sur la page principale et testez une estimation avec une adresse réelle.

## 🔍 Vérification Post-Déploiement

### Si ça fonctionne ✅
Vous devriez voir:
- Count: ~850,000+ documents
- Exemple de transaction avec commune, prix, surface, etc.
- Les estimations immobilières fonctionnent

### Si ça échoue ❌

**Erreur: "getaddrinfo ENOTFOUND"**
- Vérifiez que l'application et MongoDB sont dans le même réseau Docker
- Dans Dokploy, vérifiez que les services sont dans le même "Projet"

**Erreur: "Authentication failed"**
- Vérifiez que MONGO_URL contient bien les credentials
- Format: `mongodb://USER:PASSWORD@HOST:27017`

**Erreur: "connect ECONNREFUSED"**
- Le hostname MongoDB est incorrect
- Utilisez le nom du service Docker interne (pas localhost ou IP publique)

## 🎉 Résultat Attendu

Une fois déployé sur Dokploy avec la bonne configuration réseau Docker, l'application devrait:

1. ✅ Se connecter à MongoDB avec authentification
2. ✅ Accéder aux 850,000+ documents DVF
3. ✅ Générer des estimations immobilières basées sur les comparables
4. ✅ Afficher les transactions similaires sur la carte

## 📞 Support

Si le problème persiste après déploiement sur Dokploy:
- Vérifiez les logs Docker: `docker logs <container-id>`
- Testez depuis le terminal Dokploy: "Open Terminal"
- Vérifiez la configuration réseau dans le docker-compose.yml généré par Dokploy

---

**Date:** $(date)
**Status:** Configuration corrigée - En attente de déploiement sur Dokploy
