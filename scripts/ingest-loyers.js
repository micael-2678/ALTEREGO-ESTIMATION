// Import des références de loyers : Carte des loyers (data.gouv.fr) et encadrement Paris (opendata.paris.fr)
import { connectToDatabase } from '../lib/mongodb.js';
import { ingestCarteDesLoyers, ingestParisRentControl, importCarteFile, importParisFile } from '../lib/rent-ingestion.js';
import { RENT_CATEGORIES } from '../lib/config-rent.js';

process.env.MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017';
process.env.DB_NAME = process.env.DB_NAME || 'alterego_db';

const USAGE = `
Usage: node scripts/ingest-loyers.js <carte|paris|all> [options]

  carte   Carte des loyers (loyers d'annonce par commune, 4 fichiers CSV, ~35 000 communes)
  paris   Encadrement des loyers à Paris (loyers de référence par quartier, année la plus récente)
  all     Les deux

Options :
  --file <chemin>        importer un fichier local au lieu de télécharger
  --category <cat>       avec --file pour la Carte des loyers : ${RENT_CATEGORIES.join(' | ')}
  --year <aaaa>          millésime (Carte des loyers : année des annonces ; Paris : année de l'arrêté)

Variables : LOYERS_DATASET (identifiant data.gouv.fr d'un autre millésime), LOYERS_YEAR,
            PARIS_LOYERS_URL (GeoJSON), PARIS_LOYERS_YEAR

Exemples :
  node scripts/ingest-loyers.js all
  node scripts/ingest-loyers.js carte --file pred-app12-mef-dhup.csv --category appartement_1_2 --year 2025
  node scripts/ingest-loyers.js paris --file encadrement-2026.geojson
`;

function parseArgs(argv) {
  const options = { command: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      options[arg.slice(2)] = argv[i + 1];
      i++;
    } else if (!options.command) {
      options.command = arg;
    }
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!['carte', 'paris', 'all'].includes(options.command)) {
    console.log(USAGE);
    process.exit(1);
  }

  await connectToDatabase();
  console.log('✓ Connecté à MongoDB\n');

  if (options.command === 'carte' || options.command === 'all') {
    if (options.file) {
      if (!RENT_CATEGORIES.includes(options.category)) throw new Error(`--category requis avec --file (${RENT_CATEGORIES.join(' | ')})`);
      const year = Number(options.year || process.env.LOYERS_YEAR);
      if (!year) throw new Error('--year requis avec --file');
      const result = await importCarteFile(options.file, { category: options.category, year });
      console.log(`\n✓ ${options.category} : ${result.inserted} communes importées (${year})`);
    } else {
      const result = await ingestCarteDesLoyers({ year: options.year ? Number(options.year) : null });
      console.log(`\n✓ Carte des loyers ${result.year} :`);
      for (const [category, stats] of Object.entries(result.summary)) {
        console.log(`  ${category} : ${stats.inserted} communes`);
      }
    }
  }

  if (options.command === 'paris' || options.command === 'all') {
    const result = options.file
      ? await importParisFile(options.file, { year: options.year ? Number(options.year) : null })
      : await ingestParisRentControl({ year: options.year || undefined });
    console.log(`\n✓ Encadrement Paris ${result.year} : ${result.zones} quartiers, ${result.refs} références`);
  }

  process.exit(0);
}

main().catch(error => {
  console.error('\n✗ Import interrompu :', error.message);
  process.exit(1);
});
