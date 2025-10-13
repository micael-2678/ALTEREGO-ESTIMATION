// Moteur d'ajustement €/m² avec bonus/malus

// Configuration des poids par défaut (éditables en admin)
const DEFAULT_WEIGHTS = {
  floor_elevator: 10,      // Étage & ascenseur (appartement)
  outside: 10,             // Extérieur (balcon/terrasse)
  view: 8,                 // Vue
  parking: 6,              // Stationnement
  condition: 12,           // État intérieur
  dpe: 10,                 // DPE
  surface_effect: 8,       // Effet de surface
  plot: 10,                // Parcelle (maison)
  house_extras: 6          // Extras maison
};

// Calculer l'ajustement pour étage + ascenseur (appartement)
function adjustFloorElevator(floor, hasElevator, type) {
  if (type !== 'appartement') return 0;
  
  if (!hasElevator) {
    if (floor === '4+') return -2;
    if (floor === '1-3') return -1;
    return 0;
  }
  
  // Avec ascenseur
  if (floor === 'rdc') return -1; // RDC même avec ascenseur
  if (floor === '4+') return 2;   // Dernier étage
  return 1;                        // Étages intermédiaires
}

// Ajustement extérieur
function adjustOutside(outside) {
  const levels = {
    'none': 0,
    'small_balcony': 1,
    'large_terrace_or_garden': 2
  };
  return levels[outside] || 0;
}

// Ajustement vue
function adjustView(view) {
  const levels = {
    'vis_a_vis': -2,
    'degagee': 1,
    'exceptionnelle': 2
  };
  return levels[view] || 0;
}

// Ajustement parking
function adjustParking(parking, isDense = false) {
  const levels = {
    'none': isDense ? -1 : 0,
    'one': 1,
    'box_or_two': 2
  };
  return levels[parking] || 0;
}

// Ajustement état/standing
function adjustCondition(condition) {
  const levels = {
    'to_renovate': -2,
    'good': 0,
    'renovated': 2
  };
  return levels[condition] || 0;
}

// Ajustement DPE
function adjustDPE(dpe) {
  const levels = {
    'A': 1, 'B': 1, 'C': 1,
    'D': 0,
    'E': -1,
    'F': -2, 'G': -2,
    'unknown': 0
  };
  return levels[dpe] || 0;
}

// Ajustement effet de surface
function adjustSurfaceEffect(surface, type) {
  if (type === 'appartement') {
    if (surface < 35) return 2;      // Très petit studio
    if (surface < 45) return 1;      // Petit
    if (surface > 120) return -1;    // Très grand appartement
  } else {
    if (surface > 180) return -1;    // Très grande maison
  }
  return 0;
}

// Ajustement parcelle (maison)
function adjustPlot(plot, type) {
  if (type !== 'maison') return 0;
  
  const levels = {
    'small': -1,
    'medium': 0,
    'large': 2
  };
  return levels[plot] || 0;
}

// Ajustement extras maison
function adjustHouseExtras(extras, type) {
  if (type !== 'maison') return 0;
  
  const levels = {
    'none': 0,
    'annex': 1,
    'pool_or_quality_extras': 2
  };
  return levels[extras] || 0;
}

// Calculer tous les ajustements
export function calculateAdjustments(characteristics, dvfStats, weights = DEFAULT_WEIGHTS) {
  const adjustments = [];
  let totalImpact = 0;
  
  const isDense = dvfStats.count >= 12; // Zone dense si beaucoup de comparables
  
  // 1. Étage & ascenseur (appartement)
  if (characteristics.type === 'appartement' && characteristics.floor) {
    const level = adjustFloorElevator(
      characteristics.floor,
      characteristics.hasElevator,
      characteristics.type
    );
    const impact = (weights.floor_elevator / 100) * (level / 2);
    totalImpact += impact;
    adjustments.push({
      factor: 'Étage & ascenseur',
      level,
      weight: weights.floor_elevator,
      impact: impact * 100, // en %
      description: getFloorDescription(characteristics.floor, characteristics.hasElevator)
    });
  }
  
  // 2. Extérieur
  if (characteristics.outside) {
    const level = adjustOutside(characteristics.outside);
    const impact = (weights.outside / 100) * (level / 2);
    totalImpact += impact;
    adjustments.push({
      factor: 'Extérieur',
      level,
      weight: weights.outside,
      impact: impact * 100,
      description: getOutsideDescription(characteristics.outside)
    });
  }
  
  // 3. Vue
  if (characteristics.view) {
    const level = adjustView(characteristics.view);
    const impact = (weights.view / 100) * (level / 2);
    totalImpact += impact;
    adjustments.push({
      factor: 'Vue',
      level,
      weight: weights.view,
      impact: impact * 100,
      description: getViewDescription(characteristics.view)
    });
  }
  
  // 4. Parking
  if (characteristics.parking) {
    const level = adjustParking(characteristics.parking, isDense);
    const impact = (weights.parking / 100) * (level / 2);
    totalImpact += impact;
    adjustments.push({
      factor: 'Stationnement',
      level,
      weight: weights.parking,
      impact: impact * 100,
      description: getParkingDescription(characteristics.parking)
    });
  }
  
  // 5. État/standing
  if (characteristics.condition) {
    const level = adjustCondition(characteristics.condition);
    const impact = (weights.condition / 100) * (level / 2);
    totalImpact += impact;
    adjustments.push({
      factor: 'État intérieur',
      level,
      weight: weights.condition,
      impact: impact * 100,
      description: getConditionDescription(characteristics.condition)
    });
  }
  
  // 6. DPE
  if (characteristics.dpe) {
    const level = adjustDPE(characteristics.dpe);
    const impact = (weights.dpe / 100) * (level / 2);
    totalImpact += impact;
    adjustments.push({
      factor: 'DPE',
      level,
      weight: weights.dpe,
      impact: impact * 100,
      description: `DPE ${characteristics.dpe}`
    });
  }
  
  // 7. Effet de surface
  if (characteristics.surface) {
    const level = adjustSurfaceEffect(characteristics.surface, characteristics.type);
    if (level !== 0) {
      const impact = (weights.surface_effect / 100) * (level / 2);
      totalImpact += impact;
      adjustments.push({
        factor: 'Effet de surface',
        level,
        weight: weights.surface_effect,
        impact: impact * 100,
        description: `${characteristics.surface}m²`
      });
    }
  }
  
  // 8. Parcelle (maison)
  if (characteristics.type === 'maison' && characteristics.plot) {
    const level = adjustPlot(characteristics.plot, characteristics.type);
    const impact = (weights.plot / 100) * (level / 2);
    totalImpact += impact;
    adjustments.push({
      factor: 'Parcelle',
      level,
      weight: weights.plot,
      impact: impact * 100,
      description: getPlotDescription(characteristics.plot)
    });
  }
  
  // 9. Extras maison
  if (characteristics.type === 'maison' && characteristics.houseExtras) {
    const level = adjustHouseExtras(characteristics.houseExtras, characteristics.type);
    const impact = (weights.house_extras / 100) * (level / 2);
    totalImpact += impact;
    adjustments.push({
      factor: 'Équipements',
      level,
      weight: weights.house_extras,
      impact: impact * 100,
      description: getHouseExtrasDescription(characteristics.houseExtras)
    });
  }
  
  // Bornes anti-dérive
  const maxImpact = isDense ? 0.25 : 0.30;
  totalImpact = Math.max(-maxImpact, Math.min(maxImpact, totalImpact));
  
  return {
    adjustments,
    totalImpact,
    totalImpactPercent: Math.round(totalImpact * 100)
  };
}

// Calculer le prix ajusté et la fourchette
export function calculateAdjustedPrice(basePricePerM2, surface, adjustmentResult, dvfStats) {
  // Prix/m² ajusté
  const adjustedPricePerM2 = Math.round(basePricePerM2 * (1 + adjustmentResult.totalImpact));
  
  // Calcul indice de confiance (réévalué pour viser ~75%)
  let confidence = 60; // Base augmentée de 50 à 60
  
  // Bonus pour nombre de comparables (critères plus accessibles)
  if (dvfStats.count >= 8) confidence += 15; // Au lieu de ≥12
  else if (dvfStats.count >= 5) confidence += 10;
  else if (dvfStats.count >= 3) confidence += 5;
  
  // Bonus pour récence
  if (dvfStats.months <= 18) confidence += 10; // Plus généreux (était ≤12)
  else if (dvfStats.months <= 24) confidence += 5;
  
  // Bonus pour proximité
  if (dvfStats.radius <= 600) confidence += 10; // Plus généreux (était ≤400)
  else if (dvfStats.radius <= 800) confidence += 5;
  
  // Pénalité dispersion (réduite)
  if (dvfStats.stdDev && dvfStats.medianPricePerM2) {
    const dispersionRatio = dvfStats.stdDev / dvfStats.medianPricePerM2;
    if (dispersionRatio > 0.4) confidence -= 5; // Réduit de -10 à -5
  }
  
  // Bornes (minimum 65, maximum 95 pour rester crédible)
  confidence = Math.max(65, Math.min(95, confidence));
  
  // Bande d'incertitude ajustée
  let uncertaintyBand;
  if (confidence >= 80) uncertaintyBand = 0.06; // ±6%
  else if (confidence >= 70) uncertaintyBand = 0.08; // ±8%
  else uncertaintyBand = 0.10; // ±10%
  
  // Prix final
  const priceMid = Math.round(adjustedPricePerM2 * surface);
  const priceLow = Math.round(priceMid * (1 - uncertaintyBand));
  const priceHigh = Math.round(priceMid * (1 + uncertaintyBand));
  
  return {
    basePricePerM2,
    adjustedPricePerM2,
    priceMid,
    priceLow,
    priceHigh,
    confidence,
    uncertaintyBand: Math.round(uncertaintyBand * 100)
  };
}

// Descriptions lisibles
function getFloorDescription(floor, hasElevator) {
  const floors = {
    'rdc': 'Rez-de-chaussée',
    '1-3': 'Étages 1-3',
    '4+': 'Étage 4+'
  };
  const asc = hasElevator ? 'avec ascenseur' : 'sans ascenseur';
  return `${floors[floor] || floor} ${asc}`;
}

function getOutsideDescription(outside) {
  const desc = {
    'none': 'Sans extérieur',
    'small_balcony': 'Petit balcon',
    'large_terrace_or_garden': 'Grande terrasse ou jardin'
  };
  return desc[outside] || outside;
}

function getViewDescription(view) {
  const desc = {
    'vis_a_vis': 'Vis-à-vis',
    'degagee': 'Vue dégagée',
    'exceptionnelle': 'Vue exceptionnelle'
  };
  return desc[view] || view;
}

function getParkingDescription(parking) {
  const desc = {
    'none': 'Aucun parking',
    'one': '1 place de parking',
    'box_or_two': 'Box ou 2 places'
  };
  return desc[parking] || parking;
}

function getConditionDescription(condition) {
  const desc = {
    'to_renovate': 'À rénover',
    'good': 'Bon état',
    'renovated': 'Rénové récent'
  };
  return desc[condition] || condition;
}

function getPlotDescription(plot) {
  const desc = {
    'small': 'Petite parcelle',
    'medium': 'Parcelle moyenne',
    'large': 'Grande parcelle'
  };
  return desc[plot] || plot;
}

function getHouseExtrasDescription(extras) {
  const desc = {
    'none': 'Aucun extra',
    'annex': 'Dépendance/Annexe',
    'pool_or_quality_extras': 'Piscine ou équipements de qualité'
  };
  return desc[extras] || extras;
}