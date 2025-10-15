# 🔧 Solution : Charger les Données DVF en Production Dokploy

## 🎯 Problème Identifié

✅ **En local (preview)** : 914,063 transactions DVF → estimations fonctionnent
❌ **En production (Dokploy)** : MongoDB vide → pas d'estimations

**Cause :** MongoDB sur Dokploy est un service séparé qui ne contient pas les données DVF.

---

## ✅ Solutions Proposées

### Option 1 : Charger les Données Directement en Production (RECOMMANDÉ)

**Étapes :**

1. **Déployez l'application sur Dokploy** (les labels Traefik sont maintenant persistants)

2. **Ouvrez le terminal de l'application dans Dokploy**
   - Dans Dokploy, allez sur votre application
   - Cliquez sur "Open Terminal" ou "Advanced" > "Terminal"

3. **Vérifiez que MongoDB est accessible**
   ```bash
   # Tester la connexion
   echo $MONGO_URL
   # Devrait afficher: mongodb://mongo:PASSWORD@SERVICE:27017
   ```

4. **Chargez les données DVF pour toute la France**
   ```bash
   node scripts/ingest-all-france.js
   ```
   
   ⏱️ **Durée estimée :** 2-4 heures pour toute la France
   
   **Alternative plus rapide (départements principaux uniquement) :**
   ```bash
   # Paris et Île-de-France
   node scripts/populate-dvf-sample.js --dept=75,77,78,91,92,93,94,95
   
   # Grandes villes
   node scripts/populate-dvf-sample.js --dept=13,33,59,69
   ```

5. **Vérifiez que les données sont chargées**
   ```bash
   node scripts/check-dvf-data.js
   ```
   
   Vous devriez voir :
   ```
   📊 Nombre total de transactions DVF : [nombre]
   ```

---

### Option 2 : Export/Import depuis Local vers Production

**A. Export depuis MongoDB Local**

```bash
# Sur votre machine locale
cd /app

# Export de la collection dvf_sales
mongodump --uri="mongodb://localhost:27017/alterego_db" \
  --collection=dvf_sales \
  --out=./dvf_export
  
# Créer une archive
tar -czf dvf_sales.tar.gz dvf_export/
```

**B. Transfert vers le serveur Dokploy**

```bash
# Via SCP (remplacez USER et SERVER)
scp dvf_sales.tar.gz ubuntu@vps-84005014.vps.ovh.net:/tmp/
```

**C. Import dans MongoDB Production**

```bash
# Connexion SSH au serveur
ssh ubuntu@vps-84005014.vps.ovh.net

# Décompresser
cd /tmp
tar -xzf dvf_sales.tar.gz

# Import dans MongoDB Dokploy
# Trouvez le nom du conteneur MongoDB
docker ps | grep mongo

# Import
docker exec -i <MONGO_CONTAINER_NAME> \
  mongorestore --uri="mongodb://mongo:PASSWORD@localhost:27017/alterego_db" \
  /tmp/dvf_export/alterego_db/dvf_sales.bson
```

---

### Option 3 : Script de Migration Automatique

**Créer un script de migration one-shot :**

```bash
# Dans le terminal Dokploy
node scripts/ingest-all-france.js > /tmp/ingestion.log 2>&1 &

# Suivre la progression
tail -f /tmp/ingestion.log
```

---

## 🚀 Vérification Post-Chargement

Une fois les données chargées, testez l'estimation :

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

**Réponse attendue :**
```json
{
  "dvf": {
    "comparables": [...],
    "stats": { "median": ..., "average": ... }
  },
  "finalPrice": {
    "mid": 450000,
    "low": 420000,
    "high": 480000,
    "confidence": "high"
  }
}
```

---

## 📊 Comparaison des Options

| Option | Durée | Complexité | Recommandation |
|--------|-------|-----------|----------------|
| **Option 1** : Ingestion directe | 2-4h | ⭐ Facile | ✅ **RECOMMANDÉ** |
| **Option 2** : Export/Import | 30min | ⭐⭐⭐ Moyenne | Pour données volumineuses |
| **Option 3** : Script automatique | 2-4h | ⭐⭐ Facile | Alternative à Option 1 |

---

## ⚠️ Points d'Attention

### 1. **Connexion MongoDB Dokploy**

Vérifiez que `MONGO_URL` dans les variables d'environnement Dokploy pointe vers le bon service :

```env
MONGO_URL=mongodb://mongo:ungjv3llz1dqst0@alterego-estimation-mongodbalterego-w4vqu9:27017
```

✅ Format : `mongodb://USER:PASSWORD@SERVICE_NAME:27017`

### 2. **Réseau Docker**

L'application doit être sur le même réseau Docker que MongoDB :
- ✅ `dokploy-network` configuré dans `docker-compose.yml`
- ✅ MongoDB Dokploy doit aussi être sur ce réseau

### 3. **Permissions MongoDB**

Assurez-vous que l'utilisateur MongoDB a les permissions d'écriture :

```bash
# Dans le terminal Dokploy
mongosh $MONGO_URL --eval "
  db.runCommand({
    grantPrivilegesToRole: 'readWrite',
    privileges: [
      { resource: { db: 'alterego_db', collection: '' }, actions: [ 'find', 'insert', 'update', 'remove' ] }
    ]
  })
"
```

---

## 🔄 Workflow Complet Recommandé

1. ✅ **Déployer l'application** (labels Traefik persistants ✓)
2. ✅ **Vérifier la connexion MongoDB** : `echo $MONGO_URL`
3. ✅ **Charger les données DVF** : `node scripts/ingest-all-france.js`
4. ✅ **Vérifier les données** : `node scripts/check-dvf-data.js`
5. ✅ **Tester l'estimation** : `curl POST /api/estimate`
6. 🎉 **Application fonctionnelle** avec estimations !

---

## 💡 Astuces

### Chargement Progressif

Si vous voulez tester rapidement avant de charger toute la France :

```bash
# 1. Charger Paris uniquement (test rapide - 5 min)
node scripts/populate-dvf-sample.js --dept=75

# 2. Tester l'estimation sur Paris
# Si ça fonctionne...

# 3. Charger toute la France
node scripts/ingest-all-france.js
```

### Suivi de la Progression

```bash
# Lancer en arrière-plan avec log
nohup node scripts/ingest-all-france.js > /tmp/ingestion.log 2>&1 &

# Suivre en temps réel
tail -f /tmp/ingestion.log
```

---

## 🆘 Dépannage

### Erreur : "Cannot connect to MongoDB"
- Vérifiez `MONGO_URL` dans les variables d'environnement
- Vérifiez que MongoDB Dokploy est démarré
- Testez : `mongosh $MONGO_URL --eval "db.stats()"`

### Erreur : "Permission denied"
- L'utilisateur MongoDB n'a pas les permissions d'écriture
- Vérifiez les credentials dans `MONGO_URL`

### L'ingestion est trop lente
- C'est normal ! 914k transactions = 2-4 heures
- Utilisez Option 2 (Export/Import) pour plus de rapidité

---

## ✅ Checklist Finale

- [ ] Application déployée sur Dokploy (labels Traefik ✓)
- [ ] Variables d'environnement configurées (MONGO_URL, etc.)
- [ ] MongoDB Dokploy accessible depuis l'application
- [ ] Données DVF chargées (Option 1, 2 ou 3)
- [ ] Vérification : `node scripts/check-dvf-data.js` ✓
- [ ] Test d'estimation : `curl POST /api/estimate` ✓
- [ ] Application fonctionnelle sur https://app.alteregopatrimoine.com 🎉

---

**🎯 Résumé : Le problème n'est PAS les labels Traefik (résolu), mais l'absence de données DVF dans MongoDB production. Solution : charger les données avec Option 1.**
