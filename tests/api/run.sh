#!/bin/sh
# Lance le serveur de production (après yarn build) puis les tests d'intégration de l'API.
# Nécessite une base MongoDB accessible via MONGO_URL (base de test dédiée : elle est vidée).
set -e
export MONGO_URL="${MONGO_URL:-mongodb://127.0.0.1:27017}"
export DB_NAME="${DB_NAME:-alterego_test}"
export JWT_SECRET="${JWT_SECRET:-api-test-secret-0123456789abcdef}"
export ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
export ADMIN_PASSWORD="${ADMIN_PASSWORD:-Test-Admin-2026!}"
export PORT=3200 HOSTNAME=127.0.0.1 NODE_ENV=production

node .next/standalone/server.js > /tmp/alterego-api-test.log 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
for i in $(seq 1 30); do
  curl -sf http://127.0.0.1:3200/api > /dev/null && break
  sleep 1
done
BASE_URL=http://127.0.0.1:3200 node --test --test-concurrency=1 tests/api/*.test.mjs || {
  echo '--- Journal du serveur ---'; cat /tmp/alterego-api-test.log; exit 1;
}
