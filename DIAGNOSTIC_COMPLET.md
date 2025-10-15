# 🔍 Diagnostic Complet - Pourquoi les Estimations Ne S'Affichent Pas

## Problème Actuel
✅ L'application est accessible sur https://app.alteregopatrimoine.com  
✅ La page d'estimation s'affiche  
❌ **MAIS aucune valeur d'estimation n'apparaît**

**Cause : MongoDB production est VIDE (0 transactions DVF)**

---

## ✅ Vérifications à Faire sur le Serveur

### 1. Vérifier que le Conteneur Tourne

```bash
ssh ubuntu@vps-84005014.vps.ovh.net
docker ps | grep alterego
```

**Résultat attendu :** Vous devez voir un conteneur avec status "Up"

---

### 2. Vérifier que les Fichiers de Données Existent dans le Conteneur

```bash
# Remplacez <CONTAINER_ID> par l'ID trouvé ci-dessus
docker exec <CONTAINER_ID> ls -la /app/data/
```

**Résultat attendu :**
```
drwxr-xr-x    2 nextjs   nodejs        4096 dvf_paris_10k.json
-rw-r--r--    1 nextjs   nodejs     2147483 dvf_paris_10k.json
```

**Si le dossier ou le fichier n'existe PAS** → Le Dockerfile n'a pas copié les données

---

### 3. Vérifier que le Script de Chargement Existe

```bash
docker exec <CONTAINER_ID> ls -la /app/scripts/load-embedded-dvf.js
```

**Résultat attendu :**
```
-rw-r--r--    1 nextjs   nodejs        2156 load-embedded-dvf.js
```

---

### 4. Vérifier les Variables d'Environnement

```bash
docker exec <CONTAINER_ID> printenv | grep -E "MONGO_URL|AUTO_LOAD_DVF"
```

**Résultat attendu :**
```
MONGO_URL=mongodb://mongo:PASSWORD@SERVICE:27017
AUTO_LOAD_DVF=true
```

**Si AUTO_LOAD_DVF est absent ou false** → Ajoutez-le dans Dokploy

---

### 5. Vérifier les Logs du Conteneur au Démarrage

```bash
docker logs <CONTAINER_ID> 2>&1 | grep -A 20 "Vérification des données DVF"
```

**Résultat attendu :**
```
🚀 AlterEgo - Vérification des données DVF...
✅ MongoDB est prêt
📊 Vérification de la présence des données DVF...
   Nombre de transactions DVF actuelles : 0
⚠️  Aucune donnée DVF trouvée dans MongoDB
✅ AUTO_LOAD_DVF=true détecté
📍 Chargement des données DVF embarquées (10,000 transactions Paris)
   ✓ Importé : 10000/10000 transactions
✅ Données DVF chargées avec succès
```

**Si vous voyez une erreur** → Partagez-la

---

### 6. Vérifier MongoDB Manuellement

```bash
docker exec <CONTAINER_ID> sh -c "node -e \"
const { MongoClient } = require('/app/node_modules/mongodb');
const client = new MongoClient(process.env.MONGO_URL);
client.connect().then(async () => {
  const db = client.db('alterego_db');
  const count = await db.collection('dvf_sales').countDocuments();
  console.log('Documents DVF:', count);
  await client.close();
});
\""
```

**Résultat attendu :**
```
Documents DVF: 10000
```

**Si 0** → Les données n'ont pas été chargées

---

### 7. Test Manuel de l'API

```bash
curl -X POST https://app.alteregopatrimoine.com/api/estimate \
  -H "Content-Type: application/json" \
  -d '{
    "address": "60 Rue François 1er, 75008 Paris",
    "lat": 48.8698,
    "lng": 2.3085,
    "type": "appartement",
    "surface": 80,
    "characteristics": {"floor": "1-3", "standing": 4}
  }' | jq
```

**Résultat attendu :** JSON avec `dvf.comparables` non vide

**Si `comparables: []`** → MongoDB est vide

---

## 🔧 Solutions Selon le Diagnostic

### Scénario A : Les Fichiers data/ N'Existent Pas dans le Conteneur

**Cause :** Le Dockerfile n'a pas copié le dossier `data/`

**Solution :**
1. Vérifiez que `/app/data/dvf_paris_10k.json` existe localement (dans le preview)
2. Vérifiez le Dockerfile :
   ```dockerfile
   COPY --from=builder --chown=nextjs:nodejs /app/data ./data
   ```
3. Redéployez depuis Dokploy

---

### Scénario B : AUTO_LOAD_DVF N'Est Pas Défini

**Solution :**
1. Allez dans Dokploy → Application → Environment
2. Ajoutez : `AUTO_LOAD_DVF=true`
3. Redéployez

---

### Scénario C : Le Script de Chargement Échoue

**Solution :** Exécutez manuellement :

```bash
docker exec -it <CONTAINER_ID> sh
node /app/scripts/load-embedded-dvf.js
```

Partagez l'erreur si elle apparaît

---

### Scénario D : MongoDB N'Est Pas Accessible

**Cause :** `MONGO_URL` incorrect

**Solution :**
1. Vérifiez l'URL MongoDB dans Dokploy (section MongoDB)
2. Format : `mongodb://USER:PASSWORD@SERVICE:27017`
3. Mettez à jour dans les variables d'environnement
4. Redéployez

---

## 🎯 Checklist de Résolution

- [ ] Conteneur tourne (`docker ps`)
- [ ] Fichier `/app/data/dvf_paris_10k.json` existe dans le conteneur
- [ ] Script `/app/scripts/load-embedded-dvf.js` existe
- [ ] `AUTO_LOAD_DVF=true` dans les variables d'environnement
- [ ] `MONGO_URL` correct
- [ ] Logs montrent "✅ Données DVF chargées avec succès"
- [ ] MongoDB contient 10,000 documents
- [ ] API `/api/estimate` retourne des comparables
- [ ] Site affiche les valeurs d'estimation

---

## 📞 Si Tout Échoue : Chargement Manuel d'Urgence

```bash
# 1. Entrer dans le conteneur
docker exec -it $(docker ps --filter "name=alterego" -q | head -1) sh

# 2. Créer et exécuter ce script
cat > /tmp/emergency-load.js << 'EOF'
const { MongoClient } = require('/app/node_modules/mongodb');
const fs = require('fs');

async function emergencyLoad() {
  console.log('🚨 Chargement d\'urgence...');
  const client = new MongoClient(process.env.MONGO_URL);
  await client.connect();
  const db = client.db('alterego_db');
  const collection = db.collection('dvf_sales');
  
  const count = await collection.countDocuments();
  console.log(`Documents actuels: ${count}`);
  
  if (count > 1000) {
    console.log('✅ Déjà chargé');
    await client.close();
    return;
  }
  
  const data = JSON.parse(fs.readFileSync('/app/data/dvf_paris_10k.json', 'utf-8'));
  await collection.insertMany(data);
  
  const newCount = await collection.countDocuments();
  console.log(`✅ ${newCount} documents chargés`);
  await client.close();
}

emergencyLoad().catch(console.error);
EOF

node /tmp/emergency-load.js

# 3. Vérifier
node -e "
const { MongoClient } = require('/app/node_modules/mongodb');
const client = new MongoClient(process.env.MONGO_URL);
client.connect().then(async () => {
  const db = client.db('alterego_db');
  const count = await db.collection('dvf_sales').countDocuments();
  console.log('✅ Total documents:', count);
  await client.close();
});
"

# 4. Quitter le conteneur
exit

# 5. Tester sur le site
```

---

## 📊 Résumé du Flux de Données

```
┌──────────────────────────────────────────────┐
│  Git Repository                              │
│  └── /app/data/dvf_paris_10k.json (10k DVF) │
└────────────────┬─────────────────────────────┘
                 │
                 │ Git Push
                 ▼
┌──────────────────────────────────────────────┐
│  Dokploy Build                               │
│  └── Dockerfile COPY data/ → /app/data/     │
└────────────────┬─────────────────────────────┘
                 │
                 │ Docker Build
                 ▼
┌──────────────────────────────────────────────┐
│  Container Startup                           │
│  └── docker-entrypoint.sh                    │
│      └── init-dvf-on-startup.sh              │
│          └── Si AUTO_LOAD_DVF=true           │
│              └── load-embedded-dvf.js        │
│                  └── Lit /app/data/*.json    │
│                      └── Insert dans MongoDB │
└────────────────┬─────────────────────────────┘
                 │
                 │ Données chargées
                 ▼
┌──────────────────────────────────────────────┐
│  MongoDB Dokploy                             │
│  └── alterego_db.dvf_sales (10,000 docs)    │
└────────────────┬─────────────────────────────┘
                 │
                 │ API Query
                 ▼
┌──────────────────────────────────────────────┐
│  /api/estimate                               │
│  └── Cherche comparables dans MongoDB       │
│      └── Retourne estimation avec valeurs   │
└────────────────┬─────────────────────────────┘
                 │
                 │ Affichage
                 ▼
┌──────────────────────────────────────────────┐
│  Site Web                                    │
│  └── Page montre VALEURS d'estimation ✅    │
└──────────────────────────────────────────────┘
```

**Si une étape échoue, le flux s'arrête et les valeurs ne s'affichent pas.**

---

🎯 **Exécutez ces vérifications et partagez les résultats pour identifier le problème exact !**
