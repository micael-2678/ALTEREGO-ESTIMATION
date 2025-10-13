# 📊 GUIDE D'AJUSTEMENT - Variables de Configuration

## Vue d'ensemble

Ce document explique comment ajuster chaque variable pour affiner le comportement du moteur d'estimation AlterEgo.

---

## 🎯 1. POIDS DES AJUSTEMENTS (ADJUSTMENT_WEIGHTS)

### Impact : Direct sur le prix final €/m²

**Variables disponibles :**

```javascript
floor_elevator: 10    // Étage + ascenseur (appartement)
outside: 10          // Balcon/terrasse/jardin
view: 8              // Vue
parking: 6           // Stationnement
condition: 12        // État/standing
dpe: 10              // Performance énergétique
surface_effect: 8    // Effet taille
plot: 10             // Parcelle (maison)
house_extras: 6      // Piscine/dépendance
```

**Comment ajuster :**
- **Augmenter** si vous pensez que ce critère a plus d'impact sur le marché
- **Diminuer** si l'impact doit être plus subtil
- **Valeurs recommandées :** 5-15% pour rester réaliste

**Exemples d'ajustement :**
```javascript
// Si le DPE devient crucial (passoires thermiques interdites)
dpe: 15  // Au lieu de 10

// Si le standing est moins important dans votre zone
condition: 8  // Au lieu de 12

// Si les parkings sont critiques en zone dense
parking: 10  // Au lieu de 6
```

---

## 🛡️ 2. BORNES ANTI-DÉRIVE (DRIFT_LIMITS)

### Impact : Empêche les estimations aberrantes

**Variables disponibles :**

```javascript
dense_max_impact: 0.25     // ±25% max en zone dense
sparse_max_impact: 0.30    // ±30% max en zone peu dense
dense_threshold: 12        // Seuil pour "zone dense"
```

**Comment ajuster :**
- **Augmenter** si vous voulez autoriser plus de variation
- **Diminuer** pour rester plus proche de la base DVF

**Exemples :**
```javascript
// Plus conservateur (rester proche DVF)
dense_max_impact: 0.20     // ±20% au lieu de 25%
sparse_max_impact: 0.25    // ±25% au lieu de 30%

// Plus permissif (autoriser plus d'ajustements)
dense_max_impact: 0.30     // ±30%
sparse_max_impact: 0.35    // ±35%
```

---

## 📏 3. SEUILS DE SURFACE (SURFACE_THRESHOLDS)

### Impact : Détermine quand appliquer bonus/malus de surface

**Variables disponibles :**

```javascript
apartment_very_small: 35   // Studios <35m²
apartment_small: 45        // Petits apparts <45m²
apartment_very_large: 120  // Grands apparts >120m²
house_very_large: 180      // Grandes maisons >180m²
```

**Comment ajuster :**
- Basé sur votre marché local
- Grandes villes : seuils plus bas (studios 30m²)
- Zones rurales : seuils plus hauts (maisons 200m²+)

**Exemples :**
```javascript
// Marché parisien (petites surfaces prisées)
apartment_very_small: 25   // Même les 25m² sont chers
apartment_small: 40
apartment_very_large: 100  // >100m² déjà très grand

// Marché provincial (grandes surfaces normales)
apartment_very_large: 140  // >140m² pour être "très grand"
house_very_large: 220
```

---

## 🔍 4. ALGORITHME ADAPTATIF DVF (DVF_ADAPTIVE)

### Impact : Comment le système recherche les comparables

**Variables disponibles :**

```javascript
initial_radius_meters: 500  // Rayon de départ
max_radius_meters: 800      // Rayon maximum
radius_step: 100            // Augmentation par étape

initial_months: 24          // 2 ans de données
max_months: 36              // 3 ans maximum
months_step: 6              // +6 mois par étape

min_comparables: 8          // Objectif minimum
```

**Comment ajuster :**

**Pour zones denses (Paris, Lyon, etc.) :**
```javascript
initial_radius_meters: 300  // Commencer plus serré
max_radius_meters: 500      // Ne pas aller trop loin
min_comparables: 10         // Exiger plus de comparables
```

**Pour zones rurales :**
```javascript
initial_radius_meters: 1000 // Plus large dès le départ
max_radius_meters: 2000     // Accepter zone plus large
min_comparables: 5          // Accepter moins de comparables
```

**Pour marché volatile :**
```javascript
initial_months: 18          // Données plus récentes
max_months: 24              // Ne pas remonter trop loin
```

---

## 🧮 5. CALCUL DE CONFIANCE (CONFIDENCE_CALCULATION)

### Impact : L'indice affiché 0-100

**Structure actuelle :**

```javascript
base_confidence: 55

// Nombre de comparables (max +18 points)
≥15 comparables → +18
≥10 comparables → +15
≥6 comparables  → +12
≥3 comparables  → +8

// Récence (max +10 points)
≤12 mois → +10
≤18 mois → +8
≤24 mois → +6
≤30 mois → +4

// Proximité (max +10 points)
≤400m → +10
≤500m → +8
≤600m → +6
≤700m → +4

// Dispersion (max -8 points)
>50% → -8
>40% → -5
>30% → -3

Bornes: 65-90%
```

**Comment ajuster :**

### Pour augmenter la confiance générale :
```javascript
base_confidence: 60  // Au lieu de 55

bonus_comparables: {
  good: { threshold: 5, points: 12 }  // Plus facile (était 6)
}

bonus_proximity: {
  good: { threshold: 700, points: 6 }  // Plus généreux (était 600)
}
```

### Pour être plus strict :
```javascript
base_confidence: 50  // Réduit

bonus_comparables: {
  good: { threshold: 8, points: 12 }  // Plus difficile (était 6)
}

min_confidence: 60  // Minimum affiché plus élevé
```

### Pour cibler spécifiquement 75% :
```javascript
base_confidence: 50
// Ajuster les seuils pour que la moyenne des cas donne 75
bonus_comparables.very_good: { threshold: 8, points: 15 }
```

---

## 📊 6. FOURCHETTES D'INCERTITUDE (UNCERTAINTY_BANDS)

### Impact : La largeur de la fourchette prix bas/haut

**Variables disponibles :**

```javascript
excellent: { min_confidence: 85, band: 0.06 }  // ±6%
very_good: { min_confidence: 75, band: 0.07 }  // ±7%
good: { min_confidence: 70, band: 0.08 }       // ±8%
fair: { min_confidence: 0, band: 0.10 }        // ±10%
```

**Comment ajuster :**

**Pour fourchettes plus serrées (inspire confiance) :**
```javascript
excellent: { min_confidence: 85, band: 0.05 }  // ±5%
very_good: { min_confidence: 75, band: 0.06 }  // ±6%
good: { min_confidence: 70, band: 0.07 }       // ±7%
fair: { min_confidence: 0, band: 0.08 }        // ±8%
```

**Pour fourchettes plus larges (plus prudent) :**
```javascript
excellent: { min_confidence: 85, band: 0.08 }  // ±8%
very_good: { min_confidence: 75, band: 0.10 }  // ±10%
good: { min_confidence: 70, band: 0.12 }       // ±12%
fair: { min_confidence: 0, band: 0.15 }        // ±15%
```

---

## ⚠️ 7. SEUILS D'ALERTE (WARNING_THRESHOLDS)

### Impact : Quand afficher des warnings

**Variables disponibles :**

```javascript
confidence_warning: 50       // <50% → "RDV expert recommandé"
confidence_caution: 65       // <65% → "Données limitées"
min_comparables_warning: 5   // <5 → warning
high_dispersion_ratio: 0.4   // >40% → warning
```

**Comment ajuster :**

**Plus strict (warnings fréquents) :**
```javascript
confidence_warning: 60       // Warning dès 60%
confidence_caution: 70
min_comparables_warning: 8   // Exiger 8 comparables
```

**Plus permissif (moins de warnings) :**
```javascript
confidence_warning: 40       // Warning seulement <40%
confidence_caution: 55
min_comparables_warning: 3
```

---

## 🎓 SCÉNARIOS D'USAGE

### Scénario 1 : Marché parisien ultra-dense
```javascript
DVF_ADAPTIVE = {
  initial_radius_meters: 200,
  max_radius_meters: 400,
  min_comparables: 12
}

CONFIDENCE_CALCULATION.base_confidence = 60
UNCERTAINTY_BANDS.very_good.band = 0.05  // ±5%
```

### Scénario 2 : Zone rurale peu dense
```javascript
DVF_ADAPTIVE = {
  initial_radius_meters: 1500,
  max_radius_meters: 3000,
  min_comparables: 4
}

CONFIDENCE_CALCULATION.base_confidence = 50
UNCERTAINTY_BANDS.fair.band = 0.15  // ±15%
```

### Scénario 3 : Viser confiance 75% systématiquement
```javascript
CONFIDENCE_CALCULATION = {
  base_confidence: 58,
  bonus_comparables.good: { threshold: 5, points: 15 },
  bonus_recency.good: { threshold: 30, points: 6 },
  bonus_proximity.good: { threshold: 800, points: 6 },
  min_confidence: 70,
  max_confidence: 85
}
```

---

## 🔧 COMMENT APPLIQUER VOS MODIFICATIONS

1. **Éditez le fichier** : `/app/lib/config-adjustments.js`
2. **Modifiez les valeurs** selon ce guide
3. **Redémarrez le serveur** : `sudo supervisorctl restart nextjs`
4. **Testez** avec plusieurs adresses
5. **Ajustez** itérativement

---

## 📈 MÉTRIQUES À SURVEILLER

Après modifications, vérifiez :

✅ **Distribution confiance** : Moyenne autour de 75% ?
✅ **Fourchettes prix** : Ni trop serrées ni trop larges ?
✅ **Warnings** : Ni trop fréquents ni trop rares ?
✅ **Cohérence prix** : Estimations réalistes vs marché ?

---

## 💡 CONSEILS FINAUX

1. **Changez 1 variable à la fois** pour comprendre l'impact
2. **Testez sur 10-20 adresses** variées avant de valider
3. **Gardez une copie** des valeurs originales
4. **Documentez** vos changements et leur raison

**Support :** Pour toute question, référez-vous aux tests dans `test_result.md`
