// Sample script to populate DVF data for testing
// This adds sample sales data for Paris area

const { MongoClient } = require('mongodb');

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'alterego_db';

// Sample DVF data for Paris (around 48.8566, 2.3522)
const sampleData = [
  // Appartements around Rue des Italiens
  {
    date_mutation: '2024-01-15',
    numero_voie: '5',
    type_voie: 'RUE',
    voie: 'DES ITALIENS',
    code_postal: '75009',
    commune: 'Paris 9e',
    code_departement: '75',
    type_local: 'Appartement',
    surface_reelle_bati: 85,
    nombre_pieces_principales: 3,
    valeur_fonciere: 765000,
    latitude: 48.871200,
    longitude: 2.337800
  },
  {
    date_mutation: '2024-02-20',
    numero_voie: '12',
    type_voie: 'RUE',
    voie: 'LAFAYETTE',
    code_postal: '75009',
    commune: 'Paris 9e',
    code_departement: '75',
    type_local: 'Appartement',
    surface_reelle_bati: 92,
    nombre_pieces_principales: 4,
    valeur_fonciere: 850000,
    latitude: 48.872500,
    longitude: 2.339200
  },
  {
    date_mutation: '2023-11-10',
    numero_voie: '8',
    type_voie: 'RUE',
    voie: 'DE LA CHAUSSEE D ANTIN',
    code_postal: '75009',
    commune: 'Paris 9e',
    code_departement: '75',
    type_local: 'Appartement',
    surface_reelle_bati: 75,
    nombre_pieces_principales: 3,
    valeur_fonciere: 680000,
    latitude: 48.871800,
    longitude: 2.333400
  },
  {
    date_mutation: '2024-03-05',
    numero_voie: '15',
    type_voie: 'RUE',
    voie: 'TAITBOUT',
    code_postal: '75009',
    commune: 'Paris 9e',
    code_departement: '75',
    type_local: 'Appartement',
    surface_reelle_bati: 110,
    nombre_pieces_principales: 4,
    valeur_fonciere: 990000,
    latitude: 48.873200,
    longitude: 2.335600
  },
  {
    date_mutation: '2023-12-18',
    numero_voie: '20',
    type_voie: 'RUE',
    voie: 'DE PROVENCE',
    code_postal: '75009',
    commune: 'Paris 9e',
    code_departement: '75',
    type_local: 'Appartement',
    surface_reelle_bati: 68,
    nombre_pieces_principales: 2,
    valeur_fonciere: 595000,
    latitude: 48.873800,
    longitude: 2.337100
  },
  // More samples around different areas of Paris
  {
    date_mutation: '2024-01-25',
    numero_voie: '45',
    type_voie: 'BOULEVARD',
    voie: 'HAUSSMANN',
    code_postal: '75009',
    commune: 'Paris 9e',
    code_departement: '75',
    type_local: 'Appartement',
    surface_reelle_bati: 95,
    nombre_pieces_principales: 3,
    valeur_fonciere: 870000,
    latitude: 48.873400,
    longitude: 2.331200
  },
  {
    date_mutation: '2023-10-30',
    numero_voie: '30',
    type_voie: 'RUE',
    voie: 'DE CHATEAUDUN',
    code_postal: '75009',
    commune: 'Paris 9e',
    code_departement: '75',
    type_local: 'Appartement',
    surface_reelle_bati: 78,
    nombre_pieces_principales: 3,
    valeur_fonciere: 720000,
    latitude: 48.876200,
    longitude: 2.337800
  },
  // Maisons (a bit outside central Paris)
  {
    date_mutation: '2024-02-12',
    numero_voie: '12',
    type_voie: 'RUE',
    voie: 'DES VIGNES',
    code_postal: '75016',
    commune: 'Paris 16e',
    code_departement: '75',
    type_local: 'Maison',
    surface_reelle_bati: 180,
    nombre_pieces_principales: 7,
    valeur_fonciere: 2100000,
    latitude: 48.858600,
    longitude: 2.272000
  },
  {
    date_mutation: '2023-09-20',
    numero_voie: '8',
    type_voie: 'VILLA',
    voie: 'MONTMORENCY',
    code_postal: '75016',
    commune: 'Paris 16e',
    code_departement: '75',
    type_local: 'Maison',
    surface_reelle_bati: 220,
    nombre_pieces_principales: 8,
    valeur_fonciere: 2650000,
    latitude: 48.857200,
    longitude: 2.268400
  },
  // Additional appartements in different arrondissements
  {
    date_mutation: '2024-04-10',
    numero_voie: '25',
    type_voie: 'RUE',
    voie: 'DU FAUBOURG SAINT HONORE',
    code_postal: '75008',
    commune: 'Paris 8e',
    code_departement: '75',
    type_local: 'Appartement',
    surface_reelle_bati: 120,
    nombre_pieces_principales: 4,
    valeur_fonciere: 1380000,
    latitude: 48.870500,
    longitude: 2.315800
  },
  {
    date_mutation: '2023-11-28',
    numero_voie: '42',
    type_voie: 'RUE',
    voie: 'DE RIVOLI',
    code_postal: '75004',
    commune: 'Paris 4e',
    code_departement: '75',
    type_local: 'Appartement',
    surface_reelle_bati: 88,
    nombre_pieces_principales: 3,
    valeur_fonciere: 950000,
    latitude: 48.856200,
    longitude: 2.356800
  },
  {
    date_mutation: '2024-03-22',
    numero_voie: '18',
    type_voie: 'RUE',
    voie: 'DE GRENELLE',
    code_postal: '75007',
    commune: 'Paris 7e',
    code_departement: '75',
    type_local: 'Appartement',
    surface_reelle_bati: 105,
    nombre_pieces_principales: 4,
    valeur_fonciere: 1250000,
    latitude: 48.857400,
    longitude: 2.318900
  },
];

async function populateDVF() {
  let client;
  
  try {
    console.log('Connecting to MongoDB...');
    client = await MongoClient.connect(MONGO_URL);
    const db = client.db(DB_NAME);
    const collection = db.collection('dvf_sales');
    
    // Clear existing data
    console.log('Clearing existing DVF data...');
    await collection.deleteMany({});
    
    // Insert sample data
    console.log('Inserting sample DVF data...');
    await collection.insertMany(sampleData);
    
    // Create indexes
    console.log('Creating indexes...');
    await collection.createIndex({ latitude: 1, longitude: 1 });
    await collection.createIndex({ date_mutation: -1 });
    await collection.createIndex({ type_local: 1 });
    
    console.log(`✓ Successfully inserted ${sampleData.length} DVF records`);
    console.log('✓ Indexes created');
    
    // Display some stats
    const appartCount = await collection.countDocuments({ type_local: 'Appartement' });
    const maisonCount = await collection.countDocuments({ type_local: 'Maison' });
    
    console.log(`\nStatistics:`);
    console.log(`- Appartements: ${appartCount}`);
    console.log(`- Maisons: ${maisonCount}`);
    console.log(`- Total: ${appartCount + maisonCount}`);
    
  } catch (error) {
    console.error('Error populating DVF data:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('\n✓ Database connection closed');
    }
  }
}

populateDVF();
