import { getCollection } from './mongodb.js';
import { calculateDistance } from './dvf.js';
import { cleanOutliers } from './dvf-ingestion.js';

// Algorithme de sélection adaptatif des comparables
export async function getAdaptiveComparables({
  lat,
  lng,
  type,
  surface,
  initialRadiusMeters = 500,
  maxRadiusMeters = 800,
  months = 24,
  maxMonths = 36,
  minComparables = 8
}) {
  const collection = await getCollection('dvf_sales');
  
  let radius = initialRadiusMeters;
  let monthsWindow = months;
  let comparables = [];
  let attempt = 0;
  const maxAttempts = 5;
  
  // Stratégie adaptative
  while (comparables.length < minComparables && attempt < maxAttempts) {
    attempt++;
    
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - monthsWindow);
    
    // Calcul de la boîte englobante
    const latDelta = radius / 111000;
    const lngDelta = radius / (111000 * Math.cos(lat * Math.PI / 180));
    
    // Calcul de la tolérance de surface (±15% initialement, jusqu'à ±25%)
    const surfaceTolerance = attempt <= 2 ? 0.15 : 0.25;
    const minSurface = surface * (1 - surfaceTolerance);
    const maxSurface = surface * (1 + surfaceTolerance);
    
    console.log(`[DVF] Attempt ${attempt}: radius=${radius}m, months=${monthsWindow}, surface=${minSurface}-${maxSurface}m²`);
    
    // Query MongoDB
    const sales = await collection.find({
      latitude: { $gte: lat - latDelta, $lte: lat + latDelta },
      longitude: { $gte: lng - lngDelta, $lte: lng + lngDelta },
      type_local: type === 'appartement' ? 'appartement' : 'maison',
      date_mutation: { $gte: cutoffDate.toISOString().split('T')[0] },
      surface_reelle_bati: { $gte: minSurface, $lte: maxSurface },
      prix_m2: { $gt: 0 }
    }).toArray();
    
    // Filtrer par distance réelle
    comparables = sales
      .map(sale => {
        const distance = calculateDistance(lat, lng, sale.latitude, sale.longitude);
        return { ...sale, distance };
      })
      .filter(sale => sale.distance <= radius);
    
    console.log(`[DVF] Found ${comparables.length} raw comparables`);
    
    if (comparables.length >= minComparables) {
      break;
    }
    
    // Élargir les critères
    if (radius < maxRadiusMeters) {
      radius = Math.min(radius + 100, maxRadiusMeters);
    }
    if (monthsWindow < maxMonths && comparables.length < minComparables / 2) {
      monthsWindow = Math.min(monthsWindow + 6, maxMonths);
    }
  }
  
  if (comparables.length === 0) {
    return {
      count: 0,
      radius,
      months: monthsWindow,
      stats: null,
      comparables: [],
      confidence: 0,
      warning: 'Aucun comparable trouvé. Un RDV avec un expert est recommandé.'
    };
  }
  
  // Nettoyer les outliers statistiques
  const cleanedComparables = cleanOutliers(comparables);
  console.log(`[DVF] After outlier cleaning: ${cleanedComparables.length} comparables`);
  
  if (cleanedComparables.length === 0) {
    return {
      count: 0,
      radius,
      months: monthsWindow,
      stats: null,
      comparables: [],
      confidence: 0,
      warning: 'Données insuffisantes après nettoyage. Un RDV est recommandé.'
    };
  }
  
  // Trier par distance
  cleanedComparables.sort((a, b) => a.distance - b.distance);
  
  // Calcul des statistiques
  const pricesPerM2 = cleanedComparables.map(c => c.prix_m2);
  const mean = pricesPerM2.reduce((a, b) => a + b, 0) / pricesPerM2.length;
  
  const sortedPrices = [...pricesPerM2].sort((a, b) => a - b);
  const median = sortedPrices.length % 2 === 0
    ? (sortedPrices[sortedPrices.length / 2 - 1] + sortedPrices[sortedPrices.length / 2]) / 2
    : sortedPrices[Math.floor(sortedPrices.length / 2)];
  
  const variance = pricesPerM2.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / pricesPerM2.length;
  const stdDev = Math.sqrt(variance);
  
  // Moyenne pondérée (60% proximité + 40% récence)
  const now = Date.now();
  let weightedSum = 0;
  let weightSum = 0;
  
  cleanedComparables.forEach(sale => {
    const pricePerM2 = sale.prix_m2;
    const distanceWeight = 1 - (sale.distance / radius);
    const saleDate = new Date(sale.date_mutation).getTime();
    const ageMonths = (now - saleDate) / (1000 * 60 * 60 * 24 * 30);
    const recencyWeight = 1 - (ageMonths / monthsWindow);
    
    const totalWeight = (distanceWeight * 0.6 + recencyWeight * 0.4);
    weightedSum += pricePerM2 * totalWeight;
    weightSum += totalWeight;
  });
  
  const weightedAverage = weightSum > 0 ? weightedSum / weightSum : mean;
  
  // Indice de confiance (0-100)
  // 40 points: nombre de comparables (max 10)
  const countScore = Math.min(cleanedComparables.length / 10, 1) * 40;
  
  // 30 points: proximité du plus proche
  const closestDistance = cleanedComparables[0].distance;
  const proximityScore = Math.max(0, 1 - (closestDistance / radius)) * 30;
  
  // 30 points: récence moyenne
  const avgAge = cleanedComparables.reduce((sum, s) => {
    const saleDate = new Date(s.date_mutation).getTime();
    const ageMonths = (now - saleDate) / (1000 * 60 * 60 * 24 * 30);
    return sum + ageMonths;
  }, 0) / cleanedComparables.length;
  const recencyScore = Math.max(0, 1 - (avgAge / monthsWindow)) * 30;
  
  const confidenceIndex = Math.round(countScore + proximityScore + recencyScore);
  
  // Warning si confiance faible
  let warning = null;
  if (confidenceIndex < 50) {
    warning = 'Zone peu dense - estimation indicative. Un RDV avec un expert est recommandé pour affiner.';
  } else if (confidenceIndex < 65) {
    warning = 'Données limitées - estimation à considérer avec précaution.';
  }
  
  return {
    count: cleanedComparables.length,
    radius,
    months: monthsWindow,
    stats: {
      meanPricePerM2: Math.round(mean),
      medianPricePerM2: Math.round(median),
      stdDev: Math.round(stdDev),
      weightedAverage: Math.round(weightedAverage),
      confidenceIndex
    },
    comparables: cleanedComparables.slice(0, 20).map(c => ({
      id: c._id,
      // Masquer le numéro exact (privacy)
      address: `${c.numero_voie_masked || 'XX'} ${c.type_voie} ${c.voie}, ${c.code_postal} ${c.commune}`.trim(),
      price: c.valeur_fonciere,
      surface: c.surface_reelle_bati,
      pricePerM2: c.prix_m2,
      date: c.date_mutation,
      distance: Math.round(c.distance),
      latitude: c.latitude,
      longitude: c.longitude
    })),
    warning
  };
}