# Audit de l'outil d'estimation et refonte charte 2026

## 1. Erreurs corrigées

### Sécurité (critique)

| Problème | Risque | Correction |
|---|---|---|
| `JWT_SECRET` valait `'fallback-secret'` par défaut | N'importe qui pouvait forger un jeton admin et lire tous les leads | Plus aucun secret par défaut : sans `JWT_SECRET` (16 caractères min.), l'admin est désactivé |
| Login admin : `username === ADMIN_USERNAME` | Si les variables n'étaient pas définies, un corps vide `{}` donnait accès à l'admin (`undefined === undefined`) | Login refusé si non configuré, comparaison à temps constant, limite de 10 essais / 15 min |
| `/api/test-env` public | Exposait les 15 premiers caractères de la clé API Brevo | Supprimé |
| `/test-mongo` et `/api/test-mongo` publics | Écrivaient `MONGO_URL` (avec mot de passe) dans les logs et exposaient la base | Supprimés |
| Numéro de contournement SMS codé en dur (`0698793430`) | Toute personne saisissant ce numéro passait la vérification | Contournement actif uniquement si `BYPASS_PHONE_NUMBER` est défini |
| Code OTP généré avec `Math.random()` | Prévisible | `crypto.randomInt` |
| `/api/leads` acceptait n'importe quoi (`...leadData`) | Faux leads sans vérification SMS, injection de champs (`status`, etc.) | Téléphone vérifié **côté serveur** (30 min), liste blanche des champs, email / consentement validés |
| Envoi de SMS sans limite | Coût Brevo (SMS bombing) | 10 SMS/h par IP, 5 SMS/h par numéro |
| CORS `*` sur toute l'API, `X-Frame-Options: ALLOWALL` | N'importe quel site pouvait appeler l'API et intégrer l'outil | CORS limité à alteregopatrimoine.com (`CORS_ORIGINS`), iframe autorisée seulement pour alteregopatrimoine.com (`FRAME_ANCESTORS`), admin non intégrable et non indexé |
| Emails et téléphones dans les logs Brevo | RGPD | Logs anonymisés |
| `error.message` renvoyé au client | Fuite d'informations internes | Message générique en production |

### Fonctionnement

| Problème | Conséquence | Correction |
|---|---|---|
| Le front créait **2 leads par estimation** (avant et après le calcul) | Doublons dans l'admin et double synchro Brevo | 1 lead créé, puis l'estimation y est rattachée via `leadId` |
| Scraping SeLoger avec Puppeteer à chaque estimation | 30 à 40 s d'attente, échec quasi systématique (anti-bot, sélecteurs obsolètes, code postal passé comme code INSEE), risque juridique | Désactivé par défaut (`MARKET_SCRAPING_ENABLED=true` pour le réactiver) : l'estimation est instantanée |
| Carte : annonces placées **au hasard** autour du bien | Information fausse | Retiré. La carte montre les vraies ventes DVF et le vrai rayon de recherche (au lieu d'un cercle fixe de 1 km) |
| Ascenseur déduit de « nombre d'étages > 0 » | Ajustement étage faux pour la plupart des appartements | Question « Ascenseur oui/non » ajoutée |
| Pénalité de dispersion jamais appliquée (`dvfStats.stdDev` au lieu de `dvfStats.stats.stdDev`) | Confiance surestimée dans les zones hétérogènes | Corrigé |
| Poids de pondération pouvant être nuls ou négatifs | Vente en bord de rayon/période ignorée ou comptée à l'envers | Plancher à 0,1 |
| Résultats : « Prix estimé » affichait la **fourchette basse** et « Prix conseillé » le prix médian | Valeur affichée 6 à 10 % sous l'estimation réelle | Affichage de la valeur estimée + fourchette basse/haute |
| « Nouvelle estimation » ne réinitialisait ni la vérification SMS ni la raison | État incohérent | Réinitialisation propre (le téléphone vérifié reste valable 30 min, pas de nouveau SMS) |
| Recherche d'adresse à chaque frappe, sans annulation | Suggestions dans le désordre, charge inutile | Temporisation 250 ms + annulation + navigation clavier |
| Compte à rebours SMS avec `setInterval` non nettoyé | Fuites / double décompte | `useEffect` |
| Aucun résultat affiché quand il n'y a pas de comparables | Page quasi vide | Message dédié + prise de rendez-vous |
| Écran de lead titré « Votre estimation est prête ! » avant tout calcul | Promesse trompeuse | « Votre estimation est presque prête » ; le calcul se lance automatiquement après le code SMS (un clic en moins) |
| Consentement « dans mon projet de vente » y compris pour les acheteurs | Texte incohérent | « projet immobilier » |
| `.gitignore` corrompu (40 blocs `-e` dupliqués) | Illisible | Nettoyé |

## 2. Refonte visuelle (charte AlterEgo 2026)

- Polices **Bricolage Grotesque** (titres, 800) et **Instrument Sans** (texte), auto-hébergées dans `public/fonts` (pas de Google Fonts).
- Couleurs de la charte (`ink`, `paper`, `sand`, `line`, `brique`, `sauge`, `muted`) disponibles en Tailwind (`bg-ae-ink`, `text-ae-brique`…) et branchées sur les variables shadcn : l'admin adopte aussi la charte.
- Cartes blanches rayon 22 px bordure `line`, boutons pilule (plein `ink`, action `brique`, contour `ink` 1,5 px), surtitres majuscules brique.
- Logos officiels (`public/brand`) au lieu de l'image hébergée chez Emergent.
- Suppression des emojis, dégradés bleus/verts et couleurs génériques.
- Barre de progression « Étape X sur 6 », formulaires accessibles (labels associés, `aria-pressed`, navigation clavier), vraie mise en page mobile (grilles adaptatives).
- Page de résultats : bande sombre avec la valeur, détail du calcul, ventes comparables listées, carte sobre (fond CARTO clair, marqueurs ink/brique), appel à l'action « Prendre rendez-vous ».

## 3. Intégration dans alteregopatrimoine.com

Deux options :

**A. Sous-domaine (recommandé)** : `estimation.alteregopatrimoine.com`. L'outil a son propre en-tête (logo + « Retour au site ») et pied de page aux couleurs du site. Aucun code côté WordPress, meilleur pour le SEO et le suivi Google Ads.

**B. Iframe dans une page WordPress** : ajouter `?embed=1` masque l'en-tête et le pied de page. La hauteur est transmise automatiquement au site parent :

```html
<iframe id="ae-estimation" src="https://estimation.alteregopatrimoine.com/?embed=1"
        style="width:100%;border:0;min-height:900px" title="Estimation immobilière"></iframe>
<script>
  window.addEventListener('message', function (e) {
    if (e.origin !== 'https://estimation.alteregopatrimoine.com') return;
    if (e.data && e.data.type === 'alterego-estimation:height') {
      document.getElementById('ae-estimation').style.height = e.data.height + 'px';
    }
  });
</script>
```

## 4. Variables d'environnement

| Variable | Rôle |
|---|---|
| `JWT_SECRET` | **Obligatoire** pour l'admin (≥ 16 caractères aléatoires) |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Identifiants admin |
| `MONGO_URL`, `DB_NAME`, `BREVO_API_KEY` | Inchangés |
| `BYPASS_PHONE_NUMBER` | Optionnel, numéro de test sans SMS (à ne pas définir en production) |
| `CORS_ORIGINS` | Optionnel, origines autorisées (défaut : alteregopatrimoine.com et www) |
| `FRAME_ANCESTORS` | Optionnel, sites autorisés à intégrer l'outil en iframe |
| `NEXT_PUBLIC_MAIN_SITE_URL` | Lien « Retour au site » (défaut : https://alteregopatrimoine.com) |
| `NEXT_PUBLIC_CONTACT_URL` | Lien du bouton « Prendre rendez-vous » (à pointer vers la page contact / prise de RDV) |
| `MARKET_SCRAPING_ENABLED` | `true` pour réactiver le scraping SeLoger (déconseillé) |

## 5. Axes d'amélioration restants

1. **Modèle d'estimation**
   - Ne plus plafonner artificiellement la confiance entre 65 et 90 : avec 1 comparable, afficher 65 % n'est pas honnête. Utiliser plutôt `confidenceIndex` déjà calculé par `dvf-enhanced.js`.
   - Exploiter les données collectées mais ignorées : nombre de pièces, salles de bains, année de construction, surface de cave.
   - Indexer les prix DVF anciens sur l'évolution du marché (indices Notaires-INSEE) au lieu de les traiter comme actuels.
   - Ajouter un index géospatial MongoDB (`2dsphere`) et `$geoNear` pour remplacer la boîte englobante + filtre en JavaScript.
   - Mettre en place un jeu de test (ventes réelles connues) pour mesurer l'erreur médiane à chaque modification des poids.
2. **Nettoyage du dépôt** : ~25 fichiers `.md` de dépannage Dokploy/MongoDB à la racine, scripts Python de test Emergent, `package.json` nommé `nextjs-mongo-template`, ~40 composants shadcn non utilisés, dépendance `puppeteer` (image Docker très lourde) à retirer si le scraping reste désactivé.
3. **Architecture de l'API** : le routeur unique `[[...path]]/route.js` gagnerait à être découpé en routes Next.js (`app/api/leads/route.js`…). Les routes `DELETE /api/admin/dvf/stats` et `/status` sont en réalité des lectures : à supprimer ou passer en `GET`.
4. **Admin** : jeton stocké en `localStorage` (vulnérable en cas de XSS) → cookie `httpOnly` ; ajouter la pagination des leads.
5. **RGPD** : le consentement mentionne « ses partenaires » : à faire valider (le consentement doit être spécifique, et les partenaires identifiables). Prévoir une politique de conservation des leads et des OTP (index TTL).
6. **Tests automatisés** : aucun test JavaScript. Priorité : `dvf-adjustments.js` et `dvf-enhanced.js` (tests unitaires), puis un test Playwright du tunnel complet.
7. **Limitation de débit** en mémoire : suffisante pour une seule instance ; passer à MongoDB/Redis si plusieurs conteneurs.
