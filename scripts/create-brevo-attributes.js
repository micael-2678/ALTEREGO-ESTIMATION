/**
 * Script pour créer automatiquement tous les attributs Brevo nécessaires
 * 
 * Usage: BREVO_API_KEY=votre_clé node scripts/create-brevo-attributes.js
 */

const BREVO_API_KEY = process.env.BREVO_API_KEY;

if (!BREVO_API_KEY) {
  console.error('❌ BREVO_API_KEY non définie !');
  console.error('Usage: BREVO_API_KEY=votre_clé node scripts/create-brevo-attributes.js');
  process.exit(1);
}

const attributes = [
  // Texte
  { name: 'RAISON_ESTIMATION', type: 'text' },
  { name: 'ADRESSE', type: 'text' },
  { name: 'TYPE_BIEN', type: 'text' },
  { name: 'PIECES', type: 'text' },
  { name: 'ETAGE', type: 'text' },
  { name: 'VUE', type: 'text' },
  { name: 'DPE', type: 'text' },
  { name: 'BALCON_TERRASSE', type: 'text' },
  { name: 'PARKING', type: 'text' },
  { name: 'CAVE', type: 'text' },
  { name: 'PISCINE', type: 'text' },
  { name: 'CONSENTEMENT', type: 'text' },
  
  // Nombres
  { name: 'SURFACE', type: 'float' },
  { name: 'SURFACE_TERRAIN', type: 'float' },
  { name: 'STANDING', type: 'float' },
  { name: 'PRIX_ESTIME', type: 'float' },
  { name: 'PRIX_MIN', type: 'float' },
  { name: 'PRIX_MAX', type: 'float' },
  { name: 'CONFIANCE', type: 'float' },
  { name: 'LOYER_ESTIME', type: 'float' },
  { name: 'LOYER_MIN', type: 'float' },
  { name: 'LOYER_MAX', type: 'float' },
  { name: 'LOYER_CONFIANCE', type: 'float' },
  { name: 'LOCATION_MEUBLEE', type: 'text' },
  
  // Date
  { name: 'DATE_ESTIMATION', type: 'date' }
];

async function createAttribute(attr) {
  try {
    const response = await fetch('https://api.brevo.com/v3/contacts/attributes/normal/' + attr.name, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        type: attr.type
      })
    });
    
    if (response.ok) {
      console.log(\`✅ Attribut créé : \${attr.name} (\${attr.type})\`);
      return true;
    } else if (response.status === 400) {
      const data = await response.json();
      if (data.message && data.message.includes('already exists')) {
        console.log(\`ℹ️  Attribut existe déjà : \${attr.name}\`);
        return true;
      } else {
        console.log(\`❌ Erreur \${attr.name}: \${data.message}\`);
        return false;
      }
    } else {
      const data = await response.json();
      console.log(\`❌ Erreur \${attr.name}: \${data.message}\`);
      return false;
    }
  } catch (error) {
    console.log(\`❌ Erreur \${attr.name}: \${error.message}\`);
    return false;
  }
}

async function createAllAttributes() {
  console.log('🚀 Création des attributs Brevo...\n');
  
  let created = 0;
  let existing = 0;
  let failed = 0;
  
  for (const attr of attributes) {
    const result = await createAttribute(attr);
    if (result) {
      if (result === 'exists') {
        existing++;
      } else {
        created++;
      }
    } else {
      failed++;
    }
    // Petit délai pour ne pas surcharger l'API
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  console.log('\n📊 Résumé :');
  console.log(\`✅ Créés : \${created}\`);
  console.log(\`ℹ️  Existants : \${existing}\`);
  console.log(\`❌ Échecs : \${failed}\`);
  console.log(\`📝 Total : \${attributes.length}\`);
  
  if (failed === 0) {
    console.log('\n🎉 Tous les attributs sont prêts !');
    console.log('Vous pouvez maintenant tester l\'estimation sur votre site.');
  }
}

createAllAttributes().catch(console.error);
