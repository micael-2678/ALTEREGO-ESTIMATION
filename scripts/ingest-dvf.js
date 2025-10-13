// Script CLI pour ingérer les données DVF
import { ingestDVFDepartment, ingestMultipleDepartments } from '../lib/dvf-ingestion.js';
import { connectToDatabase } from '../lib/mongodb.js';

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log(`
Usage: node scripts/ingest-dvf.js <department_code> [department_code2 ...]

Examples:
  node scripts/ingest-dvf.js 78
  node scripts/ingest-dvf.js 75 92 93 94
  node scripts/ingest-dvf.js all-idf  # Paris + Île-de-France
`);
  process.exit(1);
}

async function main() {
  try {
    // Connect to database
    await connectToDatabase();
    console.log('✓ Connected to MongoDB\n');
    
    let departments = args;
    
    // Handle special cases
    if (args[0] === 'all-idf') {
      departments = ['75', '77', '78', '91', '92', '93', '94', '95'];
      console.log('Ingesting all Île-de-France departments...\n');
    }
    
    // Ingest departments
    if (departments.length === 1) {
      const stats = await ingestDVFDepartment(departments[0]);
      console.log('\n=== INGESTION COMPLETE ===');
      console.log(`Department: ${departments[0]}`);
      console.log(`Inserted: ${stats.inserted}`);
      console.log(`Appartements: ${stats.appartements}`);
      console.log(`Maisons: ${stats.maisons}`);
    } else {
      const results = await ingestMultipleDepartments(departments);
      console.log('\n=== INGESTION COMPLETE ===');
      results.forEach(result => {
        if (result.success) {
          console.log(`\n✓ ${result.department}: ${result.stats.inserted} records`);
          console.log(`  Appartements: ${result.stats.appartements}`);
          console.log(`  Maisons: ${result.stats.maisons}`);
        } else {
          console.log(`\n✗ ${result.department}: FAILED - ${result.error}`);
        }
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Ingestion failed:', error);
    process.exit(1);
  }
}

main();