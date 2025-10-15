#!/bin/sh

###############################################################################
# Docker Entrypoint - AlterEgo Application
# 1. Initialise les données DVF si nécessaire
# 2. Lance l'application Next.js
###############################################################################

set -e

echo "🚀 AlterEgo - Démarrage du conteneur"
echo "======================================"

# Exécuter le script d'initialisation DVF (désactivé temporairement pour debug)
# if [ -f "/app/scripts/init-dvf-on-startup.sh" ]; then
#     sh /app/scripts/init-dvf-on-startup.sh
# fi

echo "⚠️  Chargement automatique DVF désactivé"
echo "📝 Pour charger les données, exécutez manuellement :"
echo "   docker exec -it <container-id> sh -c 'cd /app && node scripts/ingest-all-france.js'"

# Lancer l'application Next.js
echo "🌐 Démarrage de l'application Next.js..."
exec "$@"
