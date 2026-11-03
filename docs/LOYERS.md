# Estimation de loyer : méthode, données et limites

L'outil estime le loyer mensuel d'un logement (projet « Louer » du formulaire) en plus de sa
valeur de vente. Contrairement aux ventes (DVF publie chaque transaction), il n'existe aucune
base publique des loyers signés : le loyer est reconstruit à partir de références publiques,
corrigé selon le bien, puis confronté aux règles légales, qui pèsent beaucoup plus sur un
loyer que sur un prix de vente.

## 1. Données utilisées

| Source | Contenu | Import |
|---|---|---|
| **Carte des loyers** (ministère du Logement / ANIL, data.gouv.fr, millésime annuel) | Loyer d'annonce au m², **charges comprises**, pour un logement **vide** de référence, par commune, en 3 catégories utiles (appartement 1-2 pièces, appartement 3 pièces et plus, maison) + « tous appartements » en secours. Intervalle de prédiction et niveau (commune ou maille plus large si la commune a trop peu d'annonces). | `yarn ingest:loyers carte` → collection `rent_indicators` |
| **Encadrement des loyers à Paris** (Ville de Paris, opendata.paris.fr) | Loyers de référence, majorés (+20 %) et minorés (−30 %), **hors charges**, par quartier (80), nombre de pièces (1 à 4+), époque de construction (4) et meublé / non meublé, avec le contour de chaque quartier. Les loyers de référence sont les **médianes de l'observatoire des loyers (OLAP)**, locataires en place compris. | `yarn ingest:loyers paris` → collection `rent_control_zones` (index 2dsphere) |
| **DVF** (déjà en base) | Prix de vente du secteur (rayon 500-800 m) et de la commune : correction de quartier et valeur de vente pour le rendement | — |
| **Base Adresse Nationale** | Code INSEE de la commune (`citycode`, arrondissement à Paris) transmis avec l'adresse | — |

`yarn ingest:loyers all` importe tout. La Carte des loyers est retrouvée par l'API de
data.gouv.fr (dernier millésime, ou `LOYERS_DATASET` pour en imposer un) ; l'encadrement
parisien prend l'année la plus récente de l'arrêté (`PARIS_LOYERS_YEAR` pour en imposer une).
`--file` importe un fichier local (voir `node scripts/ingest-loyers.js` sans argument).
À refaire chaque année : décembre (Carte des loyers), juillet (arrêté parisien).

## 2. Calcul (`lib/rent-estimation.js`, réglages dans `lib/config-rent.js`)

### Loyer de référence hors charges au m²

**À Paris** (le point est dans un quartier de `rent_control_zones`) :

1. loyer de référence de l'encadrement pour le nombre de pièces, l'époque de construction
   (déduite de l'année si elle est connue, sinon demandée ; inconnue → moyenne des 4 époques,
   confiance réduite) et le meublé ;
2. **+10 %** de prime de relocation (`PARIS.new_lease_premium`) : la référence est une médiane
   de tout le parc, un logement remis en location se loue au-dessus ;
3. correction de surface à l'intérieur de la catégorie de pièces (élasticité 0,15, bornée ±8 %) ;
4. pondération **60 / 40** avec les loyers d'annonce de l'arrondissement (Carte des loyers,
   ramenés au bien, charges déduites, meublé ajouté) quand ils existent.

**Ailleurs** :

1. loyer d'annonce de la commune pour la catégorie (charges comprises) ;
2. **surface** : `loyer/m² × (surface ÷ surface de référence)^(−β)`, β = 0,25 appartement,
   0,15 maison, effet borné ±20 % (un studio se loue plus cher au m² qu'un 4 pièces) ;
3. **quartier** : `× (prix DVF autour du bien ÷ prix DVF médian de la commune)^0,5`, borné
   [0,85 ; 1,15], seulement avec ≥ 8 ventes locales et ≥ 30 ventes dans la commune ;
4. **charges déduites** : 2,5 €/m²/mois (appartement), 0,6 (maison) ;
5. **meublé** : +12 %.

### Puis, dans les deux cas

- **évolution des loyers** : +1 %/an depuis la date de référence des données ;
- **caractéristiques** : même moteur que la vente (`calculateAdjustments`) avec des poids
  propres à la location (étage/ascenseur 5 %, extérieur 6 %, vue 3 %, état 10 %, DPE 8 %,
  parcelle 4 %, équipements 4 %), cumul borné ±15 % (±20/25 % en zone peu dense) ;
- **stationnement** : loué à part, 60 €/mois (extérieur) ou 100 €/mois (couvert/box), affiché
  en plus du loyer ;
- **charges** estimées pour afficher un loyer charges comprises.

### Cadre légal (`lib/rent-rules.js`)

| Règle | Effet |
|---|---|
| **DPE G** : location interdite depuis le 1er janvier 2025 (décence énergétique) | Avis bloquant ; le loyer de marché reste affiché comme valeur théorique |
| **DPE F** : interdiction au 1er janvier 2028 ; **DPE E** : 2034 | Avis |
| **Gel des loyers F/G** depuis le 24 août 2022 | Dernier loyer connu = plafond |
| **Zone tendue** (75, 92, 93, 94 ; « probable » en 77, 78, 91, 95) : logement loué dans les 18 derniers mois | Dernier loyer appliqué = plafond (révisable IRL ; exceptions travaux ≥ 6 mois de loyer, loyer sous-évalué) |
| **Encadrement Paris** | Loyer hors charges ≤ loyer de référence majoré × surface ; complément de loyer réservé aux caractéristiques exceptionnelles (exclu pour F/G) |

Le loyer retenu est le minimum entre le loyer de marché et les plafonds ; la page de
résultats indique le plafond appliqué et le loyer de marché.

### Confiance et fourchette

| Référence | Confiance de base |
|---|---|
| Paris, observatoire + annonces | 80 |
| Paris, observatoire seul | 75 |
| Carte des loyers, niveau commune, ≥ 50 annonces | 72 |
| … ≥ 20 annonces | 65 |
| … moins | 58 |
| Carte des loyers, maille (commune trop petite) | 50 |

+4 si la correction de quartier DVF a pu être appliquée, −5 si la catégorie « tous
appartements » a dû servir, −5 à Paris si l'époque est inconnue. La fourchette suit la même
grille que la vente (±6 % à ±13 %) ; quand un plafond légal s'applique, la borne haute est le
plafond.

### Rendement brut

`loyer annuel hors charges ÷ valeur de vente estimée (DVF)`, affiché quand la valeur de vente
a pu être calculée.

## 3. Limites et points à vérifier

- **Aucun loyer réel n'a servi au calage.** Les coefficients (prime de relocation, élasticités,
  meublé, charges, poids) sont des ordres de grandeur issus des observatoires ; à ajuster dès
  que des loyers signés sont connus (gestion locative, baux de clients). Piste : enregistrer le
  loyer finalement obtenu pour chaque lead « Louer » et comparer.
- **Surfaces de référence** de la Carte des loyers (`RENT_REFERENCE_SURFACES`, 40 / 72 / 49 /
  92 m²) : à confirmer dans le guide d'utilisation du millésime importé (data.gouv.fr) ;
  surchargeables par variable d'environnement.
- **Colonnes de la Carte des loyers** : l'import lit `INSEE_C`, `LIBGEO`, `loypredm2`,
  `lwr.IPm2`, `upr.IPm2`, `TYPPRED`, `nbobs_com`, `nbobs_mail` sans tenir compte de la casse ;
  il affiche les valeurs distinctes de `TYPPRED` rencontrées (commune / maille) pour contrôle.
- **Encadrement** : Paris uniquement pour l'instant. Lille, Lyon/Villeurbanne, Montpellier,
  Bordeaux, Plaine Commune, Est Ensemble, Pays basque et Grenoble appliquent aussi
  l'encadrement : même mécanisme (`rent_control_zones`, champ `city`) à alimenter avec leurs
  jeux de données.
- **Zones tendues** : liste approchée par département ; la liste officielle des communes
  (décret 2013-392) pourrait être importée pour les départements de grande couronne.
- **Charges** : forfait au m² ; les charges réelles dépendent de l'immeuble (chauffage
  collectif, gardien…).
- Les règles légales citées sont celles en vigueur à la date de l'estimation (DPE, gel,
  encadrement prolongé) : à tenir à jour dans `lib/config-rent.js` et `lib/rent-rules.js`.
