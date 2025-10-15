# 🎯 Auto-Chargement des Données DVF au Démarrage

## ✅ Solution Implémentée

L'application charge maintenant **automatiquement** les données DVF au premier démarrage si MongoDB est vide !

---

## 🚀 Comment Activer l'Auto-Chargement

### Dans Dokploy - Variables d'Environnement

Ajoutez cette variable dans l'onglet **"Environment"** de votre application :

```env
AUTO_LOAD_DVF=true
```

### Options de Configuration

#### Option 1 : Toute la France (Recommandé)
```env
AUTO_LOAD_DVF=true
# Pas de DVF_DEPARTMENTS = charge toute la France (914k transactions)
# Durée : 2-4 heures en arrière-plan
```

#### Option 2 : Paris Uniquement (Test Rapide)
```env
AUTO_LOAD_DVF=true
DVF_DEPARTMENTS=75
# Durée : ~10 minutes
```

#### Option 3 : Île-de-France
```env
AUTO_LOAD_DVF=true
DVF_DEPARTMENTS=75,77,78,91,92,93,94,95
# Durée : ~30 minutes
```

#### Option 4 : Départements Personnalisés
```env
AUTO_LOAD_DVF=true
DVF_DEPARTMENTS=75,13,33,69,59
# Paris, Marseille, Bordeaux, Lyon, Lille
```

---

## 📋 Workflow de Déploiement

### Étape 1 : Configurer les Variables d'Environnement

Dans Dokploy, ajoutez ces variables :

```env
# MongoDB (fourni par Dokploy)
MONGO_URL=mongodb://mongo:PASSWORD@SERVICE:27017
DB_NAME=alterego_db

# Application
NEXT_PUBLIC_BASE_URL=https://app.alteregopatrimoine.com
JWT_SECRET=votre-secret-jwt-32-caracteres-minimum
ADMIN_USERNAME=Micael
ADMIN_PASSWORD=Micael123
NODE_ENV=production
PORT=3000
HOSTNAME=0.0.0.0
CORS_ORIGINS=*

# ✅ NOUVEAU : Auto-chargement DVF
AUTO_LOAD_DVF=true
DVF_DEPARTMENTS=75
# OU laisser vide pour toute la France
```

### Étape 2 : Redéployer

1. Cliquez sur **"Deploy"** dans Dokploy
2. L'application va :
   - ✅ Se builder avec le nouveau Dockerfile
   - ✅ Démarrer
   - ✅ Vérifier si MongoDB contient des données DVF
   - ✅ Si vide : Charger automatiquement les données
   - ✅ Lancer l'application Next.js

### Étape 3 : Suivre la Progression

**Dans les logs Dokploy :**

Vous verrez ces messages :

```
🚀 AlterEgo - Vérification des données DVF...
==================================================
⏳ Attente de la disponibilité de MongoDB...
✅ MongoDB est prêt

📊 Vérification de la présence des données DVF...
   Nombre de transactions DVF actuelles : 0

⚠️  Aucune donnée DVF trouvée dans MongoDB

✅ AUTO_LOAD_DVF=true détecté
🚀 Lancement du chargement automatique des données DVF...

📍 Chargement de toute la France (cela peut prendre 2-4 heures)
   Vous pouvez suivre la progression dans les logs de l'application

✅ Ingestion lancée en arrière-plan
==================================================
✅ Initialisation terminée - Démarrage de l'application

🌐 Démarrage de l'application Next.js...
```

### Étape 4 : Vérifier que les Données Sont Chargées

**Option A : Via l'API**
```bash
curl https://app.alteregopatrimoine.com/api/dvf/stats
```

**Option B : Via le terminal Dokploy**
```bash
# Accéder au conteneur
docker exec -it <container_name> sh

# Vérifier
node scripts/check-dvf-data.js
```

**Option C : Tester une estimation**
```bash
curl -X POST https://app.alteregopatrimoine.com/api/estimate \
  -H "Content-Type: application/json" \
  -d '{
    "address": "2 rue des Italiens, 75009 Paris",
    "lat": 48.8719,
    "lng": 2.3361,
    "type": "appartement",
    "surface": 50,
    "characteristics": {"floor": "1-3", "standing": 3}
  }'
```

Si vous voyez des données dans la réponse → ✅ C'est bon !

---

## 🔄 Comportement du Script d'Initialisation

### Au Premier Démarrage (MongoDB vide)
1. ✅ Attente que MongoDB soit prêt
2. ✅ Vérifie le nombre de documents dans `dvf_sales`
3. ✅ Si 0 documents ET `AUTO_LOAD_DVF=true` → Lance l'ingestion
4. ✅ Ingestion en arrière-plan (n'empêche pas l'app de démarrer)
5. ✅ Démarre l'application Next.js

### Aux Redémarrages Suivants (MongoDB a déjà des données)
1. ✅ Vérifie le nombre de documents
2. ✅ Trouve des documents → Skip l'ingestion
3. ✅ Démarre immédiatement l'application

---

## 📝 Modifications Apportées

### 1. **`scripts/init-dvf-on-startup.sh`** 🆕
Script qui :
- Vérifie la connexion MongoDB
- Compte les documents DVF existants
- Lance l'ingestion si nécessaire
- Supporte plusieurs configurations

### 2. **`docker-entrypoint.sh`** 🆕
Point d'entrée Docker qui :
- Exécute le script d'initialisation
- Lance l'application Next.js

### 3. **`Dockerfile`** ✅
Modifié pour :
- Copier les scripts d'ingestion dans l'image
- Copier les libs nécessaires
- Utiliser le nouvel entrypoint
- Rendre les scripts exécutables

### 4. **`docker-compose.yml`** ✅
Déjà configuré avec :
- Labels Traefik persistants
- Réseau `dokploy-network`
- Variables d'environnement flexibles

---

## ⏱️ Temps de Chargement

| Configuration | Transactions | Durée |
|--------------|--------------|-------|
| Paris (75) | ~27,000 | 5-10 min |
| Île-de-France | ~140,000 | 20-30 min |
| Top 10 villes | ~200,000 | 30-45 min |
| Toute la France | 914,000 | 2-4 heures |

⚠️ **Note :** L'ingestion se fait **en arrière-plan**, l'application démarre immédiatement.

---

## 🆘 Dépannage

### L'ingestion ne démarre pas

**Vérifiez les logs :**
```bash
docker logs -f <container_name>
```

**Vérifiez les variables d'environnement :**
```bash
docker exec <container_name> printenv | grep AUTO_LOAD_DVF
```

### MongoDB n'est pas accessible

**Erreur :** `❌ Impossible de se connecter à MongoDB`

**Solution :**
- Vérifiez que le service MongoDB Dokploy est démarré
- Vérifiez que `MONGO_URL` est correct dans les variables d'environnement
- Vérifiez que les deux services sont sur le même réseau Docker

### L'ingestion prend trop de temps

C'est normal ! 914,000 transactions = 2-4 heures.

**Solutions :**
1. Utilisez `DVF_DEPARTMENTS=75` pour tester rapidement
2. Une fois validé, chargez toute la France
3. Suivez les logs pour voir la progression

### Forcer un rechargement

Si vous voulez recharger les données :

```bash
# Supprimer les données existantes
docker exec <container_name> sh -c "
echo 'db.dvf_sales.deleteMany({})' | mongosh \$MONGO_URL/alterego_db
"

# Redémarrer le conteneur (relance l'ingestion)
docker restart <container_name>
```

---

## ✅ Checklist de Déploiement

- [ ] Variables d'environnement configurées (MONGO_URL, etc.)
- [ ] `AUTO_LOAD_DVF=true` ajouté
- [ ] `DVF_DEPARTMENTS` configuré (optionnel)
- [ ] Application redéployée depuis Dokploy
- [ ] Logs vérifiés (ingestion lancée)
- [ ] Attendre 10 min (Paris) ou 2-4h (France)
- [ ] Tester une estimation sur le site
- [ ] ✅ Les valeurs apparaissent !

---

## 🎉 Avantages de Cette Solution

✅ **Automatique** : Pas besoin d'intervention manuelle
✅ **Intelligent** : Ne charge que si MongoDB est vide
✅ **Non-bloquant** : L'application démarre immédiatement
✅ **Flexible** : Configuré via variables d'environnement
✅ **Persistant** : Les données restent après redémarrage
✅ **Testé** : Script avec gestion d'erreurs et retries

---

## 📞 Support

Si vous rencontrez des problèmes :
1. Consultez les logs : `docker logs -f <container_name>`
2. Vérifiez les variables d'environnement
3. Testez la connexion MongoDB
4. Référez-vous à `FIX_IMMEDIAT_DOKPLOY.md` pour chargement manuel

🎯 **Avec cette solution, votre application sera opérationnelle dès le premier démarrage !**
