#!/bin/bash

# Script wrapper pour lancer l'ingestion DVF avec les bonnes variables d'environnement
cd /app

# Charger les variables d'environnement
export $(cat .env | grep -v '^#' | xargs)

# Lancer le script Node.js
node scripts/ingest-all-france.js
