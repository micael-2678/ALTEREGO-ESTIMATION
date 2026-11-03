import { getCollection } from '../mongodb.js';
import { getLastSmsFailure } from '../otp-service.js';
import { LEGAL, missingLegalFields } from '../legal.js';
import { expiredLeadsFilter } from './retention.js';
import { RENT_INDICATORS_COLLECTION, RENT_CONTROL_COLLECTION } from '../rent-ingestion.js';

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

// Références de loyers : Carte des loyers (communes) et encadrement Paris (quartiers)
async function checkRentData() {
  try {
    const indicators = await getCollection(RENT_INDICATORS_COLLECTION);
    const zones = await getCollection(RENT_CONTROL_COLLECTION);
    const communes = (await indicators.distinct('insee')).length;
    const latest = await indicators.findOne({}, { sort: { year: -1 }, projection: { year: 1 } });
    const parisQuartiers = await zones.countDocuments({ city: 'paris' });
    const parisYear = parisQuartiers > 0 ? (await zones.findOne({ city: 'paris' }, { projection: { year: 1 } }))?.year : null;
    const parts = [];
    if (communes > 0) parts.push(`${communes} communes (Carte des loyers ${latest?.year || ''})`.replace(' )', ')'));
    parts.push(parisQuartiers > 0 ? `Paris : ${parisQuartiers} quartiers (arrêté ${parisYear})` : 'encadrement Paris non chargé');
    return {
      ok: communes > 0,
      communes,
      year: latest?.year || null,
      parisQuartiers,
      parisYear,
      message: communes > 0 ? parts.join(', ') : 'Aucune référence de loyer : node scripts/ingest-loyers.js all'
    };
  } catch (error) {
    return { ok: false, message: `Références de loyers illisibles : ${error.message}` };
  }
}

async function checkRgpd() {
  const missing = missingLegalFields();
  let expired = 0;
  try {
    expired = await (await getCollection('leads')).countDocuments(expiredLeadsFilter());
  } catch {
    // Base injoignable : déjà signalé par checkDatabase
  }
  const problems = [];
  if (missing.length > 0) problems.push(`informations légales à compléter (${missing.join(', ')})`);
  if (expired > 0) problems.push(`${expired} lead(s) à supprimer (plus de ${LEGAL.leadRetentionMonths} mois) : yarn purge:leads --apply`);
  return {
    ok: problems.length === 0,
    missingLegalFields: missing,
    expiredLeads: expired,
    message: problems.length === 0 ? 'Mentions complètes, aucune donnée à purger' : problems.join(' ; ')
  };
}

export async function getServiceHealth() {
  const [database, rent, brevo, rgpd] = await Promise.all([checkDatabase(), checkRentData(), checkBrevo(), checkRgpd()]);
  const bypassCount = (process.env.BYPASS_PHONE_NUMBER || '').split(',').filter(n => n.trim()).length;
  return {
    database,
    rent,
    sms: {
      ...brevo,
      sender: process.env.BREVO_SENDER_NAME || 'AlterEgo',
      lastFailure: getLastSmsFailure()
    },
    rgpd,
    bypass: {
      ok: true,
      count: bypassCount,
      message: bypassCount > 0
        ? `${bypassCount} numéro(s) dispensé(s) de vérification SMS`
        : 'Aucun numéro dispensé de vérification (variable BYPASS_PHONE_NUMBER)'
    }
  };
}
