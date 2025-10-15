# 📊 Guide d'Administration DVF - AlterEgo

## ✅ Confirmation : Le Système est Connecté

### La Collection DVF Unique

Toute l'application AlterEgo utilise **une seule et même collection MongoDB** : `dvf_sales`

**Fichiers qui utilisent cette collection :**
- ✅ `/lib/dvf-enhanced.js` - Algorithme de recherche de comparables (UTILISÉ PAR LES ESTIMATIONS)
- ✅ `/lib/dvf.js` - Fonctions DVF de base
- ✅ `/lib/dvf-ingestion.js` - Script d'ingestion officiel
- ✅ `/lib/dvf-admin.js` - Gestion admin (stats, chargement, nettoyage)

**Conclusion :** Quand vous chargez les données via l'admin, elles sont **automatiquement disponibles** pour les estimations !

---

## 🎯 Workflow Complet

### 1. Chargement des Données DVF

**Via l'Interface Admin (Recommandé)**

1. Connectez-vous à `/admin` (Micael / Micael123)
2. Cliquez sur "📊 Données DVF" dans le header
3. Cliquez sur "Charger les Données DVF"
4. ⏱️ Attendez 15-30 minutes
5. ✅ Suivez la progression en temps réel

**Ce qui se passe en coulisses :**
```
1. L'API lance `/scripts/ingest-all-france.js` en arrière-plan
2. Le script télécharge les CSV depuis data.gouv.fr (101 départements)
3. Chaque département est traité séquentiellement
4. Les données sont insérées dans MongoDB → collection 'dvf_sales'
5. Des index sont créés automatiquement pour optimiser les recherches
```

---

### 2. Génération d'Estimations

**Dès que les données DVF sont chargées**, les utilisateurs peuvent :

1. Aller sur `https://app.alteregopatrimoine.com`
2. Entrer une adresse
3. Remplir les caractéristiques du bien
4. **Obtenir une estimation instantanée**

**Flux de l'estimation :**
```
User entre adresse → Géocodage (API BAN) → Récupération lat/lng
       ↓
Appel à /api/estimate
       ↓
getAdaptiveComparables() cherche dans 'dvf_sales'
       ↓
Trouve des comparables dans un rayon de 500-800m
       ↓
Calcule statistiques (moyenne, médiane, prix ajusté)
       ↓
Retourne l'estimation à l'utilisateur
```

---

### 3. Vérification que Tout Fonctionne

**Test Simple :**

1. **Allez sur `/admin/dvf`**
   - Vérifiez que le "Total Transactions" affiche > 0
   - Vous devriez voir ~900 000 transactions après un chargement complet

2. **Testez une estimation**
   - Allez sur la page principale
   - Entrez : "15 Avenue des Champs-Élysées, 75008 Paris"
   - Type : Appartement, Surface : 85m²
   - **Vous devriez voir des comparables DVF s'afficher**

3. **Vérifiez via l'API directement**
   ```bash
   curl "https://app.alteregopatrimoine.com/api/dvf/comparables?lat=48.8698&lng=2.3085&type=appartement&surface=85&radiusMeters=500&months=24"
   ```
   - Devrait retourner des comparables avec statistiques

---

## 🔄 Mise à Jour des Données

### Quand Mettre à Jour ?

Les données DVF sont mises à jour régulièrement sur data.gouv.fr. Recommandation :
- **Tous les mois** : Pour avoir les transactions les plus récentes
- **Après un bug/corruption** : Utilisez "Vider la Base" puis rechargez

### Comment Mettre à Jour ?

**Option A : Rechargement Complet (Recommandé)**
1. Allez sur `/admin/dvf`
2. Cliquez sur "Vider la Base"
3. Confirmez la suppression
4. Cliquez sur "Charger les Données DVF"
5. Attendez 15-30 minutes

**Option B : Rechargement Sans Vider**
- Le script `ingest-all-france.js` supprime automatiquement les anciennes données **département par département**
- Donc vous pouvez cliquer sur "Charger les Données DVF" directement
- Les données seront rafraîchies progressivement

---

## 📈 Monitoring & Statistiques

### Page Admin DVF

**Statistiques Disponibles :**
- **Total Transactions** : Nombre total dans la base
- **Appartements** : Nombre d'appartements
- **Maisons** : Nombre de maisons
- **Top 10 Départements** : Classement par volume
- **Dernière Mise à Jour** : Date du dernier import

**Pendant l'Ingestion :**
- ✅ Progression en % (département par département)
- 📍 Département en cours
- ✅ Nombre de départements terminés
- ❌ Nombre d'échecs
- 📝 Logs en temps réel

---

## 🐛 Dépannage

### Problème : "0 Transactions" après un chargement

**Cause possible :** L'ingestion a échoué

**Solution :**
1. Regardez les logs dans `/admin/dvf`
2. Vérifiez s'il y a des départements en échec
3. Relancez le chargement

**Vérification MongoDB directe (SSH) :**
```bash
docker exec -it <container-id> sh
mongosh mongodb://<mongo-url>/alterego_db --eval "db.dvf_sales.countDocuments()"
```

---

### Problème : Estimations ne fonctionnent toujours pas

**Checklist :**
1. ✅ Vérifiez que `dvf_sales` contient des données (`/admin/dvf`)
2. ✅ Testez l'API comparables directement (voir section "Vérification")
3. ✅ Vérifiez que la variable `MONGO_URL` est correcte dans Dokploy
4. ✅ Redémarrez le conteneur si nécessaire

---

### Problème : L'ingestion se bloque

**Cause :** Un département peut être lent ou indisponible

**Solution :**
- L'ingestion continue même si un département échoue
- Attendez la fin (peut prendre jusqu'à 30-45 minutes)
- Les départements en échec sont listés dans les logs
- Vous pouvez les re-télécharger manuellement plus tard

---

## 🎉 Résultat Final

Après un chargement complet réussi, vous aurez :

| Métrique | Valeur Attendue |
|----------|----------------|
| **Total Transactions** | ~900 000+ |
| **Appartements** | ~400 000 |
| **Maisons** | ~500 000 |
| **Départements** | 101 (France + DOM-TOM) |
| **Années** | 5 dernières années |
| **Estimations** | ✅ Fonctionnelles sur toute la France |

---

## 🔒 Sécurité

- ✅ Tous les endpoints admin nécessitent un JWT valide
- ✅ Le token est stocké dans `localStorage`
- ✅ Expiration automatique après 24h
- ✅ Seul l'admin (Micael) peut accéder à `/admin/dvf`

---

## 📞 Support

En cas de problème persistant :
1. Vérifiez les logs Dokploy
2. Consultez `/tmp/dvf-ingestion.log` dans le conteneur
3. Testez l'API DVF directement

---

**Document créé le :** 2025-01-15  
**Version :** 1.0  
**Auteur :** AlterEgo Development Team
