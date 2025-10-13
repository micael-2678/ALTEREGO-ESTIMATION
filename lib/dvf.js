import { getCollection } from './mongodb';
import { parse } from 'csv-parse/sync';

// Haversine formula to calculate distance between two coordinates
export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

// Get DVF comparables
export async function getDVFComparables({
  lat,
  lng,
  type,
  surface,
  radiusMeters = 1000,
  months = 24
}) {
  const collection = await getCollection('dvf_sales');
  
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - months);
  
  // For MongoDB, we'll do a simple box query first, then filter by actual distance
  const latDelta = radiusMeters / 111000; // Approximate degrees
  const lngDelta = radiusMeters / (111000 * Math.cos(lat * Math.PI / 180));
  
  const sales = await collection.find({
    latitude: { $gte: lat - latDelta, $lte: lat + latDelta },
    longitude: { $gte: lng - lngDelta, $lte: lng + lngDelta },
    type_local: type === 'appartement' ? 'Appartement' : 'Maison',
    date_mutation: { $gte: cutoffDate.toISOString().split('T')[0] },
    surface_reelle_bati: { $gt: 0 },
    valeur_fonciere: { $gt: 0 }
  }).toArray();
  
  // Filter by actual distance and surface similarity
  const comparables = sales
    .map(sale => {
      const distance = calculateDistance(lat, lng, sale.latitude, sale.longitude);
      return { ...sale, distance };
    })
    .filter(sale => 
      sale.distance <= radiusMeters &&
      sale.surface_reelle_bati >= surface * 0.7 &&
      sale.surface_reelle_bati <= surface * 1.3
    )
    .sort((a, b) => a.distance - b.distance);
  
  // Calculate statistics
  if (comparables.length === 0) {
    return {
      count: 0,
      comparables: [],
      stats: null
    };
  }
  
  const pricesPerM2 = comparables.map(c => c.valeur_fonciere / c.surface_reelle_bati);
  const mean = pricesPerM2.reduce((a, b) => a + b, 0) / pricesPerM2.length;
  const sortedPrices = [...pricesPerM2].sort((a, b) => a - b);
  const median = sortedPrices.length % 2 === 0
    ? (sortedPrices[sortedPrices.length / 2 - 1] + sortedPrices[sortedPrices.length / 2]) / 2
    : sortedPrices[Math.floor(sortedPrices.length / 2)];
  
  // Standard deviation
  const variance = pricesPerM2.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / pricesPerM2.length;
  const stdDev = Math.sqrt(variance);
  
  // Weighted average (by proximity and recency)
  const now = Date.now();
  let weightedSum = 0;
  let weightSum = 0;
  
  comparables.forEach(sale => {
    const pricePerM2 = sale.valeur_fonciere / sale.surface_reelle_bati;
    const distanceWeight = 1 - (sale.distance / radiusMeters); // Closer = higher weight
    const saleDate = new Date(sale.date_mutation).getTime();
    const ageMonths = (now - saleDate) / (1000 * 60 * 60 * 24 * 30);
    const recencyWeight = 1 - (ageMonths / months); // More recent = higher weight
    
    const totalWeight = (distanceWeight * 0.6 + recencyWeight * 0.4);
    weightedSum += pricePerM2 * totalWeight;
    weightSum += totalWeight;
  });
  
  const weightedAverage = weightSum > 0 ? weightedSum / weightSum : mean;
  
  // Confidence index (0-100)
  const countScore = Math.min(comparables.length / 10, 1) * 40; // Max 40 points for count
  const proximityScore = Math.min(1 - (comparables[0].distance / radiusMeters), 1) * 30; // Max 30 points for proximity
  const recencyScore = Math.min(1, 1) * 30; // Max 30 points for recency
  const confidenceIndex = Math.round(countScore + proximityScore + recencyScore);
  
  return {
    count: comparables.length,
    radius: radiusMeters,
    months,
    stats: {
      meanPricePerM2: Math.round(mean),
      medianPricePerM2: Math.round(median),
      stdDev: Math.round(stdDev),
      weightedAverage: Math.round(weightedAverage),
      confidenceIndex
    },
    comparables: comparables.slice(0, 20).map(c => ({
      id: c._id,
      address: `${c.numero_voie || ''} ${c.type_voie || ''} ${c.voie || ''}, ${c.code_postal || ''} ${c.commune || ''}`.trim(),
      price: c.valeur_fonciere,
      surface: c.surface_reelle_bati,
      pricePerM2: Math.round(c.valeur_fonciere / c.surface_reelle_bati),
      date: c.date_mutation,
      distance: Math.round(c.distance),
      latitude: c.latitude,
      longitude: c.longitude
    }))
  };
}

// Parse and import DVF CSV data
export async function importDVFData(csvContent) {
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    delimiter: ','
  });
  
  const collection = await getCollection('dvf_sales');
  
  const sales = records
    .filter(r => r.latitude && r.longitude && r.valeur_fonciere && r.surface_reelle_bati)
    .map(record => ({
      date_mutation: record.date_mutation,
      numero_voie: record.numero_voie,
      type_voie: record.type_voie,
      voie: record.voie,
      code_postal: record.code_postal,
      commune: record.commune,
      code_departement: record.code_departement,
      type_local: record.type_local,
      surface_reelle_bati: parseFloat(record.surface_reelle_bati),
      nombre_pieces_principales: parseInt(record.nombre_pieces_principales) || 0,
      valeur_fonciere: parseFloat(record.valeur_fonciere),
      latitude: parseFloat(record.latitude),
      longitude: parseFloat(record.longitude)
    }));
  
  if (sales.length > 0) {
    await collection.createIndex({ latitude: 1, longitude: 1 });
    await collection.createIndex({ date_mutation: -1 });
    await collection.createIndex({ type_local: 1 });
    
    // Insert in batches to avoid memory issues
    const batchSize = 1000;
    for (let i = 0; i < sales.length; i += batchSize) {
      const batch = sales.slice(i, i + batchSize);
      await collection.insertMany(batch, { ordered: false }).catch(() => {});
    }
  }
  
  return sales.length;
}