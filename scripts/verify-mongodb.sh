#!/bin/bash

echo "🔍 Vérification de la configuration MongoDB"
echo "=========================================="
echo ""

# Vérifier les variables d'environnement
echo "📋 Variables d'environnement:"
if [ -f .env ]; then
  echo "✅ Fichier .env trouvé"
  echo ""
  echo "MONGO_URL:"
  grep MONGO_URL .env | sed 's/:.*/:[PASSWORD_HIDDEN]@.../'
  echo ""
  echo "DB_NAME:"
  grep DB_NAME .env
else
  echo "❌ Fichier .env non trouvé"
fi

echo ""
echo "=========================================="
echo "🧪 Test de connexion MongoDB via Node.js"
echo "=========================================="
echo ""

# Charger les variables d'environnement
source .env 2>/dev/null || export $(cat .env | xargs)

# Test de connexion
node -e "
const { MongoClient } = require('mongodb');

(async () => {
  try {
    console.log('🔗 Tentative de connexion...');
    const client = new MongoClient(process.env.MONGO_URL);
    await client.connect();
    console.log('✅ Connexion réussie !');
    
    const db = client.db(process.env.DB_NAME);
    const collection = db.collection('dvf_sales');
    
    console.log('');
    console.log('📊 Statistiques:');
    const count = await collection.countDocuments();
    console.log('   Documents DVF:', count.toLocaleString('fr-FR'));
    
    const sample = await collection.findOne({ latitude: { \$exists: true } });
    if (sample) {
      console.log('');
      console.log('📍 Exemple de transaction:');
      console.log('   Commune:', sample.commune);
      console.log('   Type:', sample.type_local);
      console.log('   Surface:', sample.surface_reelle_bati, 'm²');
      console.log('   Prix:', sample.valeur_fonciere?.toLocaleString('fr-FR'), '€');
    }
    
    console.log('');
    console.log('🎉 SUCCÈS - MongoDB est accessible !');
    await client.close();
    process.exit(0);
    
  } catch (error) {
    console.error('');
    console.error('❌ ERREUR:', error.message);
    console.error('');
    console.error('💡 Solutions possibles:');
    console.error('   1. Vérifiez que MONGO_URL contient les credentials');
    console.error('   2. Vérifiez que le hostname MongoDB est correct');
    console.error('   3. Vérifiez que les services sont dans le même réseau Docker');
    process.exit(1);
  }
})();
"

echo ""
echo "=========================================="
echo "✅ Test terminé"
echo "=========================================="
