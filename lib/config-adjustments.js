/**
 * CONFIGURATION CENTRALE - MOTEUR D'AJUSTEMENT & CONFIANCE
 * 
 * Modifiez ces valeurs pour affiner le comportement de l'estimation.
 * Tous les poids sont en pourcentage (ex: 10 = ±10%)
 */

// ============================================
// 1. POIDS DES AJUSTEMENTS (bonus/malus €/m²)
// ============================================

export const ADJUSTMENT_WEIGHTS = {
  // Étage & ascenseur (appartement uniquement) - RÉDUIT
  floor_elevator: 8,         // ±8% max (était 10%)
  
  // Extérieur (balcon, terrasse, jardin) - RÉDUIT
  outside: 6,                // ±6% max (était 8%)
  
  // Vue depuis le bien - RÉDUIT
  view: 5,                   // ±5% max (était 6%)
  
  // Stationnement - CONSERVÉ
  parking: 4,                // ±4% max
  
  // État intérieur / standing - CONSERVÉ/RENFORCÉ
  condition: 12,             // ±12% max
  
  // DPE (performance énergétique) - RENFORCÉ
  dpe: 12,                   // ±12% max
  
  // Effet de surface (très petit/très grand) - RÉDUIT
  surface_effect: 5,         // ±5% max (était 6%)
  
  // Parcelle (maison uniquement) - RÉDUIT
  plot: 6,                   // ±6% max (était 8%)
  
  // Équipements maison (piscine, dépendance) - CONSERVÉ
  house_extras: 5            // ±5% max
};

// ============================================
// 2. BORNES ANTI-DÉRIVE
// ============================================

export const DRIFT_LIMITS = {
  // Zone dense (≥12 comparables) - ASYMÉTRIQUE (limiter hausse)
  dense_max_positive: 0.15,  // +15% maximum (était +25%)
  dense_max_negative: 0.25,  // -25% maximum
  
  // Zone peu dense (<12 comparables) - ASYMÉTRIQUE
  sparse_max_positive: 0.20, // +20% maximum (était +30%)
  sparse_max_negative: 0.30, // -30% maximum
  
  // Seuil pour considérer une zone comme "dense"
  dense_threshold: 12        // nombre de comparables
};

// ============================================
// 3. SEUILS D'EFFET DE SURFACE
// ============================================

export const SURFACE_THRESHOLDS = {
  // Appartements
  apartment_very_small: 35,     // <35m² → bonus (prisé pour investissement)
  apartment_small: 45,          // <45m² → léger bonus
  apartment_very_large: 120,    // >120m² → malus (moins liquide)
  
  // Maisons
  house_very_large: 180         // >180m² → malus (marché plus restreint)
};

// ============================================
// 4. SEUILS EXTÉRIEUR (balcon/terrasse)
// ============================================

export const OUTSIDE_THRESHOLDS = {
  // Surface qui différencie balcon de terrasse
  small_vs_large: 15            // >15m² → large_terrace, sinon small_balcony
};

// ============================================
// 5. ALGORITHME ADAPTATIF DVF
// ============================================

export const DVF_ADAPTIVE = {
  // Rayon de recherche
  initial_radius_meters: 500,   // Rayon initial
  max_radius_meters: 800,       // Rayon maximum
  radius_step: 100,             // Augmentation par étape
  
  // Fenêtre temporelle
  initial_months: 24,           // Fenêtre initiale (2 ans)
  max_months: 36,               // Fenêtre maximum (3 ans)
  months_step: 6,               // Augmentation par étape
  
  // Nombre minimum de comparables souhaités
  min_comparables: 8,           // Objectif minimum
  
  // Tolérance de surface
  initial_surface_tolerance: 0.15,  // ±15% initialement
  expanded_surface_tolerance: 0.25, // ±25% si peu de données
  attempts_before_expand: 2         // Tentatives avant élargissement
};

// ============================================
// 6. NETTOYAGE OUTLIERS
// ============================================

export const OUTLIER_CLEANING = {
  percentile_low: 0.01,         // Couper 1er percentile
  percentile_high: 0.99,        // Couper 99e percentile
  iqr_multiplier: 1.5,          // Multiplicateur IQR (1.5 = standard)
  sigma_multiplier: 2,          // Nombre de sigmas (2 = 95% des données)
  min_comparables_for_cleaning: 4  // Minimum pour appliquer le nettoyage
};

// ============================================
// 7. CALCUL DE CONFIANCE
// ============================================

export const CONFIDENCE_CALCULATION = {
  // Base de départ
  base_confidence: 55,
  
  // Bonus pour nombre de comparables
  bonus_comparables: {
    excellent: { threshold: 15, points: 18 },  // ≥15 comparables
    very_good: { threshold: 10, points: 15 },  // ≥10 comparables
    good: { threshold: 6, points: 12 },        // ≥6 comparables
    fair: { threshold: 3, points: 8 }          // ≥3 comparables
  },
  
  // Bonus pour récence
  bonus_recency: {
    excellent: { threshold: 12, points: 10 },  // ≤12 mois
    very_good: { threshold: 18, points: 8 },   // ≤18 mois
    good: { threshold: 24, points: 6 },        // ≤24 mois
    fair: { threshold: 30, points: 4 }         // ≤30 mois
  },
  
  // Bonus pour proximité
  bonus_proximity: {
    excellent: { threshold: 400, points: 10 }, // ≤400m
    very_good: { threshold: 500, points: 8 },  // ≤500m
    good: { threshold: 600, points: 6 },       // ≤600m
    fair: { threshold: 700, points: 4 }        // ≤700m
  },
  
  // Pénalité dispersion (écart-type / médiane)
  penalty_dispersion: {
    high: { threshold: 0.5, points: -8 },      // Ratio >50%
    medium: { threshold: 0.4, points: -5 },    // Ratio >40%
    low: { threshold: 0.3, points: -3 }        // Ratio >30%
  },
  
  // Bornes finales
  min_confidence: 65,           // Minimum affiché
  max_confidence: 90            // Maximum affiché (pour crédibilité)
};

// ============================================
// 8. FOURCHETTES D'INCERTITUDE
// ============================================

export const UNCERTAINTY_BANDS = {
  // Selon l'indice de confiance
  excellent: { min_confidence: 85, band: 0.06 },  // ±6% si confiance ≥85
  very_good: { min_confidence: 75, band: 0.07 },  // ±7% si confiance ≥75
  good: { min_confidence: 70, band: 0.08 },       // ±8% si confiance ≥70
  fair: { min_confidence: 0, band: 0.10 }         // ±10% sinon
};

// ============================================
// 9. WARNINGS & SEUILS D'ALERTE
// ============================================

export const WARNING_THRESHOLDS = {
  // Afficher warning si confiance basse
  confidence_warning: 50,       // <50% → "RDV expert recommandé"
  confidence_caution: 65,       // <65% → "Données limitées"
  
  // Nombre minimum de comparables
  min_comparables_warning: 5,   // <5 → warning zone peu dense
  
  // Dispersion élevée
  high_dispersion_ratio: 0.4    // >40% → warning marché hétérogène
};

// ============================================
// 10. SEUILS PARCELLE (MAISON)
// ============================================

export const PLOT_THRESHOLDS = {
  small_max: 300,               // <300m² → petite parcelle
  medium_max: 600               // 300-600m² → moyenne, >600 → grande
};

// ============================================
// 11. OFFSET GLOBAL & CALIBRATION
// ============================================

export const CALIBRATION = {
  // Offset global provisoire pour corriger surévaluation
  global_offset: -0.08,      // -8% sur le prix ajusté (était -5%)
  
  // Seuils pour clamping prudent (faible confiance)
  clamp_confidence_threshold: 65,
  clamp_comparables_threshold: 8,
  clamp_range: 0.03,         // ±3% autour de DVF si clamp activé
  
  // Activer/désactiver offset
  apply_offset: true
};

/**
 * Récupère tous les poids d'ajustement
 */
export function getAdjustmentWeights() {
  return { ...ADJUSTMENT_WEIGHTS };
}

/**
 * Met à jour un poids spécifique
 */
export function updateAdjustmentWeight(factor, newWeight) {
  if (ADJUSTMENT_WEIGHTS.hasOwnProperty(factor)) {
    ADJUSTMENT_WEIGHTS[factor] = newWeight;
    return true;
  }
  return false;
}

/**
 * Récupère la configuration de confiance
 */
export function getConfidenceConfig() {
  return { ...CONFIDENCE_CALCULATION };
}

/**
 * Récupère la configuration complète
 */
export function getAllConfig() {
  return {
    adjustmentWeights: ADJUSTMENT_WEIGHTS,
    driftLimits: DRIFT_LIMITS,
    surfaceThresholds: SURFACE_THRESHOLDS,
    outsideThresholds: OUTSIDE_THRESHOLDS,
    dvfAdaptive: DVF_ADAPTIVE,
    outlierCleaning: OUTLIER_CLEANING,
    confidenceCalculation: CONFIDENCE_CALCULATION,
    uncertaintyBands: UNCERTAINTY_BANDS,
    warningThresholds: WARNING_THRESHOLDS,
    plotThresholds: PLOT_THRESHOLDS
  };
}

/**
 * Reset tous les paramètres aux valeurs par défaut
 */
export function resetToDefaults() {
  // Cette fonction rechargerait les valeurs initiales
  console.log('Configuration reset to defaults');
}
