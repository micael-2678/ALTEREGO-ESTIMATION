/**
 * Initialise les index MongoDB pour la collection OTP
 * Cet index TTL supprime automatiquement les documents expirés
 */

import { connectToDatabase } from './mongodb.js';

export async function initOTPIndexes() {
  try {
    const { db } = await connectToDatabase();
    const collection = db.collection('otp_verifications');
    
    // Créer un index TTL sur expiresAt
    // MongoDB supprimera automatiquement les documents quand expiresAt < Date.now()
    await collection.createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0, name: 'otp_expiration_index' }
    );
    
    // Index pour les recherches rapides par téléphone
    await collection.createIndex(
      { phone: 1 },
      { name: 'phone_index' }
    );
    
    // Index composé pour les requêtes courantes
    await collection.createIndex(
      { phone: 1, verified: 1, expiresAt: 1 },
      { name: 'phone_verification_status_index' }
    );
    
    console.log('✅ OTP indexes created successfully');
    return true;
  } catch (error) {
    console.error('❌ Error creating OTP indexes:', error);
    return false;
  }
}
