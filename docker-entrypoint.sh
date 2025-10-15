#!/bin/sh

###############################################################################
# Docker Entrypoint - AlterEgo Application
# 1. Initialise les données DVF si nécessaire
# 2. Lance l'application Next.js
###############################################################################

set -e

echo "🚀 AlterEgo - Démarrage du conteneur"
echo "======================================"

# Exécuter le script d'initialisation DVF
if [ -f "/app/scripts/init-dvf-on-startup.sh" ]; then
    sh /app/scripts/init-dvf-on-startup.sh
fi

# Lancer l'application Next.js
echo "🌐 Démarrage de l'application Next.js..."
exec "$@"
