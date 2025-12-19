/**
 * Test spécifique pour les ACHETEURS
 */

import { createOrUpdateBrevoContact } from './lib/brevo-contact-service.js';

async function testAcheteur() {
  console.log('🧪 TEST ACHETEUR\n');
  
  const result = await createOrUpdateBrevoContact({
    email: 'test-acheteur-debug@example.com',
    name: 'Test Acheteur Debug',
    phone: '+33612345678',
    estimationReason: 'Acheter', // ⭐ Avec majuscule
    property: {
      address: '10 rue de Rivoli, 75001 Paris',
      type: 'appartement',
      surface: 75,
      rooms: '3'
    },
    estimation: {
      finalPrice: {
        mid: 600000,
        low: 580000,
        high: 620000,
        confidence: 88
      }
    },
    consent: true
  });
  
  console.log('\n📊 Résultat:', result);
  
  if (result.success) {
    console.log('✅ Test ACHETEUR réussi !');
    console.log('Vérifiez dans Brevo → Liste "Estimation App - acquereur"');
  } else {
    console.log('❌ Test ACHETEUR échoué !');
    console.log('Erreur:', result.error);
  }
}

testAcheteur().catch(console.error);
