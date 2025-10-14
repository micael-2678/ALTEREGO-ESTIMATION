# 🔧 Correction Dokploy - Application Non Accessible

## ❌ Problème Identifié dans les Logs

```
⚠️ "next start" does not work with "output: standalone" configuration. 
Use "node .next/standalone/server.js" instead.
```

### Cause
Le Dockerfile utilise `CMD ["node", "server.js"]` qui est correct, MAIS lors du build Docker, le mode standalone génère un serveur qui doit être lancé différemment.

## ✅ Solutions

### Solution 1 : Vérifier le Build Docker (Recommandé)

Le Dockerfile est déjà correct. Il faut s'assurer que :

1. **Le dernier code est sur GitHub**
   ```bash
   git add Dockerfile lib/mongodb.js next.config.js
   git commit -m "fix: Docker standalone configuration"
   git push origin main
   ```

2. **Dans Dokploy : Rebuild complet**
   - Aller dans votre application
   - Cliquer sur "Deployments"
   - Cliquer sur "Redeploy" ou "Rebuild"
   - Attendre la fin du build

3. **Vérifier les Variables d'Environnement**
   
   Dans Dokploy → General → Environment Variables, assurez-vous d'avoir :
   
   ```env
   MONGO_URL=mongodb://votre-mongo-url:27017/alterego_db
   NEXT_PUBLIC_BASE_URL=https://votre-domaine.com
   JWT_SECRET=votre-secret-jwt-minimum-32-caracteres
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=VotreMotDePasse123!
   NODE_ENV=production
   PORT=3000
   HOSTNAME=0.0.0.0
   ```

### Solution 2 : Configuration du Domaine

Pour connecter votre domaine dans Dokploy :

1. **Aller dans l'onglet "Domains"**
2. **Ajouter votre domaine** : `votre-domaine.com`
3. **Configuration DNS** (chez votre registrar de domaine) :
   
   **Type A** :
   ```
   @ (ou votre-domaine.com) → IP de votre serveur
   ```
   
   **Type CNAME** (alternatif) :
   ```
   www → vps-84005014.vps.ovh.net
   ```

4. **Attendre la propagation DNS** (5-15 minutes)

5. **Activer HTTPS** (dans Dokploy) :
   - Dokploy peut générer automatiquement un certificat SSL avec Let's Encrypt
   - Cocher "Enable SSL/TLS"

### Solution 3 : Vérifier le Service

Dans Dokploy → **Logs**, vérifiez que vous voyez :

```
✓ Ready in XXXms
- Local:        http://localhost:3000
```

Si vous voyez le warning "next start" does not work, c'est que le build Docker n'utilise pas le bon Dockerfile.

### Solution 4 : Port Mapping

Dans Dokploy → **General** :

- **Container Port** : `3000`
- **Protocol** : `HTTP`
- Laissez le port public vide (Dokploy gère automatiquement avec son reverse proxy)

## 🔍 Diagnostic Étape par Étape

### Étape 1 : Vérifier que l'application démarre

Dans Dokploy → **Logs**, cherchez :
```
✓ Ready in XXXms
```

Si vous voyez ça, l'application démarre correctement.

### Étape 2 : Tester l'accès via IP

Essayez d'accéder à :
```
http://vps-84005014.vps.ovh.net:3000
```

- **Si ça fonctionne** : Le problème est dans la configuration du domaine
- **Si ça ne fonctionne pas** : Le problème est dans l'application ou le port mapping

### Étape 3 : Vérifier MongoDB

L'application ne peut pas démarrer correctement sans MongoDB. Assurez-vous :

- **MongoDB est bien démarré** (si service Dokploy)
- **MONGO_URL est correct** dans les variables d'environnement
- **MongoDB est accessible** depuis le container

Test MongoDB (dans le container) :
```bash
dokploy exec alterego-estimation sh
# Puis dans le container :
echo $MONGO_URL
# Devrait afficher l'URL MongoDB
```

## 🎯 Checklist Complète

- [ ] Dockerfile correct avec `CMD ["node", "server.js"]`
- [ ] `next.config.js` avec `output: 'standalone'`
- [ ] Code commit et push sur GitHub
- [ ] Build Docker réussi dans Dokploy
- [ ] Variables d'environnement configurées
- [ ] MongoDB accessible
- [ ] Port 3000 exposé
- [ ] Domaine ajouté dans Dokploy
- [ ] DNS configuré (A record)
- [ ] SSL activé (optionnel mais recommandé)

## 🚨 Erreurs Communes

### 1. "Cannot connect to MongoDB"
**Solution** : Vérifier MONGO_URL dans les variables d'environnement

### 2. "Port 3000 already in use"
**Solution** : Redémarrer le service dans Dokploy

### 3. "502 Bad Gateway"
**Solution** : L'application ne démarre pas. Vérifier les logs et MongoDB.

### 4. "404 Not Found" pour les assets
**Solution** : Build Docker incomplet. Rebuild complet nécessaire.

### 5. DNS ne résout pas
**Solution** : Attendre 5-15 minutes après configuration DNS. Vérifier avec :
```bash
nslookup votre-domaine.com
```

## 📞 Prochaines Étapes

1. **Push le code sur GitHub**
2. **Rebuild dans Dokploy**
3. **Configurer les variables d'environnement**
4. **Ajouter le domaine**
5. **Configurer DNS**
6. **Activer SSL**
7. **Tester l'accès**

Si le problème persiste après ces étapes, vérifiez les logs Dokploy pour identifier l'erreur spécifique.
