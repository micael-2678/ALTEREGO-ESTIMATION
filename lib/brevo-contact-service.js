/**
 * Service de gestion des contacts Brevo
 * Crée et met à jour les contacts avec leurs informations détaillées
 */

/**
 * Crée ou met à jour un contact dans Brevo avec toutes ses informations
 * @param {Object} contactData - Données du contact
 * @returns {Promise<{success: boolean, contactId?: number, error?: string}>}
 */
export async function createOrUpdateBrevoContact(contactData) {
  const apiKey = process.env.BREVO_API_KEY;
  
  if (!apiKey) {
    console.error('BREVO_API_KEY not configured');
    return { success: false, error: 'Configuration error' };
  }
  
  try {
    const {
      email,
      name,
      phone,
      estimationReason, // "Acheter" ou "Vendre"
      property,
      estimation,
      consent
    } = contactData;
    
    // 🔍 LOG DE DEBUG
    console.log('📧 [BREVO] Tentative de création/mise à jour contact:');
    console.log(`   Email: ${email}`);
    console.log(`   Raison: "${estimationReason}" (type: ${typeof estimationReason})`);
    console.log(`   Propriété: ${property?.type} - ${property?.address}`);
    
    // Préparer les attributs Brevo (tous les champs personnalisés)
    const attributes = {
      NOM: name || '',
      SMS: phone || '',
      
      // Raison de l'estimation (IMPORTANT pour segmentation)
      RAISON_ESTIMATION: estimationReason || 'Non spécifié',
      
      // Informations du bien
      ADRESSE: property?.address || '',
      TYPE_BIEN: property?.type || '',
      SURFACE: property?.surface ? parseFloat(property.surface) : 0,
      SURFACE_TERRAIN: property?.totalSurface ? parseFloat(property.totalSurface) : 0,
      PIECES: property?.rooms || '',
      ETAGE: property?.floor || '',
      
      // Caractéristiques
      BALCON_TERRASSE: property?.hasBalconyTerrace ? 'Oui' : 'Non',
      PARKING: property?.hasIndoorParking || property?.hasOutdoorParking ? 'Oui' : 'Non',
      CAVE: property?.hasBasement ? 'Oui' : 'Non',
      PISCINE: property?.hasPool ? 'Oui' : 'Non',
      VUE: property?.view || 'Non spécifié',
      DPE: property?.dpe || 'Non spécifié',
      STANDING: property?.standing || 3,
      
      // Estimation
      PRIX_ESTIME: estimation?.finalPrice?.mid || 0,
      PRIX_MIN: estimation?.finalPrice?.low || 0,
      PRIX_MAX: estimation?.finalPrice?.high || 0,
      CONFIANCE: estimation?.finalPrice?.confidence || 0,
      
      // Date de l'estimation
      DATE_ESTIMATION: new Date().toISOString(),
      
      // Consentement
      CONSENTEMENT: consent ? 'Oui' : 'Non'
    };
    
    // Préparer les listes Brevo selon la raison
    const listIds = [];
    if (estimationReason === 'Vendre') {
      // Liste "Estimation App - Vendeur" (ID #4)
      listIds.push(4);
      console.log('   → Ajout à la liste VENDEUR (ID: 4)');
    } else if (estimationReason === 'Acheter') {
      // Liste "Estimation App - acquereur" (ID #5)
      listIds.push(5);
      console.log('   → Ajout à la liste ACHETEUR (ID: 5)');
    } else {
      console.log(`   ⚠️ Raison inconnue: "${estimationReason}" - Aucune liste assignée`);
    }
    
    // Payload pour l'API Brevo
    const payload = {
      email: email,
      attributes: attributes,
      updateEnabled: true, // Mettre à jour si le contact existe déjà
      ...(listIds.length > 0 && { listIds: listIds })
    };
    
    // Appel à l'API Brevo pour créer/mettre à jour le contact
    const response = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Contact Brevo créé : ${email} (ID: ${data.id})`);
      return { success: true, contactId: data.id };
    } else if (response.status === 400) {
      // Vérifier si c'est parce que le contact existe déjà
      const errorData = await response.json();
      
      if (errorData.code === 'duplicate_parameter' || (errorData.message && errorData.message.includes('already exist'))) {
        // Le contact existe déjà, on fait un update
        console.log(`ℹ️  Contact existe déjà, mise à jour : ${email}`);
        const updateResponse = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
          method: 'PUT',
          headers: {
            'accept': 'application/json',
            'api-key': apiKey,
            'content-type': 'application/json'
          },
          body: JSON.stringify({ attributes, listIds })
        });
        
        if (updateResponse.ok) {
          console.log(`✅ Contact Brevo mis à jour : ${email}`);
          return { success: true };
        } else {
          const updateErrorData = await updateResponse.json();
          console.error('Erreur mise à jour contact Brevo:', updateErrorData);
          return { success: false, error: updateErrorData.message || 'Update failed' };
        }
      } else {
        // Autre erreur 400 (attribut manquant, format invalide, etc.)
        console.error('Erreur création contact Brevo:', errorData);
        return { success: false, error: errorData.message || 'Failed to create contact' };
      }
    } else {
      const errorData = await response.json();
      console.error('Erreur création contact Brevo:', errorData);
      return { success: false, error: errorData.message || 'Failed to create contact' };
    }
  } catch (error) {
    console.error('Erreur lors de la synchronisation Brevo:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Liste des attributs Brevo à créer dans votre compte
 * Allez dans Brevo > Contacts > Paramètres > Attributs de contact
 * Créez ces attributs personnalisés :
 * 
 * - NOM (Texte)
 * - RAISON_ESTIMATION (Texte) - IMPORTANT pour segmentation
 * - ADRESSE (Texte)
 * - TYPE_BIEN (Texte)
 * - SURFACE (Nombre)
 * - SURFACE_TERRAIN (Nombre)
 * - PIECES (Texte)
 * - ETAGE (Texte)
 * - BALCON_TERRASSE (Texte)
 * - PARKING (Texte)
 * - CAVE (Texte)
 * - PISCINE (Texte)
 * - VUE (Texte)
 * - DPE (Texte)
 * - STANDING (Nombre)
 * - PRIX_ESTIME (Nombre)
 * - PRIX_MIN (Nombre)
 * - PRIX_MAX (Nombre)
 * - CONFIANCE (Nombre)
 * - DATE_ESTIMATION (Date)
 * - CONSENTEMENT (Texte)
 * 
 * Ces attributs vous permettront de personnaliser vos emails dans Brevo
 * en utilisant {{ contact.RAISON_ESTIMATION }}, {{ contact.PRIX_ESTIME }}, etc.
 */
