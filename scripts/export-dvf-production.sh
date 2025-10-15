#!/bin/bash

###############################################################################
# Script d'export des données DVF pour transfert vers production
# Usage: bash scripts/export-dvf-production.sh
###############################################################################

set -e

echo "🚀 Export des données DVF pour production Dokploy"
echo "=================================================="
echo ""

# Configuration
EXPORT_DIR="./dvf_export"
ARCHIVE_NAME="dvf_sales_$(date +%Y%m%d_%H%M%S).tar.gz"
MONGO_URL="${MONGO_URL:-mongodb://localhost:27017}"
DB_NAME="${DB_NAME:-alterego_db}"

# Vérifier que MongoDB est accessible
echo "📡 Vérification de la connexion MongoDB..."
if ! mongosh "$MONGO_URL" --quiet --eval "db.stats()" > /dev/null 2>&1; then
    echo "❌ Erreur : Impossible de se connecter à MongoDB"
    echo "   Vérifiez que MongoDB est démarré et que MONGO_URL est correct"
    exit 1
fi
echo "✅ Connexion MongoDB OK"
echo ""

# Compter les documents
echo "📊 Comptage des documents DVF..."
DOC_COUNT=$(mongosh "$MONGO_URL/$DB_NAME" --quiet --eval "db.dvf_sales.countDocuments()" 2>/dev/null || echo "0")
echo "   Nombre de transactions DVF : $DOC_COUNT"

if [ "$DOC_COUNT" -eq 0 ]; then
    echo "⚠️  Attention : La collection dvf_sales est vide !"
    echo "   Rien à exporter."
    exit 1
fi
echo ""

# Nettoyage de l'ancien export
if [ -d "$EXPORT_DIR" ]; then
    echo "🧹 Nettoyage de l'ancien export..."
    rm -rf "$EXPORT_DIR"
fi

# Export avec mongodump
echo "📦 Export de la collection dvf_sales..."
mongodump \
    --uri="$MONGO_URL/$DB_NAME" \
    --collection=dvf_sales \
    --out="$EXPORT_DIR" \
    --quiet

if [ ! -d "$EXPORT_DIR" ]; then
    echo "❌ Erreur : L'export a échoué"
    exit 1
fi
echo "✅ Export terminé"
echo ""

# Création de l'archive
echo "🗜️  Création de l'archive compressée..."
tar -czf "$ARCHIVE_NAME" "$EXPORT_DIR/"
ARCHIVE_SIZE=$(du -h "$ARCHIVE_NAME" | cut -f1)
echo "✅ Archive créée : $ARCHIVE_NAME ($ARCHIVE_SIZE)"
echo ""

# Instructions
echo "📋 Prochaines étapes :"
echo "=========================================="
echo ""
echo "1️⃣  Transférer l'archive vers le serveur Dokploy :"
echo "   scp $ARCHIVE_NAME ubuntu@vps-84005014.vps.ovh.net:/tmp/"
echo ""
echo "2️⃣  Connexion SSH au serveur :"
echo "   ssh ubuntu@vps-84005014.vps.ovh.net"
echo ""
echo "3️⃣  Décompresser l'archive :"
echo "   cd /tmp"
echo "   tar -xzf $ARCHIVE_NAME"
echo ""
echo "4️⃣  Importer dans MongoDB Dokploy :"
echo "   # Trouvez le nom du conteneur MongoDB"
echo "   docker ps | grep mongo"
echo ""
echo "   # Copier l'export dans le conteneur"
echo "   docker cp dvf_export <MONGO_CONTAINER_NAME>:/tmp/"
echo ""
echo "   # Importer les données"
echo "   docker exec <MONGO_CONTAINER_NAME> mongorestore \\"
echo "     --uri=\"mongodb://mongo:PASSWORD@localhost:27017/alterego_db\" \\"
echo "     --collection=dvf_sales \\"
echo "     /tmp/dvf_export/alterego_db/dvf_sales.bson"
echo ""
echo "=========================================="
echo "✅ Export terminé avec succès !"
echo ""
echo "Alternative plus simple : Utilisez l'ingestion directe en production"
echo "   node scripts/ingest-all-france.js"
