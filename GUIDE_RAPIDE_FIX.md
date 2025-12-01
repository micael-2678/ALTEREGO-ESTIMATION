# 🎯 GUIDE RAPIDE - Fix MongoDB en 3 Minutes

## Le Problème
✅ Votre code est correct  
❌ La configuration Dokploy n'est PAS à jour

## La Solution (3 clics)

### 1️⃣ Ouvrir Dokploy
- Allez sur votre dashboard Dokploy
- Cliquez sur votre application "alterego-estimation"

### 2️⃣ Modifier la variable MONGO_URL  
- Allez dans l'onglet **"Environment"** ou **"Settings" > "Environment Variables"**
- Trouvez `MONGO_URL`
- Remplacez par:
```
mongodb://mongo:ungjjv3llz1dqst0@alterego-estimation-mongodbalterego-w4vqu9:27017
```
- Cliquez **"Save"**

### 3️⃣ Redéployer
- Cliquez sur le bouton **"Deploy"** ou **"Redeploy"**
- Attendez 2-3 minutes

## ✅ Vérification Rapide

Testez cette URL dans votre navigateur:
```
https://google-ads-setup.preview.emergentagent.com/test-mongo
```

Si vous voyez **~850,000 documents** → ✅ C'EST BON !

Ensuite testez une estimation sur:
```
https://google-ads-setup.preview.emergentagent.com
```

---

## 🔍 Pourquoi ça marche pas maintenant?

L'application cherche MongoDB à `alterego-estimation-mongodbalterego-w4vqu9` mais Dokploy a toujours l'ancienne config `localhost:27017`.

Une fois la variable mise à jour et l'app redéployée, le réseau Docker interne permettra la connexion.

---

**C'est tout !** Une fois ces 3 étapes faites, votre application fonctionnera avec les 850k transactions DVF déjà chargées.
