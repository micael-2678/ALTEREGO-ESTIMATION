#!/bin/sh

###############################################################################
# Script d'initialisation automatique des données DVF au démarrage
# Ce script vérifie si MongoDB contient des données DVF.
# Si vide, il charge automatiquement les données pour toute la France.
###############################################################################

set -e

echo "🚀 AlterEgo - Vérification des données DVF..."
echo "=================================================="

# Attendre que MongoDB soit prêt
echo "⏳ Attente de la disponibilité de MongoDB..."
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if node -e "
        const { MongoClient } = require('mongodb');
        const client = new MongoClient(process.env.MONGO_URL);
        client.connect()
            .then(() => { console.log('OK'); process.exit(0); })
            .catch(() => process.exit(1));
    " 2>/dev/null; then
        echo "✅ MongoDB est prêt"
        break
    fi
    
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "   Tentative $RETRY_COUNT/$MAX_RETRIES..."
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "❌ Impossible de se connecter à MongoDB après $MAX_RETRIES tentatives"
    echo "⚠️  L'application démarrera sans données DVF"
    echo "   Vous devrez les charger manuellement avec : node scripts/ingest-all-france.js"
    exit 0
fi

# Vérifier si les données DVF existent déjà
echo ""
echo "📊 Vérification de la présence des données DVF..."

DOC_COUNT=$(node -e "
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(process.env.MONGO_URL);
    client.connect()
        .then(async () => {
            const db = client.db(process.env.DB_NAME || 'alterego_db');
            const count = await db.collection('dvf_sales').countDocuments();
            console.log(count);
            await client.close();
        })
        .catch(() => console.log(0));
" 2>/dev/null || echo "0")

echo "   Nombre de transactions DVF actuelles : $DOC_COUNT"

if [ "$DOC_COUNT" -gt "0" ]; then
    echo "✅ Les données DVF sont déjà présentes ($DOC_COUNT transactions)"
    echo "   Pas besoin de recharger."
    echo ""
    exit 0
fi

echo ""
echo "⚠️  Aucune donnée DVF trouvée dans MongoDB"
echo ""
echo "🔄 Options de chargement :"
echo "   1. Chargement automatique (variable AUTO_LOAD_DVF=true)"
echo "   2. Chargement manuel (depuis le terminal)"
echo ""

# Vérifier la variable d'environnement AUTO_LOAD_DVF
if [ "$AUTO_LOAD_DVF" = "true" ]; then
    echo "✅ AUTO_LOAD_DVF=true détecté"
    echo "🚀 Lancement du chargement automatique des données DVF..."
    echo ""
    echo "🌐 Ingestion depuis l'API DVF officielle"
    echo "   📊 Toutes les transactions France (5 dernières années)"
    echo "   ⏱️  Temps estimé : 15-30 minutes"
    echo "   📡 Source : files.data.gouv.fr/geo-dvf"
    echo ""
    echo "⚠️  IMPORTANT : Le conteneur va mettre du temps à démarrer"
    echo "   mais les données seront toujours à jour !"
    echo ""
    
    # Lancer l'ingestion complète
    node /app/scripts/ingest-all-france.js > /tmp/dvf-ingestion.log 2>&1
    
    if [ $? -eq 0 ]; then
        echo "✅ Ingestion complète réussie"
        echo "📊 Consultez /tmp/dvf-ingestion.log pour les détails"
    else
        echo "⚠️  L'ingestion a rencontré des erreurs"
        echo "📊 Consultez /tmp/dvf-ingestion.log pour les détails"
        echo "ℹ️  L'application démarrera avec les données chargées (potentiellement partielles)"
    fi
else
    echo "ℹ️  AUTO_LOAD_DVF n'est pas activé"
    echo ""
    echo "Pour activer le chargement automatique, ajoutez ces variables"
    echo "d'environnement dans Dokploy :"
    echo ""
    echo "   AUTO_LOAD_DVF=true"
    echo "   DVF_LOAD_MODE=complete    (ingestion complète depuis API officielle)"
    echo "   OU"
    echo "   DVF_LOAD_MODE=quick       (chargement rapide 10k transactions)"
    echo ""
    echo "📝 Pour charger manuellement, connectez-vous au terminal et exécutez :"
    echo "   node scripts/ingest-all-france.js  (complet)"
    echo "   node scripts/load-embedded-dvf.js  (rapide)"
    echo ""
fi

echo "=================================================="
echo "✅ Initialisation terminée - Démarrage de l'application"
echo ""

exit 0
