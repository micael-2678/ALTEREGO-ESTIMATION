# 🚀 Import Direct des Données DVF en Production

## Méthode Simple : Script Tout-en-Un

Depuis le serveur SSH, exécutez ce script qui va :
1. Se connecter au MongoDB local du preview (via internet)
2. Copier les données vers MongoDB production

---

## ✅ Étape 1 : Connectez-vous en SSH

```bash
ssh ubuntu@vps-84005014.vps.ovh.net
```

---

## ✅ Étape 2 : Exécutez ce Script

```bash
# Trouver le conteneur de l'application
CONTAINER=$(docker ps --filter "name=alterego" --format "{{.Names}}" | head -1)
echo "Conteneur trouvé: $CONTAINER"

# Entrer dans le conteneur et charger les données embarquées
docker exec $CONTAINER node /app/scripts/load-embedded-dvf.js
```

**C'est tout !** Le script va charger les 10,000 transactions Paris depuis le fichier embarqué.

---

## ✅ Étape 3 : Vérifier

```bash
# Vérifier que les données sont chargées
docker exec $CONTAINER node -e "
const { MongoClient } = require('/app/node_modules/mongodb');
const client = new MongoClient(process.env.MONGO_URL);
client.connect().then(async () => {
  const db = client.db('alterego_db');
  const count = await db.collection('dvf_sales').countDocuments();
  console.log('✅ Documents DVF en production:', count);
  await client.close();
});
"
```

Vous devriez voir : **✅ Documents DVF en production: 10000**

---

## ✅ Étape 4 : Tester le Site

Allez sur : **https://app.alteregopatrimoine.com**

Testez une estimation à Paris → Les valeurs doivent s'afficher ! 🎉

---

## 🆘 Alternative : Chargement Manuel d'Urgence

Si le script automatique ne fonctionne pas, voici la méthode manuelle :

```bash
# 1. Trouver le conteneur
CONTAINER=$(docker ps --filter "name=alterego" --format "{{.Names}}" | head -1)

# 2. Entrer dans le conteneur
docker exec -it $CONTAINER sh

# 3. Une fois DANS le conteneur (/app $), exécutez :
cat > /tmp/emergency-load.js << 'EOF'
const { MongoClient } = require('/app/node_modules/mongodb');
const fs = require('fs');

async function load() {
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
  
  console.log('📂 Lecture de /app/data/dvf_paris_10k.json...');
  const data = JSON.parse(fs.readFileSync('/app/data/dvf_paris_10k.json', 'utf-8'));
  console.log(`📊 ${data.length} transactions à importer`);
  
  const batchSize = 1000;
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    await collection.insertMany(batch, { ordered: false }).catch(() => {});
    console.log(`   ✓ Importé : ${Math.min(i + batchSize, data.length)}/${data.length}`);
  }
  
  const newCount = await collection.countDocuments();
  console.log(`\n✅ ${newCount} documents chargés`);
  
  await collection.createIndex({ latitude: 1, longitude: 1 });
  await collection.createIndex({ code_postal: 1 });
  console.log('✅ Index créés');
  
  await client.close();
  console.log('\n🎉 TERMINÉ !');
}

load().catch(console.error);
EOF

# 4. Exécuter le script
node /tmp/emergency-load.js

# 5. Quitter le conteneur
exit

# 6. Tester le site
```

---

## 📊 Pourquoi Preview Fonctionne et Pas Production ?

**Preview (Emergent):**
```
Code → MongoDB LOCAL
       └── 914,063 transactions ✅ (chargées pendant le développement)
```

**Production (Dokploy):**
```
Même Code → MongoDB DOKPLOY (base SÉPARÉE)
            └── 0 transactions ❌ (base vide)
```

**Solution :** Charger les données dans MongoDB Dokploy avec les scripts ci-dessus !

---

## ✅ Checklist Finale

- [ ] SSH connecté au serveur
- [ ] Conteneur trouvé (`docker ps | grep alterego`)
- [ ] Script de chargement exécuté
- [ ] Vérification : 10,000 documents en base
- [ ] Site testé : https://app.alteregopatrimoine.com
- [ ] ✅ Les valeurs d'estimation s'affichent !

---

🎯 **Exécutez maintenant la méthode simple depuis le serveur SSH !**
