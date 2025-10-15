# 🚀 Guide de Déploiement Dokploy - AlterEgo Estimation

## ✅ Configuration Complète pour Dokploy

### 1. **Configuration du Service MongoDB dans Dokploy**

Dans Dokploy, créez un service MongoDB séparé :
- Type: Database → MongoDB
- Version: mongo:7
- Créez un utilisateur et mot de passe
- Notez l'URL de connexion interne fournie par Dokploy

**Exemple d'URL MongoDB Dokploy:**
```
mongodb://mongo:ungjv3llz1dqst0@alterego-estimation-mongodbalterego-w4vqu9:27017
```

---

### 2. **Variables d'Environnement dans Dokploy**

Dans l'onglet "Environment" de votre application, ajoutez :

```env
MONGO_URL=mongodb://mongo:VOTRE_PASSWORD@SERVICE_NAME:27017
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

⚠️ **IMPORTANT:** Remplacez `MONGO_URL` par l'URL exacte fournie par Dokploy pour votre service MongoDB.

---

### 3. **Configuration du Build dans Dokploy**

- **Build Type:** Dockerfile
- **Docker File:** `Dockerfile`
- **Docker Context Path:** `/` (ou `.`)
- **Branch:** `main`

---

### 4. **Labels Traefik - Configuration Automatique**

Le fichier `docker-compose.yml` contient maintenant les labels Traefik dans la section `deploy:`. Ils seront **automatiquement appliqués** lors du déploiement.

**Labels configurés:**
```yaml
deploy:
  labels:
    - "traefik.enable=true"
    - "traefik.http.routers.alterego.rule=Host(`app.alteregopatrimoine.com`)"
    - "traefik.http.routers.alterego.entrypoints=web,websecure"
    - "traefik.http.routers.alterego.tls.certresolver=letsencrypt"
    - "traefik.http.services.alterego.loadbalancer.server.port=3000"
    - "traefik.docker.network=dokploy-network"
```

✅ **Plus besoin d'ajouter les labels manuellement après chaque déploiement !**

---

### 5. **Réseau Docker**

Le docker-compose.yml utilise maintenant le réseau externe `dokploy-network` :

```yaml
networks:
  dokploy-network:
    external: true
```

Cela garantit que Traefik peut router correctement le trafic vers votre application.

---

### 6. **Chargement des Données DVF**

Si les données DVF ne sont pas présentes en production, connectez-vous au terminal de l'application et exécutez :

```bash
# Option 1: Charger toute la France (recommandé)
node scripts/ingest-all-france.js

# Option 2: Charger un département spécifique
node scripts/populate-dvf-sample.js --dept=75
```

---

### 7. **Vérification du Déploiement**

Après le déploiement, vérifiez que :

1. ✅ L'application est accessible sur `https://app.alteregopatrimoine.com`
2. ✅ Le certificat SSL est valide (Let's Encrypt)
3. ✅ L'API fonctionne : `curl https://app.alteregopatrimoine.com/api`
4. ✅ Les estimations retournent des résultats

**Test complet de l'API d'estimation:**
```bash
curl -X POST https://app.alteregopatrimoine.com/api/estimate \
  -H "Content-Type: application/json" \
  -d '{
    "address": "2 rue des Italiens, 75009 Paris",
    "lat": 48.8719,
    "lng": 2.3361,
    "type": "appartement",
    "surface": 50,
    "characteristics": {
      "floor": "1-3",
      "standing": 3
    }
  }'
```

---

### 8. **Résolution des Problèmes**

#### Problème : Labels Traefik disparaissent
✅ **Solution:** Les labels sont maintenant dans `docker-compose.yml` et persistent automatiquement.

#### Problème : L'estimation ne retourne pas de données
- Vérifiez que MongoDB est bien connecté
- Vérifiez que les données DVF sont chargées : `node scripts/check-dvf-data.js`
- Consultez les logs de l'application dans Dokploy

#### Problème : Erreur de connexion MongoDB
- Vérifiez que `MONGO_URL` dans les variables d'environnement correspond exactement à l'URL fournie par Dokploy
- Vérifiez que le service MongoDB est démarré

---

### 9. **Commandes Utiles**

**Vérifier les services Docker Swarm:**
```bash
docker service ls
docker service ps alterego-estimation-ylpzuh
```

**Inspecter les labels d'un service:**
```bash
docker service inspect alterego-estimation-ylpzuh --format='{{json .Spec.Labels}}' | jq
```

**Voir les logs en temps réel:**
```bash
docker service logs -f alterego-estimation-ylpzuh
```

---

### 10. **Workflow de Déploiement**

1. Pushez vos modifications sur GitHub
2. Dokploy détecte automatiquement les changements (si auto-deploy activé)
3. Dokploy build l'image Docker avec le Dockerfile
4. Les labels Traefik sont appliqués automatiquement
5. L'application est accessible immédiatement sur `https://app.alteregopatrimoine.com`

🎉 **Déploiement terminé !**

---

## 📝 Notes Importantes

- **Réseau:** L'application utilise `dokploy-network` pour communiquer avec Traefik
- **MongoDB:** Service séparé dans Dokploy, pas dans docker-compose.yml
- **Labels:** Configurés dans `deploy:` du docker-compose.yml pour Docker Swarm
- **SSL:** Géré automatiquement par Traefik avec Let's Encrypt

---

## 🔗 Liens Utiles

- Application : https://app.alteregopatrimoine.com
- API : https://app.alteregopatrimoine.com/api
- Admin : https://app.alteregopatrimoine.com/admin

---

**Dernière mise à jour :** 15 janvier 2025
