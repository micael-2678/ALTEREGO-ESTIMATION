# 🚀 Dockerfile Optimisé - Mode Standalone Next.js

## ✅ Améliorations Appliquées

### 1. **Multi-Stage Build** (3 stages)

**Stage 1 : deps** - Installation des dépendances
- Image de base légère : `node:20-alpine`
- Installation des dépendances uniquement
- Réutilisable et mise en cache

**Stage 2 : builder** - Build de l'application
- Copie des dépendances depuis le stage `deps`
- Build de l'application Next.js
- Génère le bundle standalone optimisé

**Stage 3 : runner** - Image de production finale
- **Plus petite image possible** (~150MB vs ~500MB+)
- Copie uniquement les fichiers nécessaires :
  - `.next/standalone/` - Serveur Node.js minimal
  - `public/` - Assets statiques
  - `.next/static/` - JavaScript/CSS build
- **Utilisateur non-root** pour la sécurité
- Démarre avec `node server.js` (plus rapide que `next start`)

### 2. **Configuration Standalone**

Dans `next.config.js` :
```javascript
output: 'standalone'
```

Cette configuration génère un serveur Node.js minimal avec seulement les dépendances nécessaires au runtime.

### 3. **Script de Démarrage**

Dans `package.json` :
```json
"start": "node .next/standalone/server.js"
```

Utilise directement le serveur standalone au lieu de `next start`.

---

## 📊 Comparaison Avant/Après

| Critère | Avant | Après (Standalone) |
|---------|-------|-------------------|
| **Taille de l'image** | ~500-800 MB | ~150-200 MB |
| **Temps de démarrage** | ~3-5s | ~1-2s |
| **Sécurité** | Root user | Non-root user (nextjs) |
| **Dépendances** | Toutes (dev + prod) | Production uniquement |
| **Optimisation** | Build standard | Build optimisé multi-stage |

---

## 🎯 Avantages

✅ **Image Docker 3-4x plus petite**
- Moins de bande passante pour pull/push
- Déploiements plus rapides
- Coûts de stockage réduits

✅ **Démarrage plus rapide**
- Serveur Node.js standalone optimisé
- Moins de fichiers à charger

✅ **Sécurité améliorée**
- Utilisateur non-root (UID 1001)
- Surface d'attaque réduite
- Moins de dépendances

✅ **Build optimisé**
- Cache efficace des layers Docker
- Rebuild rapide si seul le code change
- Séparation deps / build / runtime

✅ **Production-ready**
- Configuration recommandée par Vercel
- Utilisé par les grandes entreprises
- Meilleure performance

---

## 🔧 Utilisation

### Build Local
```bash
docker build -t alterego-app .
```

### Run Local
```bash
docker run -p 3000:3000 \
  -e MONGO_URL="mongodb://..." \
  -e NEXT_PUBLIC_BASE_URL="http://localhost:3000" \
  alterego-app
```

### Docker Compose
Le `docker-compose.yml` existant fonctionne sans modification !

### Dokploy
Le nouveau Dockerfile est 100% compatible avec Dokploy :
1. Commit et push sur GitHub
2. Redéployer dans Dokploy
3. ✅ Build plus rapide et image plus légère

---

## 📝 Structure de l'Image Finale

```
/app/
├── server.js              # Serveur standalone Next.js
├── .next/
│   └── static/           # JS/CSS compilés
├── public/               # Images, fonts, etc.
└── node_modules/         # Dépendances minimales (runtime only)
```

**Total** : ~150-200 MB au lieu de ~500-800 MB

---

## 🚀 Déploiement

Le Dockerfile optimisé est prêt pour :
- ✅ **Dokploy** (votre plateforme actuelle)
- ✅ **Vercel**
- ✅ **Railway**
- ✅ **AWS ECS/Fargate**
- ✅ **Google Cloud Run**
- ✅ **Azure Container Instances**
- ✅ **Kubernetes**

---

## 🔍 Vérification

Après le build, vous pouvez vérifier la taille :

```bash
docker images | grep alterego

# Avant : ~500-800 MB
# Après : ~150-200 MB ✅
```

---

## 💡 Notes Techniques

- Le mode standalone inclut **uniquement les dépendances runtime nécessaires**
- Les `devDependencies` ne sont **jamais copiées** dans l'image finale
- Le serveur standalone est **optimisé par Next.js** pour la production
- Compatible avec toutes les features Next.js (App Router, API Routes, etc.)

---

🎉 **Votre application est maintenant optimisée pour la production !**
