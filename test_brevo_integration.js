/**
 * Test de l'intégration Brevo - Création de contact avec liste
 */

import { createOrUpdateBrevoContact } from './lib/brevo-contact-service.js';

async function testBrevoIntegration() {
  console.log('🧪 Test d\'intégration Brevo...\n');
  
  // Test 1 : Contact Vendeur
  console.log('Test 1 : Création d\'un contact VENDEUR');
  const vendeurResult = await createOrUpdateBrevoContact({
    email: 'test-vendeur@example.com',
    name: 'Jean Vendeur Test',
    phone: '+33612345678',
    estimationReason: 'Vendre',
    property: {
      address: '2 rue des Italiens, 75009 Paris',
      type: 'appartement',
      surface: 85,
      rooms: '3',
      hasBalconyTerrace: true,
      hasParking: false
    },
    estimation: {
      finalPrice: {
        mid: 450000,
        low: 420000,
        high: 480000,
        confidence: 85
      }
    },
    consent: true
  });
  
  if (vendeurResult.success) {
    console.log('✅ Contact Vendeur créé avec succès !');
    console.log(`   ID Contact: ${vendeurResult.contactId}`);
    console.log('   → Devrait être dans la liste "Estimation App - Vendeur" (ID: 4)\n');
  } else {
    console.log('❌ Erreur:', vendeurResult.error, '\n');
  }
  
  // Test 2 : Contact Acheteur
  console.log('Test 2 : Création d\'un contact ACHETEUR');
  const acheteurResult = await createOrUpdateBrevoContact({
    email: 'test-acheteur@example.com',
    name: 'Marie Acheteur Test',
    phone: '+33687654321',
    estimationReason: 'Acheter',
    property: {
      address: '10 Avenue des Champs-Élysées, 75008 Paris',
      type: 'appartement',
      surface: 120,
      rooms: '4'
    },
    estimation: {
      finalPrice: {
        mid: 850000,
        low: 800000,
        high: 900000,
        confidence: 90
      }
    },
    consent: true
  });
  
  if (acheteurResult.success) {
    console.log('✅ Contact Acheteur créé avec succès !');
    console.log(`   ID Contact: ${acheteurResult.contactId}`);
    console.log('   → Devrait être dans la liste "Estimation App - acquereur" (ID: 5)\n');
  } else {
    console.log('❌ Erreur:', acheteurResult.error, '\n');
  }
  
  console.log('---');
  console.log('🔍 Vérification dans Brevo :');
  console.log('1. Allez sur https://app.brevo.com/contact/list');
  console.log('2. Vérifiez que la liste "Estimation App - Vendeur" contient 1 contact');
  console.log('3. Vérifiez que la liste "Estimation App - acquereur" contient 1 contact');
  console.log('4. Cliquez sur un contact pour voir tous les attributs remplis');
}

testBrevoIntegration().catch(console.error);
