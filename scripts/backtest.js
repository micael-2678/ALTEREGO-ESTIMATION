#!/usr/bin/env node
/**
 * Recalibrage du modèle : rejoue l'estimation de ventes DVF réelles et récentes,
 * à leur date de vente, en les retirant des comparables, puis compare au prix signé.
 *
 * Usage : node scripts/backtest.js [nombre_de_ventes=300] [departement]
 * Exemple : node scripts/backtest.js 500 75
 *
 * Seules la surface et le type sont connus pour une vente DVF (pas de DPE, d'étage…) :
 * le test mesure donc la justesse du prix de référence du quartier et du calibrage global.
 */
import { connectToDatabase } from '../lib/mongodb.js';
import { getAdaptiveComparables } from '../lib/dvf-enhanced.js';
import { calculateAdjustments, calculateAdjustedPrice } from '../lib/dvf-adjustments.js';
import { CALIBRATION } from '../lib/config-adjustments.js';

const sampleSize = parseInt(process.argv[2], 10) || 300;
const department = process.argv[3];

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const pct = (x) => `${(x * 100).toFixed(1)} %`;

function report(label, rows) {
  if (rows.length === 0) {
    console.log(`\n${label} : aucune vente estimable`);
    return;
  }
  const baseErrors = rows.map(r => r.basePredicted / r.actual - 1);
  const modelErrors = rows.map(r => r.modelPredicted / r.actual - 1);
  const within = (errors, limit) => errors.filter(e => Math.abs(e) <= limit).length / errors.length;
  // Offset qui annule le biais médian du prix de référence : actual = base × (1 + offset)
  const recommendedOffset = median(rows.map(r => r.actual / r.basePredicted - 1));

  console.log(`\n${label} (${rows.length} ventes)`);
  console.log(`  Prix de référence seul   : biais médian ${pct(median(baseErrors))}, erreur médiane ${pct(median(baseErrors.map(Math.abs)))}, à ±10 % : ${pct(within(baseErrors, 0.1))}, à ±20 % : ${pct(within(baseErrors, 0.2))}`);
  console.log(`  Modèle actuel (offset ${pct(CALIBRATION.global_offset)}) : biais médian ${pct(median(modelErrors))}, erreur médiane ${pct(median(modelErrors.map(Math.abs)))}, à ±10 % : ${pct(within(modelErrors, 0.1))}`);
  console.log(`  → CALIBRATION_OFFSET recommandé : ${recommendedOffset.toFixed(3)}`);
}

async function main() {
  const { db, client } = await connectToDatabase();
  const collection = db.collection('dvf_sales');

  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const match = { date_mutation: { $gte: oneYearAgo }, prix_m2: { $gt: 0 } };
  if (department) match.code_departement = department;

  const sales = await collection.aggregate([{ $match: match }, { $sample: { size: sampleSize } }]).toArray();
  console.log(`${sales.length} ventes tirées au hasard (12 derniers mois${department ? `, département ${department}` : ''})`);

  const rows = { appartement: [], maison: [] };
  let skipped = 0;

  for (const [i, sale] of sales.entries()) {
    const dvf = await getAdaptiveComparables({
      lat: sale.latitude,
      lng: sale.longitude,
      type: sale.type_local,
      surface: sale.surface_reelle_bati,
      excludeIds: [sale._id],
      now: new Date(sale.date_mutation).getTime()
    });
    if (!dvf.stats) {
      skipped++;
      continue;
    }

    const adjustments = calculateAdjustments({ type: sale.type_local, surface: sale.surface_reelle_bati }, dvf);
    const price = calculateAdjustedPrice(dvf.stats.weightedAverage, sale.surface_reelle_bati, adjustments, dvf);
    rows[sale.type_local].push({
      actual: sale.prix_m2,
      basePredicted: dvf.stats.weightedAverage,
      modelPredicted: price.adjustedPricePerM2
    });

    if ((i + 1) % 50 === 0) console.log(`  ${i + 1}/${sales.length}…`);
  }

  report('Appartements', rows.appartement);
  report('Maisons', rows.maison);
  report('Ensemble', [...rows.appartement, ...rows.maison]);
  console.log(`\n${skipped} vente(s) sans comparable ignorée(s).`);

  await client.close();
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
