# 🚀 Guide de Déploiement Production - AlterEgo

## 📋 Résumé

Ce guide explique comment déployer AlterEgo sur Dokploy avec chargement automatique des données DVF officielles.

---

## ⚙️ Configuration Dokploy

### Variables d'Environnement Requises

Ajoutez ces variables dans **Dokploy > Votre Projet > Settings > Environment Variables** :

```bash
# Base de données
MONGO_URL=mongodb://mongodb:27017/alterego_db
DB_NAME=alterego_db

# URL publique de votre application
NEXT_PUBLIC_BASE_URL=https://app.alteregopatrimoine.com

# Authentification Admin
ADMIN_USERNAME=Micael
ADMIN_PASSWORD=Micael123
JWT_SECRET=votre-secret-key-securise-changez-moi

# CORS (laisser * pour autoriser tous les domaines)
CORS_ORIGINS=*

# ⭐ CHARGEMENT AUTOMATIQUE DVF (NOUVEAU)
AUTO_LOAD_DVF=true
DVF_LOAD_MODE=complete
```

---

## 🎯 Options de Chargement DVF

Vous avez **2 modes** de chargement des données DVF :

### 1️⃣ Mode COMPLET (Recommandé pour Production) ⭐

```bash
AUTO_LOAD_DVF=true
DVF_LOAD_MODE=complete
```

**Caractéristiques :**
- ✅ Télécharge toutes les transactions DVF depuis l'API officielle (data.gouv.fr)
- ✅ Données toujours à jour (5 dernières années)
- ✅ Couverture complète : ~900 000+ transactions (toute la France)
- ✅ Mise à jour automatique à chaque redéploiement
- ⏱️ Temps de chargement : **15-30 minutes** au premier démarrage
- 📊 Départements : Métropole + DOM-TOM

**Idéal pour :**
- Production professionnelle
- Application en conditions réelles
- Estimations précises sur toute la France

---

### 2️⃣ Mode RAPIDE (Développement/Test)

```bash
AUTO_LOAD_DVF=true
DVF_LOAD_MODE=quick
```

**Caractéristiques :**
- ⚡ Chargement ultra-rapide (~10 secondes)
- 📊 10 000 transactions réelles pré-chargées
- ✅ Couverture France entière (échantillon)
- 💾 Données embarquées dans l'image Docker

**Idéal pour :**
- Tests rapides
- Environnements de développement
- Démos

---

## 📝 Procédure de Déploiement

### Étape 1 : Configuration GitHub

1. Votre repository GitHub : `https://github.com/micael-2678/ALTEREGO-ESTIMATION`
2. Assurez-vous que les derniers commits sont poussés

### Étape 2 : Configuration Dokploy

1. Connectez-vous à votre Dokploy
2. Allez dans votre projet **AlterEgo**
3. Section **Environment Variables** :
   - Cliquez sur **"Add Variable"**
   - Ajoutez toutes les variables listées ci-dessus
   - ⚠️ **Important** : Mettez bien `DVF_LOAD_MODE=complete` pour le mode production

### Étape 3 : Déploiement

1. Cliquez sur **"Deploy"** ou **"Redeploy"**
2. Dokploy va :
   - Cloner votre repository GitHub
   - Builder l'image Docker
   - Démarrer le conteneur
   - **Attendre que l'ingestion DVF se termine**

### Étape 4 : Vérification

Le premier démarrage prendra **15-30 minutes** car l'application charge toutes les données DVF.

**Comment vérifier la progression ?**

#### Option A : Logs Dokploy (Interface Web)

1. Dans Dokploy, cliquez sur votre application
2. Onglet **"Logs"**
3. Vous verrez les messages de progression :

```
🚀 AlterEgo - Vérification des données DVF...
==================================================
⏳ Attente de la disponibilité de MongoDB...
✅ MongoDB est prêt

📊 Vérification de la présence des données DVF...
   Nombre de transactions DVF actuelles : 0

⚠️  Aucune donnée DVF trouvée dans MongoDB

✅ AUTO_LOAD_DVF=true détecté
🌐 MODE COMPLET : Ingestion depuis l'API DVF officielle
   📊 Toutes les transactions France (5 dernières années)
   ⏱️  Temps estimé : 15-30 minutes

================================================================================
📦 INGESTION DVF - TOUTE LA FRANCE
================================================================================
Départements à traiter : 101
⚠️  ATTENTION : Cette opération peut prendre plusieurs heures
================================================================================

[1/101] Département 01 (1.0%)
[DVF] Starting ingestion for department 01...
[DVF] Downloading from https://files.data.gouv.fr/geo-dvf/latest/csv/2024/departements/01.csv.gz...
✅ Département 01 : SUCCÈS

[2/101] Département 02 (2.0%)
...
```

#### Option B : Terminal (Accès Direct)

Si vous avez accès au terminal du conteneur :

```bash
# Voir la progression en temps réel
tail -f /tmp/dvf-ingestion.log

# Vérifier le nombre de transactions chargées
docker exec -it <container-name> sh
node -e "
const { MongoClient } = require('mongodb');
const client = new MongoClient(process.env.MONGO_URL);
client.connect().then(async () => {
  const db = client.db(process.env.DB_NAME);
  const count = await db.collection('dvf_sales').countDocuments();
  console.log('Transactions DVF chargées :', count);
  await client.close();
});
"
```

### Étape 5 : Test de l'Application

Une fois le chargement terminé (les logs indiqueront `✅ Ingestion complète réussie`), testez votre application :

1. Accédez à `https://app.alteregopatrimoine.com`
2. Créez une nouvelle estimation
3. Entrez une adresse (ex: "15 Avenue des Champs-Élysées, Paris")
4. Remplissez les caractéristiques
5. Vérifiez que les résultats s'affichent avec les comparables DVF

---

## 🔄 Mise à Jour des Données DVF

Les données DVF sont rechargées automatiquement à chaque redéploiement de l'application (si `AUTO_LOAD_DVF=true`).

Pour forcer une mise à jour :

1. Dans Dokploy, cliquez sur **"Redeploy"**
2. L'application va re-télécharger les dernières données DVF
3. Attendez la fin de l'ingestion (15-30 min)

**Fréquence recommandée :** 
- Mensuelle : pour avoir les données les plus récentes
- Ou à chaque fois que vous déployez une nouvelle version de l'application

---

## 🐛 Dépannage

### Problème : L'application démarre mais aucune estimation ne s'affiche

**Cause possible :** Le chargement DVF n'est pas activé ou a échoué

**Solution :**
1. Vérifiez que `AUTO_LOAD_DVF=true` dans les variables d'environnement
2. Vérifiez les logs de démarrage
3. Si nécessaire, chargez manuellement :

```bash
# Accédez au terminal du conteneur Dokploy
docker exec -it <container-name> sh

# Lancez l'ingestion manuellement
cd /app
node scripts/ingest-all-france.js
```

### Problème : Le démarrage prend trop de temps

**C'est normal !** L'ingestion complète prend 15-30 minutes. L'application ne sera accessible qu'après.

**Alternative :** Utilisez le mode `quick` pour un démarrage immédiat (avec 10k transactions) :

```bash
DVF_LOAD_MODE=quick
```

### Problème : Certains départements échouent

C'est possible si certains fichiers DVF ne sont pas disponibles sur data.gouv.fr.

**L'application fonctionnera quand même** avec les départements chargés avec succès. Consultez les logs pour voir les départements en échec.

---

## 📊 Structure des Données DVF

Une fois chargées, voici ce que contient votre base MongoDB :

**Collection :** `dvf_sales`

**Exemple de document :**
```json
{
  "date_mutation": "2024-01-03",
  "numero_voie_masked": "XX",
  "voie": "RUE DE LA PAIX",
  "code_postal": "75002",
  "commune": "Paris 2e Arrondissement",
  "code_departement": "75",
  "type_local": "appartement",
  "surface_reelle_bati": 85,
  "nombre_pieces_principales": 3,
  "valeur_fonciere": 850000,
  "prix_m2": 10000,
  "latitude": 48.8698,
  "longitude": 2.3085,
  "nature_mutation": "Vente",
  "imported_at": "2025-01-15T10:30:00.000Z"
}
```

**Index créés automatiquement :**
- `latitude + longitude` (recherche géographique)
- `code_postal`
- `code_departement`
- `type_local`
- `prix_m2`
- `date_mutation`

---

## ✅ Checklist Finale

Avant de mettre en production :

- [ ] Variables d'environnement configurées dans Dokploy
- [ ] `AUTO_LOAD_DVF=true` et `DVF_LOAD_MODE=complete` définis
- [ ] Premier déploiement effectué (patience 15-30 min)
- [ ] Logs vérifiés : ingestion terminée avec succès
- [ ] Test d'estimation effectué avec une adresse réelle
- [ ] Comparables DVF affichés dans les résultats
- [ ] Admin login fonctionnel (`/admin`)

---

## 🎉 Prêt pour Production !

Votre application AlterEgo est maintenant prête avec :
- ✅ ~900 000+ transactions DVF (toute la France)
- ✅ Données actualisées (5 dernières années)
- ✅ Mise à jour automatique à chaque redéploiement
- ✅ Estimations précises sur tout le territoire

**Prochaine étape :** Configurez votre nom de domaine et certificat SSL dans Dokploy !

---

## 📞 Support

Si vous rencontrez des problèmes :
1. Consultez les logs Dokploy
2. Vérifiez `/tmp/dvf-ingestion.log` dans le conteneur
3. Testez l'API DVF : `https://app.alteregopatrimoine.com/api/dvf/comparables?lat=48.8566&lng=2.3522&type=appartement&surface=50`

---

**Document créé le :** 2025-01-15  
**Version :** 1.0  
**Auteur :** AlterEgo Development Team
