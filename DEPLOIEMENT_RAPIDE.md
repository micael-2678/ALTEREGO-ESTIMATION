# 🚀 Déploiement Rapide sur Dokploy

## ✅ Corrections Appliquées

### Problème 1 : Labels Traefik Disparaissent
**✅ RÉSOLU :** Les labels Traefik sont maintenant dans `docker-compose.yml` sous la section `deploy:`.

**Avant :**
```bash
# Il fallait exécuter manuellement après chaque déploiement
docker service update \
  --label-add "traefik.enable=true" \
  --label-add "traefik.http.routers.alterego.rule=Host(\"app.alteregopatrimoine.com\")" \
  ...
```

**Après :**
Les labels sont dans le fichier et persistent automatiquement ! ✨

---

### Problème 2 : Estimation Ne Fonctionne Pas en Production
**Cause identifiée :** Les données DVF doivent être présentes dans MongoDB en production.

**Solution :**
1. Vérifier les données : `node scripts/check-dvf-data.js`
2. Si vide, charger : `node scripts/ingest-all-france.js`

---

## 📋 Étapes de Déploiement

### 1. Variables d'Environnement dans Dokploy

Dans l'onglet "Environment" de votre application :

```env
MONGO_URL=mongodb://mongo:ungjv3llz1dqst0@alterego-estimation-mongodbalterego-w4vqu9:27017
DB_NAME=alterego_db
NEXT_PUBLIC_BASE_URL=https://app.alteregopatrimoine.com
JWT_SECRET=votre-secret-jwt-minimum-32-caracteres-aleatoires-securises
ADMIN_USERNAME=Micael
ADMIN_PASSWORD=Micael123
NODE_ENV=production
PORT=3000
HOSTNAME=0.0.0.0
CORS_ORIGINS=*
```

⚠️ **Utilisez l'URL MongoDB fournie par Dokploy dans la section "MongoDB"**

---

### 2. Déployer l'Application

Dans Dokploy :
1. Cliquez sur "Deploy" (le bouton fusée 🚀)
2. Attendez que le build se termine
3. Vérifiez que l'application est accessible sur `https://app.alteregopatrimoine.com`

**Les labels Traefik seront appliqués automatiquement !** 🎉

---

### 3. Vérifier que Tout Fonctionne

**Test 1 : API de base**
```bash
curl https://app.alteregopatrimoine.com/api
```
Devrait retourner : `{"message":"AlterEgo API is running","version":"2.0.0"}`

**Test 2 : Estimation complète**
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

---

### 4. Charger les Données DVF (si nécessaire)

**Via le terminal Dokploy :**

```bash
# Vérifier si les données sont présentes
node scripts/check-dvf-data.js

# Si vide, charger toute la France (recommandé)
node scripts/ingest-all-france.js
```

---

## 🎯 Fichiers Modifiés

1. **`docker-compose.yml`**
   - ✅ Labels Traefik ajoutés dans `deploy:`
   - ✅ Réseau `dokploy-network` configuré
   - ✅ Variables d'environnement flexibles

2. **`DOKPLOY_DEPLOYMENT.md`**
   - 📖 Documentation complète du déploiement

3. **`scripts/check-dvf-data.js`**
   - 🔍 Script pour vérifier les données DVF

---

## 🆘 En Cas de Problème

### L'application est inaccessible (404)
1. Vérifiez que Traefik fonctionne : `docker service ls | grep traefik`
2. Vérifiez les labels du service :
   ```bash
   docker service inspect alterego-estimation-ylpzuh --format='{{json .Spec.Labels}}' | jq
   ```
3. Si les labels sont absents, **redéployez depuis Dokploy** (ils seront appliqués automatiquement)

### L'estimation ne retourne pas de données
1. Vérifiez MongoDB : L'URL dans les variables d'environnement est-elle correcte ?
2. Vérifiez les données DVF : `node scripts/check-dvf-data.js`
3. Si vide, chargez les données : `node scripts/ingest-all-france.js`

### Erreur de connexion MongoDB
1. Vérifiez que le service MongoDB est démarré dans Dokploy
2. Vérifiez que `MONGO_URL` correspond exactement à l'URL fournie par Dokploy
3. Testez la connexion depuis le terminal de l'application

---

## 📞 Commandes Utiles

**Voir les services Docker Swarm :**
```bash
docker service ls
```

**Voir les logs en temps réel :**
```bash
docker service logs -f alterego-estimation-ylpzuh
```

**Redémarrer le service :**
Dans Dokploy : Cliquez sur "Reload" 🔄

---

## ✅ Checklist de Déploiement

- [ ] Variables d'environnement configurées dans Dokploy
- [ ] Application déployée avec succès
- [ ] L'application est accessible sur `https://app.alteregopatrimoine.com`
- [ ] L'API répond correctement
- [ ] Les données DVF sont chargées
- [ ] Les estimations fonctionnent correctement
- [ ] Le certificat SSL est valide

---

🎉 **Déploiement terminé !** Votre application est maintenant en production avec les labels Traefik persistants.
