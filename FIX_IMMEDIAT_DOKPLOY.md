# 🚨 FIX IMMÉDIAT - Charger les Données DVF en Production

## ⚠️ PROBLÈME CONFIRMÉ

**MongoDB production Dokploy est VIDE** = Pas de données DVF = Pas d'estimations !

Logs : `Found 0 raw comparables` (5 tentatives)
Screenshot : Page d'estimation sans aucune valeur

---

## ✅ SOLUTION EN 3 ÉTAPES (15 MINUTES)

### ÉTAPE 1 : Ouvrir le Terminal Dokploy

1. Allez dans **Dokploy**
2. Cliquez sur votre application **"alterego-estimation"**
3. Cliquez sur **"Advanced"** ou **"Open Terminal"** (icône de terminal)

---

### ÉTAPE 2 : Vérifier que MongoDB Est Vide

Copiez-collez cette commande dans le terminal :

```bash
node scripts/check-dvf-data.js
```

**Résultat attendu :**
```
📊 Nombre total de transactions DVF : 0
⚠️  ATTENTION : Aucune donnée DVF trouvée !
```

✅ Si vous voyez "0", MongoDB est bien vide → Continuez à l'étape 3

---

### ÉTAPE 3A : Test Rapide (Paris uniquement - 10 minutes)

Pour tester rapidement avec Paris uniquement :

```bash
node scripts/populate-dvf-sample.js --dept=75
```

⏱️ **Durée : 5-10 minutes**

Puis vérifiez :
```bash
node scripts/check-dvf-data.js
```

Vous devriez voir : `📊 Nombre total de transactions DVF : ~27,000`

**Testez ensuite une estimation sur Paris :**
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

✅ Si vous voyez des chiffres dans la réponse → **C'est bon !**

---

### ÉTAPE 3B : Toute la France (2-4 heures)

Pour charger toute la France (914,000 transactions) :

```bash
nohup node scripts/ingest-all-france.js > /tmp/ingestion.log 2>&1 &
```

⏱️ **Durée : 2-4 heures** (en arrière-plan)

**Suivre la progression :**
```bash
tail -f /tmp/ingestion.log
```

Pour arrêter le suivi : `Ctrl + C` (l'ingestion continue en arrière-plan)

---

## 🎯 APRÈS LE CHARGEMENT

Une fois les données chargées, **rechargez votre page d'estimation** et les valeurs apparaîtront !

**Exemple de ce que vous devriez voir :**
```
Prix Estimé : 450 000 € - 480 000 €
Prix Conseillé de Mise en Vente : 470 000 €
Confiance : Élevée (15 comparables)
```

---

## 🔧 PROBLÈME SECONDAIRE : Puppeteer (Chrome)

**Symptôme dans les logs :**
```
Market scraping failed: Error: Could not find Chrome
```

**Impact :** Le scraping SeLoger ne fonctionne pas (données de marché actuel).
**Gravité :** ⚠️ Mineur - Les estimations DVF fonctionnent sans cela.

**Fix (optionnel) :**

Ajoutez cette section au Dockerfile AVANT le `CMD` :

```dockerfile
# Installer Chrome pour Puppeteer
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
```

Puis **redéployez** depuis Dokploy.

⚠️ **Mais faites cela APRÈS avoir chargé les données DVF !**

---

## ✅ CHECKLIST

- [ ] Ouvrir le terminal Dokploy
- [ ] Vérifier que MongoDB est vide : `node scripts/check-dvf-data.js`
- [ ] **Option A :** Charger Paris (10 min) : `node scripts/populate-dvf-sample.js --dept=75`
- [ ] **Option B :** Charger toute la France (2-4h) : `nohup node scripts/ingest-all-france.js > /tmp/ingestion.log 2>&1 &`
- [ ] Vérifier les données : `node scripts/check-dvf-data.js`
- [ ] Tester une estimation sur le site : https://app.alteregopatrimoine.com
- [ ] ✅ Les valeurs d'estimation apparaissent !

---

## 🆘 EN CAS DE PROBLÈME

### "node: command not found"
Vous n'êtes pas dans le bon conteneur. Assurez-vous d'être dans le terminal de l'**application** (pas MongoDB).

### "Cannot connect to MongoDB"
Vérifiez que `MONGO_URL` est bien configuré dans les variables d'environnement Dokploy.

### L'ingestion prend trop de temps
C'est normal ! 914,000 transactions = 2-4 heures. Utilisez Option A (Paris) pour tester rapidement.

---

## 📞 COMMANDES DE VÉRIFICATION

**Nombre de documents dans MongoDB :**
```bash
echo "db.dvf_sales.countDocuments()" | mongosh $MONGO_URL/alterego_db --quiet
```

**Processus en cours :**
```bash
ps aux | grep node
```

**Tuer un processus si besoin :**
```bash
kill -9 <PID>
```

---

🎯 **LA SOLUTION : Exécutez l'Étape 3A (Paris) maintenant dans le terminal Dokploy !**
