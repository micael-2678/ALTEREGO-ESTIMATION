import { DPE_RULES, PERIOD_LABELS, TENSE_ZONE } from './config-rent.js';

/**
 * Cadre légal d'une mise en location : décence énergétique (DPE), gel des loyers des
 * passoires, encadrement de l'évolution des loyers en zone tendue, encadrement du niveau
 * des loyers à Paris. Produit des avis à afficher et des plafonds à appliquer au loyer de
 * marché. Fonctions pures.
 */

export function isTenseZone(department) {
  if (TENSE_ZONE.departments.includes(department)) return 'yes';
  if (TENSE_ZONE.likely_departments.includes(department)) return 'likely';
  return 'unknown';
}

export function roomsLabel(rooms) {
  if (rooms >= 4) return '4 pièces et plus';
  return rooms > 1 ? `${rooms} pièces` : '1 pièce';
}

const euros = (value) => `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value)} €`;
const perM2 = (value) => `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }).format(value)} €/m²`;

/**
 * @param {object} input
 * @param {string} input.dpe              lettre A-G ou 'unknown'
 * @param {number|null} input.previousRent dernier loyer mensuel hors charges connu
 * @param {boolean} input.rentedRecently  loué au cours des 18 derniers mois
 * @param {string|null} input.department  code département
 * @param {object|null} input.paris       référence parisienne retenue ({ zone, ref: { rooms, period, furnished, ref, max, min, periodKnown } })
 * @param {number} input.surface          surface habitable
 */
export function legalFrame({ dpe = 'unknown', previousRent = null, rentedRecently = false, department = null, paris = null, surface }) {
  const notices = [];
  const caps = [];
  let parisControl = null;

  // 1. Encadrement du niveau des loyers (Paris)
  if (paris && paris.ref) {
    const { zone, ref } = paris;
    const capMonthly = Math.round(ref.max * surface);
    parisControl = {
      city: 'Paris',
      year: zone.year,
      zoneId: zone.zoneId,
      quartier: zone.quartierName,
      rooms: ref.rooms,
      period: ref.period,
      periodKnown: ref.periodKnown,
      furnished: ref.furnished,
      refPerM2: round2(ref.ref),
      maxPerM2: round2(ref.max),
      minPerM2: round2(ref.min),
      maxMonthly: capMonthly
    };
    let text = `Arrêté préfectoral ${zone.year}, zone ${zone.zoneId}, quartier ${zone.quartierName} — ${roomsLabel(ref.rooms)}, ` +
      `${ref.periodKnown ? PERIOD_LABELS[ref.period] : 'toutes époques'}, ${ref.furnished ? 'meublé' : 'non meublé'}. ` +
      `Loyer de référence : ${perM2(ref.ref)}, majoré : ${perM2(ref.max)} (plafond), minoré : ${perM2(ref.min)}. ` +
      `Le loyer hors charges ne peut pas dépasser ${euros(capMonthly)} par mois. Un complément de loyer n'est possible ` +
      `que pour des caractéristiques exceptionnelles de localisation ou de confort (jamais pour un logement classé F ou G).`;
    if (!ref.periodKnown) {
      text += " Époque de construction non renseignée : références moyennées sur les quatre époques, le plafond exact dépend de l'époque réelle.";
    }
    notices.push({ code: 'paris_control', level: 'info', title: 'Encadrement des loyers à Paris', text });
    caps.push({ code: 'paris_max', label: "Plafond de l'encadrement (loyer de référence majoré)", monthly: capMonthly, perM2: round2(ref.max) });
  }

  // 2. Décence énergétique
  const rentable = !DPE_RULES.banned.includes(dpe);
  if (!rentable) {
    notices.push({
      code: 'dpe_banned',
      level: 'blocking',
      title: 'Location interdite (DPE G)',
      text: 'Depuis le 1er janvier 2025, un logement classé G ne répond plus au critère de décence énergétique : il ne peut plus ' +
        "être proposé à la location comme résidence principale (nouveau bail ou renouvellement) tant que des travaux ne l'ont pas " +
        'fait sortir de la classe G. Le loyer indiqué est une valeur de marché théorique.'
    });
  } else if (DPE_RULES.banned_from[dpe]) {
    notices.push({
      code: 'dpe_deadline',
      level: dpe === 'F' ? 'warning' : 'info',
      title: `Location interdite à partir du ${DPE_RULES.banned_from[dpe]} (DPE ${dpe})`,
      text: `Un logement classé ${dpe} ne pourra plus être proposé à la location à compter du ${DPE_RULES.banned_from[dpe]}` +
        (dpe === 'F' ? ' : anticipez les travaux de rénovation énergétique.' : '.')
    });
  }

  // 3. Gel des loyers des passoires énergétiques
  if (DPE_RULES.rent_freeze.includes(dpe)) {
    notices.push({
      code: 'dpe_freeze',
      level: 'warning',
      title: 'Loyer gelé (DPE F ou G)',
      text: "Depuis le 24 août 2022, le loyer d'un logement classé F ou G ne peut plus être augmenté : ni à la relocation, ni par la " +
        "révision annuelle (IRL), ni par la procédure de réévaluation, tant que le logement n'atteint pas au moins la classe E." +
        (previousRent
          ? ` Le dernier loyer appliqué (${euros(previousRent)}) est donc un plafond.`
          : ' Si le logement était loué, le dernier loyer appliqué est un plafond : indiquez-le pour en tenir compte.')
    });
    if (previousRent) {
      caps.push({ code: 'dpe_freeze', label: 'Gel du loyer (DPE F/G) : dernier loyer appliqué', monthly: Math.round(previousRent) });
    }
  }

  // 4. Encadrement de l'évolution des loyers en zone tendue (décret 2017-1198, reconduit chaque année)
  const tense = isTenseZone(department);
  if (rentedRecently && tense !== 'unknown') {
    const prefix = tense === 'likely'
      ? "Si la commune est en zone tendue (c'est le cas de la quasi-totalité de l'agglomération parisienne), le"
      : 'Le';
    if (previousRent) {
      notices.push({
        code: 'evolution_cap',
        level: 'warning',
        title: "Encadrement de l'évolution des loyers (zone tendue)",
        text: `${prefix} loyer du nouveau locataire ne peut pas dépasser le dernier loyer appliqué (${euros(previousRent)}), révisé au ` +
          "plus de l'IRL, car le logement a été loué au cours des 18 derniers mois. Exceptions : travaux d'amélioration d'un montant " +
          "au moins égal à six mois de loyer (hausse annuelle limitée à 15 % de leur coût TTC), ou loyer précédent manifestement " +
          "sous-évalué (hausse limitée à la moitié de l'écart)."
      });
      caps.push({ code: 'previous_rent', label: 'Dernier loyer appliqué (zone tendue)', monthly: Math.round(previousRent) });
    } else {
      notices.push({
        code: 'evolution_cap',
        level: 'info',
        title: "Encadrement de l'évolution des loyers (zone tendue)",
        text: `${prefix} loyer du nouveau locataire ne peut pas dépasser le dernier loyer appliqué (révisé de l'IRL) lorsque le logement ` +
          'a été loué au cours des 18 derniers mois. Indiquez ce loyer pour en tenir compte.'
      });
    }
  }

  return { rentable, notices, caps, parisControl, tenseZone: tense };
}

function round2(value) {
  return Math.round(value * 100) / 100;
}
