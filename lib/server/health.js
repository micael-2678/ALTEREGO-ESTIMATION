import { getCollection } from '../mongodb.js';
import { getLastSmsFailure } from '../otp-service.js';

// Crédits SMS et validité de la clé Brevo (compte Brevo : GET /v3/account)
async function checkBrevo() {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    return { ok: false, message: 'BREVO_API_KEY absente : aucun SMS ne peut partir' };
  }
  try {
    const response = await fetch('https://api.brevo.com/v3/account', {
      headers: { accept: 'application/json', 'api-key': apiKey },
      signal: AbortSignal.timeout(8000)
    });
    if (response.status === 401) {
      return { ok: false, message: 'Clé Brevo refusée (401) : clé invalide ou révoquée' };
    }
    if (!response.ok) {
      return { ok: false, message: `Brevo répond HTTP ${response.status}` };
    }
    const account = await response.json();
    const smsPlan = (account.plan || []).find(p => p.type === 'sms');
    const credits = smsPlan ? smsPlan.credits : 0;
    return {
      ok: credits > 0,
      smsCredits: credits,
      message: credits > 0 ? `${credits} crédits SMS disponibles` : 'Aucun crédit SMS : les codes ne peuvent pas être envoyés'
    };
  } catch (error) {
    return { ok: false, message: `Brevo injoignable : ${error.message}` };
  }
}

async function checkDatabase() {
  try {
    const count = await (await getCollection('dvf_sales')).estimatedDocumentCount();
    return { ok: count > 0, dvfSales: count, message: count > 0 ? `${count} ventes DVF en base` : 'Base DVF vide : aucune estimation possible' };
  } catch (error) {
    return { ok: false, message: `MongoDB injoignable : ${error.message}` };
  }
}

export async function getServiceHealth() {
  const [database, brevo] = await Promise.all([checkDatabase(), checkBrevo()]);
  const bypassCount = (process.env.BYPASS_PHONE_NUMBER || '').split(',').filter(n => n.trim()).length;
  return {
    database,
    sms: {
      ...brevo,
      sender: process.env.BREVO_SENDER_NAME || 'AlterEgo',
      lastFailure: getLastSmsFailure()
    },
    bypass: {
      ok: true,
      count: bypassCount,
      message: bypassCount > 0
        ? `${bypassCount} numéro(s) dispensé(s) de vérification SMS`
        : 'Aucun numéro dispensé de vérification (variable BYPASS_PHONE_NUMBER)'
    }
  };
}
