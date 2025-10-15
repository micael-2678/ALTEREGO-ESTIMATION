# 🚨 Chargement Manuel Simple - Solution Immédiate

## Problème
L'auto-chargement ne fonctionne pas, MongoDB production est toujours vide.

## ✅ Solution Manuelle Rapide (5 Minutes)

### Option 1 : Via Commande SSH Unique (PLUS RAPIDE)

Connectez-vous en SSH au serveur et exécutez cette **SEULE commande** :

```bash
docker exec $(docker ps --filter "name=alterego" --format "{{.Names}}" | head -1) node scripts/populate-dvf-sample.js --dept=75
```

⏱️ **Durée : 5-10 minutes**

### Option 2 : Étape par Étape

#### 1. Connexion SSH
```bash
ssh ubuntu@vps-84005014.vps.ovh.net
```

#### 2. Trouver le conteneur
```bash
docker ps | grep alterego
```

Vous verrez quelque chose comme :
```
alterego-estimation-ylpzuh.1.wucw08ucfpkpfas07f19gk9rk
```

#### 3. Charger Paris (10 minutes)
```bash
# Remplacez <CONTAINER_NAME> par le nom trouvé ci-dessus
docker exec <CONTAINER_NAME> node scripts/populate-dvf-sample.js --dept=75
```

**OU pour toute la France (2-4h) :**
```bash
docker exec <CONTAINER_NAME> sh -c "nohup node scripts/ingest-all-france.js > /tmp/ingestion.log 2>&1 &"
```

#### 4. Vérifier
Après 10 minutes (Paris) :
```bash
docker exec <CONTAINER_NAME> node scripts/check-dvf-data.js
```

Vous devriez voir :
```
📊 Nombre total de transactions DVF : ~27,000
```

---

## 🎯 Test Final

Une fois chargé, testez l'estimation :

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

Si vous voyez des données dans la réponse → ✅ **Estimation fonctionne !**

Ensuite, testez sur le site : https://app.alteregopatrimoine.com

---

## 🔧 Debug de l'Auto-Chargement (Pour Plus Tard)

Une fois que le chargement manuel fonctionne, on pourra investiguer pourquoi l'auto-chargement n'a pas marché.

**À vérifier :**
1. Les logs du conteneur au démarrage
2. Les variables d'environnement configurées
3. Les permissions des scripts dans l'image Docker

---

## 📞 Commandes Utiles

**Voir les logs du conteneur :**
```bash
docker logs -f $(docker ps --filter "name=alterego" --format "{{.Names}}" | head -1)
```

**Vérifier les variables d'environnement :**
```bash
docker exec $(docker ps --filter "name=alterego" --format "{{.Names}}" | head -1) printenv | grep AUTO_LOAD
```

**Entrer dans le conteneur :**
```bash
docker exec -it $(docker ps --filter "name=alterego" --format "{{.Names}}" | head -1) sh
```

---

🎯 **Action Immédiate : Exécutez l'Option 1 (une seule commande) maintenant !**
