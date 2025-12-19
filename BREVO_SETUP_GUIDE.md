# 📧 Guide de Configuration Brevo pour AlterEgo

## 🎯 Objectif
Ce guide vous explique comment configurer votre compte Brevo pour recevoir automatiquement tous les leads avec leurs informations détaillées et personnaliser vos campagnes d'emailing.

---

## ✅ Étape 1 : Créer les Attributs de Contact

Les attributs permettent de stocker toutes les informations des leads pour personnaliser vos emails.

### Accéder aux Attributs
1. Connectez-vous à Brevo : https://app.brevo.com/
2. Allez dans **Contacts** → **Paramètres** → **Attributs de contact**
3. Cliquez sur **Créer un attribut**

### Liste des Attributs à Créer

Créez chacun de ces attributs avec le type indiqué :

| Nom de l'attribut | Type | Description |
|-------------------|------|-------------|
| `NOM` | Texte | Nom complet du client |
| `RAISON_ESTIMATION` | Texte | **IMPORTANT** - "Acheter" ou "Vendre" |
| `ADRESSE` | Texte | Adresse du bien estimé |
| `TYPE_BIEN` | Texte | "appartement" ou "maison" |
| `SURFACE` | Nombre | Surface habitable en m² |
| `SURFACE_TERRAIN` | Nombre | Surface du terrain en m² (pour maisons) |
| `PIECES` | Texte | Nombre de pièces |
| `ETAGE` | Texte | Étage (pour appartements) |
| `BALCON_TERRASSE` | Texte | "Oui" ou "Non" |
| `PARKING` | Texte | "Oui" ou "Non" |
| `CAVE` | Texte | "Oui" ou "Non" |
| `PISCINE` | Texte | "Oui" ou "Non" |
| `VUE` | Texte | Type de vue |
| `DPE` | Texte | Diagnostic énergétique (A à G) |
| `STANDING` | Nombre | Note de 1 à 5 |
| `PRIX_ESTIME` | Nombre | Prix estimé en € |
| `PRIX_MIN` | Nombre | Prix minimum en € |
| `PRIX_MAX` | Nombre | Prix maximum en € |
| `CONFIANCE` | Nombre | Indice de confiance (0-100) |
| `DATE_ESTIMATION` | Date | Date de l'estimation |
| `CONSENTEMENT` | Texte | "Oui" ou "Non" |

---

## 📋 Étape 2 : Créer les Listes de Segmentation

Les listes permettent d'organiser vos contacts selon leur intention.

### Liste 1 : Vendeurs
1. Allez dans **Contacts** → **Listes**
2. Cliquez sur **Créer une liste**
3. Nom : `Vendeurs`
4. Description : `Contacts qui souhaitent vendre leur bien`

### Liste 2 : Acheteurs
1. Cliquez sur **Créer une liste**
2. Nom : `Acheteurs`
3. Description : `Contacts qui souhaitent acheter un bien`

### 📝 Note importante
Pour activer l'ajout automatique aux listes, vous devez récupérer les IDs des listes et les ajouter dans le code :
- Dans le fichier `/app/lib/brevo-contact-service.js`, lignes 55-59
- Remplacez les commentaires par les vrais IDs de vos listes

Exemple :
```javascript
if (estimationReason === 'Vendre') {
  listIds.push(2); // Remplacer 2 par l'ID réel de votre liste Vendeurs
} else if (estimationReason === 'Acheter') {
  listIds.push(3); // Remplacer 3 par l'ID réel de votre liste Acheteurs
}
```

Pour trouver l'ID d'une liste :
1. Allez dans **Contacts** → **Listes**
2. Cliquez sur votre liste
3. L'ID apparaît dans l'URL : `https://app.brevo.com/contact/list/id:XXX`

---

## ✉️ Étape 3 : Créer vos Campagnes Email

### Pour les VENDEURS

#### Email de Bienvenue - Vendeurs
**Objet** : `{{contact.NOM}}, votre estimation de {{contact.ADRESSE}} est prête !`

**Contenu suggéré** :
```
Bonjour {{contact.NOM}},

Merci pour votre demande d'estimation pour votre {{contact.TYPE_BIEN}} situé(e) à {{contact.ADRESSE}}.

📊 VOTRE ESTIMATION :
• Surface : {{contact.SURFACE}} m²
• Prix estimé : {{contact.PRIX_ESTIME}} €
• Fourchette : {{contact.PRIX_MIN}} € - {{contact.PRIX_MAX}} €
• Indice de confiance : {{contact.CONFIANCE}}%

🎯 PROCHAINES ÉTAPES POUR VENDRE :
1. Visite gratuite par un expert local
2. Photos professionnelles incluses
3. Mise en ligne sur 200+ sites immobiliers
4. Accompagnement personnalisé jusqu'à la vente

[BOUTON : Prendre RDV avec un Expert]

Pourquoi nous faire confiance ?
✓ Vente en moyenne 15 jours plus rapide
✓ Commission négociable
✓ Service premium inclus

À très bientôt,
L'équipe AlterEgo
```

---

### Pour les ACHETEURS

#### Email de Bienvenue - Acheteurs
**Objet** : `{{contact.NOM}}, découvrez des biens comme {{contact.ADRESSE}}`

**Contenu suggéré** :
```
Bonjour {{contact.NOM}},

Vous avez consulté l'estimation d'un {{contact.TYPE_BIEN}} de {{contact.SURFACE}} m² à {{contact.ADRESSE}}.

💡 NOUS POUVONS VOUS AIDER :
• Recherche personnalisée de biens correspondant à vos critères
• Alertes instantanées sur les nouvelles annonces
• Accompagnement pour les visites
• Négociation et montage du dossier de financement

🏠 BIENS SIMILAIRES DISPONIBLES :
[Ici, vous pouvez ajouter un bloc dynamique de biens disponibles]

📍 SECTEUR RECHERCHÉ :
Vous êtes intéressé par le secteur de {{contact.ADRESSE}}.
Prix moyen au m² : {{contact.PRIX_ESTIME / contact.SURFACE}} €/m²

[BOUTON : Voir les Biens Disponibles]
[BOUTON : Créer mon Alerte]

Besoin d'aide pour votre projet ?
✓ Conseil gratuit et sans engagement
✓ Accompagnement personnalisé
✓ Accès en avant-première aux nouveautés

À très bientôt,
L'équipe AlterEgo
```

---

## 🤖 Étape 4 : Créer des Scénarios d'Automatisation

### Automatisation pour Vendeurs
1. Allez dans **Automatisations** → **Créer un scénario**
2. **Déclencheur** : "Un contact est ajouté à la liste Vendeurs"
3. **Action 1** (Immédiate) : Envoyer "Email de Bienvenue - Vendeurs"
4. **Action 2** (J+2) : Envoyer "Rappel - Planifiez votre visite d'expert"
5. **Action 3** (J+7) : Envoyer "Témoignages clients - Ventes réussies"

### Automatisation pour Acheteurs
1. Allez dans **Automatisations** → **Créer un scénario**
2. **Déclencheur** : "Un contact est ajouté à la liste Acheteurs"
3. **Action 1** (Immédiate) : Envoyer "Email de Bienvenue - Acheteurs"
4. **Action 2** (J+2) : Envoyer "Nouveaux biens dans votre secteur"
5. **Action 3** (J+7) : Envoyer "Guide de l'acheteur immobilier"

---

## 🎨 Conseils de Personnalisation

### Utiliser les Variables dans vos Emails
Brevo vous permet d'utiliser les attributs pour personnaliser chaque email :

```
Bonjour {{contact.NOM}},

Votre {{contact.TYPE_BIEN}} de {{contact.SURFACE}} m² vaut environ {{contact.PRIX_ESTIME}} €.

{% if contact.RAISON_ESTIMATION == "Vendre" %}
Nous pouvons vous aider à vendre rapidement.
{% else %}
Nous avons des biens similaires disponibles.
{% endif %}
```

### Segmentation Avancée
Vous pouvez créer des segments plus précis dans Brevo :

**Exemple : Vendeurs de maisons haut standing**
- Condition 1 : `RAISON_ESTIMATION` = "Vendre"
- Condition 2 : `TYPE_BIEN` = "maison"
- Condition 3 : `STANDING` >= 4
- Condition 4 : `SURFACE` > 150

---

## 📊 Étape 5 : Suivre vos Performances

### Tableaux de Bord Brevo
1. **Statistiques des Campagnes** : Taux d'ouverture, clics, conversions
2. **Suivi des Contacts** : Comportement des vendeurs vs acheteurs
3. **ROI** : Calculez le retour sur investissement de vos campagnes

### KPIs à Suivre
- Taux d'ouverture par segment (Vendeurs vs Acheteurs)
- Taux de clic sur les CTA principaux
- Nombre de RDV pris depuis les emails
- Conversions (ventes conclues, achats réalisés)

---

## 🔧 Support et Dépannage

### Vérifier que tout fonctionne
1. Faites une estimation test sur votre site
2. Vérifiez que le contact apparaît dans Brevo
3. Contrôlez que tous les attributs sont bien remplis
4. Testez qu'il est ajouté à la bonne liste (Vendeurs ou Acheteurs)

### Problèmes Courants

**Le contact n'apparaît pas dans Brevo**
- Vérifiez que la clé API Brevo est correcte dans `.env.local`
- Consultez les logs du serveur : `sudo supervisorctl tail -f nextjs`

**Les attributs sont vides**
- Assurez-vous d'avoir créé tous les attributs avec les NOMS EXACTS
- Les noms sont sensibles à la casse : `RAISON_ESTIMATION` ≠ `raison_estimation`

**Les emails ne partent pas automatiquement**
- Vérifiez que vos scénarios d'automatisation sont activés
- Contrôlez que les contacts sont bien ajoutés aux listes

---

## 📞 Besoin d'Aide ?

Si vous rencontrez des difficultés :
1. Consultez la documentation Brevo : https://help.brevo.com/
2. Vérifiez les logs de l'application
3. Testez avec le numéro bypass (0698793430) pour éviter de consommer des crédits SMS

---

## ✅ Checklist Finale

- [ ] Tous les attributs de contact sont créés dans Brevo
- [ ] Les listes "Vendeurs" et "Acheteurs" sont créées
- [ ] Les IDs des listes sont ajoutés dans le code (optionnel)
- [ ] Les emails de bienvenue sont créés et testés
- [ ] Les scénarios d'automatisation sont configurés et activés
- [ ] Un test complet a été effectué (de l'estimation à la réception de l'email)

---

🎉 **Félicitations !** Votre système de qualification et d'emailing automatisé est maintenant opérationnel.
