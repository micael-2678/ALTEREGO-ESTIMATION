/**
 * Service de gestion des OTP avec Brevo SMS
 */

/**
 * Génère un code OTP aléatoire
 * @param {number} length - Longueur du code (par défaut 6)
 * @returns {string} Code OTP
 */
export function generateOTP(length = 6) {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
}

/**
 * Normalise un numéro de téléphone français au format E.164
 * @param {string} phone - Numéro de téléphone
 * @returns {string} Numéro normalisé (+33...)
 */
export function normalizePhoneNumber(phone) {
  // Supprimer tous les espaces, tirets, points
  let cleaned = phone.replace(/[\s\-\.\(\)]/g, '');
  
  // Si commence par +33, retourner tel quel
  if (cleaned.startsWith('+33')) {
    return cleaned;
  }
  
  // Si commence par 0033, remplacer par +33
  if (cleaned.startsWith('0033')) {
    return '+33' + cleaned.substring(4);
  }
  
  // Si commence par 0, remplacer par +33
  if (cleaned.startsWith('0')) {
    return '+33' + cleaned.substring(1);
  }
  
  // Si commence par 33, ajouter +
  if (cleaned.startsWith('33')) {
    return '+' + cleaned;
  }
  
  // Sinon, ajouter +33
  return '+33' + cleaned;
}

/**
 * Vérifie si un numéro est valide (français)
 * @param {string} phone - Numéro normalisé
 * @returns {boolean}
 */
export function isValidFrenchPhone(phone) {
  // Format E.164 pour la France: +33 suivi de 9 chiffres
  const regex = /^\+33[1-9]\d{8}$/;
  return regex.test(phone);
}

/**
 * Vérifie si un numéro doit bypasser la vérification
 * @param {string} phone - Numéro de téléphone
 * @returns {boolean}
 */
export function shouldBypassVerification(phone) {
  const bypassNumber = process.env.BYPASS_PHONE_NUMBER || '0698793430';
  const normalizedBypass = normalizePhoneNumber(bypassNumber);
  const normalizedPhone = normalizePhoneNumber(phone);
  return normalizedPhone === normalizedBypass;
}

/**
 * Envoie un SMS OTP via Brevo
 * @param {string} phone - Numéro de téléphone (format E.164)
 * @param {string} code - Code OTP
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export async function sendOTPSMS(phone, code) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderName = process.env.BREVO_SENDER_NAME || 'AlterEgo';
  
  if (!apiKey) {
    console.error('BREVO_API_KEY not configured');
    return { success: false, error: 'Configuration error' };
  }
  
  try {
    const response = await fetch('https://api.brevo.com/v3/transactionalSMS/sms', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sender: senderName,
        recipient: phone,
        content: `Votre code de vérification AlterEgo est : ${code}\n\nCe code expire dans 5 minutes.\n\nNe partagez ce code avec personne.`,
        type: 'transactional'
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`SMS sent successfully to ${phone}. Message ID: ${data.reference}`);
      return { success: true, messageId: data.reference };
    } else {
      const errorData = await response.json();
      console.error('Brevo SMS API error:', errorData);
      return { success: false, error: errorData.message || 'Failed to send SMS' };
    }
  } catch (error) {
    console.error('Error sending SMS via Brevo:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Calcule la date d'expiration d'un OTP
 * @param {number} minutes - Minutes avant expiration
 * @returns {Date}
 */
export function calculateExpirationTime(minutes = 5) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

/**
 * Vérifie si un OTP a expiré
 * @param {Date} expiresAt - Date d'expiration
 * @returns {boolean}
 */
export function isOTPExpired(expiresAt) {
  return new Date() > new Date(expiresAt);
}