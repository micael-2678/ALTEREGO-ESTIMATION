const { MongoClient } = require('mongodb');
require('dotenv').config();

(async () => {
  try {
    console.log('🔗 Tentative de connexion à MongoDB...');
    console.log('URL:', process.env.MONGO_URL);
    console.log('DB:', process.env.DB_NAME);
    
    const client = new MongoClient(process.env.MONGO_URL);
    await client.connect();
    console.log('✅ Connexion réussie !');
    
    const db = client.db(process.env.DB_NAME);
    const collection = db.collection('dvf_sales');
    
    console.log('\n📊 Test de lecture des données DVF...');
    const count = await collection.countDocuments();
    console.log(`✅ Nombre total de documents: ${count}`);
    
    console.log('\n📍 Test de recherche de comparables...');
    const sample = await collection.findOne({
      latitude: { $exists: true },
      longitude: { $exists: true }
    });
    
    if (sample) {
      console.log('✅ Exemple de document trouvé:');
      console.log(`   - Commune: ${sample.commune}`);
      console.log(`   - Type: ${sample.type_local}`);
      console.log(`   - Surface: ${sample.surface_reelle_bati}m²`);
      console.log(`   - Prix: ${sample.valeur_fonciere}€`);
      console.log(`   - Date: ${sample.date_mutation}`);
      console.log(`   - Coords: ${sample.latitude}, ${sample.longitude}`);
    }
    
    console.log('\n🎉 TOUS LES TESTS RÉUSSIS !');
    await client.close();
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ ERREUR:', error.message);
    console.error(error);
    process.exit(1);
  }
})();
