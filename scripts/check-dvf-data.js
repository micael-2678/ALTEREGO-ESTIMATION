#!/usr/bin/env node

/**
 * Script pour vérifier la présence et la quantité de données DVF dans MongoDB
 */

const { connectToDatabase, getCollection } = require('../lib/mongodb');

async function checkDVFData() {
  console.log('🔍 Vérification des données DVF...\n');

  try {
    // Connexion à MongoDB
    await connectToDatabase();
    console.log('✅ Connexion à MongoDB réussie\n');

    // Récupérer la collection dvf_data
    const collection = await getCollection('dvf_data');

    // Compter le nombre total de transactions
    const totalCount = await collection.countDocuments({});
    console.log(`📊 Nombre total de transactions DVF : ${totalCount.toLocaleString()}`);

    if (totalCount === 0) {
      console.log('\n⚠️  ATTENTION : Aucune donnée DVF trouvée !');
      console.log('👉 Veuillez charger les données avec :');
      console.log('   node scripts/ingest-all-france.js');
      process.exit(1);
    }

    // Statistiques par département
    console.log('\n📍 Statistiques par département :\n');
    const statsByDept = await collection.aggregate([
      {
        $group: {
          _id: '$code_departement',
          count: { $sum: 1 },
          lastImport: { $max: '$imported_at' }
        }
      },
      { $sort: { _id: 1 } }
    ]).toArray();

    console.log('Dept | Transactions | Dernière Import');
    console.log('-----|--------------|----------------');
    statsByDept.forEach(stat => {
      const dept = stat._id || 'N/A';
      const count = stat.count.toLocaleString().padStart(12, ' ');
      const lastImport = stat.lastImport 
        ? new Date(stat.lastImport).toLocaleDateString('fr-FR')
        : 'N/A';
      console.log(`${dept.padEnd(4, ' ')} | ${count} | ${lastImport}`);
    });

    // Statistiques par type de bien
    console.log('\n🏠 Statistiques par type de bien :\n');
    const statsByType = await collection.aggregate([
      {
        $group: {
          _id: '$type_local',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]).toArray();

    statsByType.forEach(stat => {
      const type = stat._id || 'Non défini';
      const count = stat.count.toLocaleString();
      console.log(`  ${type}: ${count} transactions`);
    });

    // Vérifier les index
    console.log('\n🔧 Index de la collection :');
    const indexes = await collection.indexes();
    indexes.forEach(index => {
      const keys = Object.keys(index.key).join(', ');
      console.log(`  - ${index.name}: ${keys}`);
    });

    console.log('\n✅ Vérification terminée avec succès !');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Erreur lors de la vérification :', error);
    process.exit(1);
  }
}

// Exécuter la vérification
checkDVFData();
