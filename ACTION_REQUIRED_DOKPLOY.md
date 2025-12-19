# ⚠️ ACTION URGENTE REQUISE - Configuration Dokploy

## 🚨 Problème Confirmé

L'API d'estimation échoue en production avec:
```
"error": "getaddrinfo ENOTFOUND alterego-estimation-mongodbalterego-w4vqu9"
```

**Cause:** La variable d'environnement `MONGO_URL` dans Dokploy n'a PAS été mise à jour.

## ✅ Solution - 3 étapes OBLIGATOIRES

### Étape 1: Mettre à jour les variables d'environnement dans Dokploy

1. Allez dans **Dokploy** → Votre application → **Environment** (ou Settings → Environment Variables)

2. Trouvez la variable `MONGO_URL` et mettez à jour avec:
   ```
   mongodb://mongo:ungjjv3llz1dqst0@alterego-estimation-mongodbalterego-w4vqu9:27017
   ```

3. **Cliquez sur "Save"** pour sauvegarder

### Étape 2: Redéployer l'application

Après avoir sauvegardé les variables d'environnement:

1. Dans Dokploy, cliquez sur **"Deploy"** ou **"Redeploy"**
2. Attendez que le déploiement se termine (ça peut prendre 2-3 minutes)
3. Vérifiez que le statut est "Running"

### Étape 3: Tester que ça fonctionne

**Test A - API de test MongoDB:**
```bash
curl https://verif-portable.preview.emergentagent.com/api/test-mongo
```

Devrait retourner:
```json
{
  "success": true,
  "count": 894919,  // ~850k documents
  ...
}
```

**Test B - Page de test visuelle:**
Ouvrez dans votre navigateur:
```
https://verif-portable.preview.emergentagent.com/test-mongo
```

Cliquez sur "Tester la connexion" - devrait afficher ✅ avec ~850,000 documents

**Test C - Estimation réelle:**
```bash
curl -X POST https://verif-portable.preview.emergentagent.com/api/estimate \
  -H "Content-Type: application/json" \
  -d '{"address":"2 Rue des Italiens 75009 Paris","lat":48.871557,"lng":2.335948,"type":"appartement","surface":50,"characteristics":{}}'
```

Devrait retourner une estimation avec des comparables DVF.

## 📸 Captures d'écran Dokploy

Voici où trouver les variables d'environnement:

1. **Menu de gauche:** Cliquez sur votre application
2. **Onglet Settings** ou **Environment** 
3. **Section "Environment Variables"**
4. **Modifiez MONGO_URL**
5. **Sauvegardez**
6. **Redéployez** (bouton Deploy en haut)

## ⚠️ Important

- Le hostname `alterego-estimation-mongodbalterego-w4vqu9` ne fonctionne QUE dans le réseau Docker sur Dokploy
- C'est pourquoi ça ne fonctionne pas depuis notre environnement de dev Emergent
- Mais ça DOIT fonctionner une fois déployé sur Dokploy avec les bonnes variables

## 🆘 Si ça ne fonctionne toujours pas

Vérifiez que:
1. Votre application et MongoDB sont dans le même **réseau Docker** (même projet Dokploy)
2. Le service MongoDB s'appelle bien `alterego-estimation-mongodbalterego-w4vqu9`
3. Les credentials sont corrects: `mongo` / `ungjjv3llz1dqst0`

---

**Date:** $(date)
**Status:** ⚠️ EN ATTENTE - Variables d'environnement à mettre à jour dans Dokploy
