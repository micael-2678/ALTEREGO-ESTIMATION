#!/bin/sh
###############################################################################
# Diagnostic du « 404 page not found » de Traefik sur un serveur Dokploy.
# Lecture seule : ne modifie rien. À lancer en root sur le serveur (SSH) :
#   sh scripts/diagnostic-traefik.sh [domaine]
# puis transmettre la sortie complète.
###############################################################################

DOMAIN="${1:-app.alteregopatrimoine.com}"
DYNAMIC_DIR="${DOKPLOY_TRAEFIK_DYNAMIC:-/etc/dokploy/traefik/dynamic}"

section() { printf '\n==== %s ====\n' "$1"; }

section "Versions"
docker version --format 'Docker {{.Server.Version}} (API {{.Server.APIVersion}}, minimum {{.Server.MinAPIVersion}})' 2>&1
TRAEFIK=$(docker ps --filter name=dokploy-traefik --format '{{.ID}}' | head -1)
if [ -z "$TRAEFIK" ]; then
  TRAEFIK=$(docker ps --filter ancestor=traefik --format '{{.ID}}' | head -1)
fi
if [ -z "$TRAEFIK" ]; then
  echo "!! Aucun conteneur Traefik en cours d'exécution"
else
  docker inspect "$TRAEFIK" --format 'Traefik : {{.Name}} image {{.Config.Image}}, démarré {{.State.StartedAt}}'
fi

section "Erreurs Traefik (24 dernières heures)"
if [ -n "$TRAEFIK" ]; then
  docker logs --since 24h "$TRAEFIK" 2>&1 | grep -iE 'error|too old|unable|conflict' | tail -25
  if docker logs --since 24h "$TRAEFIK" 2>&1 | grep -q 'too old'; then
    echo "!! Traefik est trop ancien pour cette version de Docker : le mettre à jour (v3.6 ou plus)"
  fi
fi

section "Routes Dokploy déclarées pour $DOMAIN (onglet Domains)"
FILES=$(grep -rl "$DOMAIN" "$DYNAMIC_DIR" 2>/dev/null)
if [ -z "$FILES" ]; then
  echo "!! Aucune route pour $DOMAIN dans $DYNAMIC_DIR"
  echo "   → Dans Dokploy : application > Domains > ajouter $DOMAIN (port 3000, HTTPS activé)"
else
  for f in $FILES; do
    echo "--- $f"
    cat "$f"
  done
fi

section "Étiquettes Traefik portées par des conteneurs pour $DOMAIN"
for c in $(docker ps -q); do
  if docker inspect "$c" --format '{{json .Config.Labels}}' | grep -q "$DOMAIN"; then
    docker inspect "$c" --format '{{.Name}} ({{.Config.Image}})'
    docker inspect "$c" --format '{{range $k, $v := .Config.Labels}}{{$k}}={{$v}}{{println}}{{end}}' | grep traefik
  fi
done

section "Conteneurs et services de l'application"
docker service ls 2>/dev/null | grep -iE 'alterego|estimation'
docker ps -a --format '{{.Names}}\t{{.Image}}\t{{.Status}}' | grep -iE 'alterego|estimation'

section "L'application répond-elle depuis Traefik ?"
URLS=""
if [ -n "$FILES" ]; then
  URLS=$(grep -hoE 'url: *"?http://[^"[:space:]]+' $FILES 2>/dev/null | sed -E 's/url: *"?//' | sort -u)
fi
if [ -n "$TRAEFIK" ] && [ -n "$URLS" ]; then
  for u in $URLS; do
    printf '%s/api → ' "$u"
    timeout 15 docker exec "$TRAEFIK" wget -q -T 5 -O - "$u/api" 2>&1 | head -c 200
    echo
  done
else
  echo "(pas d'URL de service trouvée dans la configuration Dokploy)"
fi

section "Réponse de Traefik pour $DOMAIN"
HTTP_CODE=$(curl --noproxy '*' -m 10 -s -o /dev/null -w '%{http_code}' -H "Host: $DOMAIN" http://127.0.0.1/)
HTTPS_CODE=$(curl --noproxy '*' -m 10 -sk -o /dev/null -w '%{http_code}' --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/")
echo "HTTP  : $HTTP_CODE"
echo "HTTPS : $HTTPS_CODE"
printf 'HTTPS /api : '
curl --noproxy '*' -m 10 -sk --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/api" | head -c 200
echo

section "Conclusion"
TOO_OLD=""
if [ -n "$TRAEFIK" ] && docker logs --since 24h "$TRAEFIK" 2>&1 | grep -q 'too old'; then
  TOO_OLD=1
fi
if [ "$HTTPS_CODE" = "200" ]; then
  echo "→ Tout répond correctement depuis le serveur. Si le navigateur affiche encore 404 :"
  echo "  vérifier le DNS de $DOMAIN (doit pointer vers ce serveur) et vider le cache."
elif [ -z "$FILES" ] && [ "$HTTPS_CODE" = "404" ]; then
  echo "→ Aucun domaine déclaré dans Dokploy pour $DOMAIN (des étiquettes ajoutées à la main"
  echo "  disparaissent à chaque redéploiement). Dokploy > application > Domains > ajouter"
  echo "  $DOMAIN, port 3000, HTTPS activé (Let's Encrypt), puis redéployer."
elif [ "$HTTPS_CODE" = "404" ] && [ "$HTTP_CODE" != "404" ]; then
  echo "→ Le domaine existe mais sans HTTPS : https:// renvoie 404. Dokploy > application >"
  echo "  Domains > modifier $DOMAIN > activer HTTPS (certificat Let's Encrypt), puis redéployer."
elif [ "$HTTPS_CODE" = "502" ] || [ "$HTTPS_CODE" = "504" ] || [ "$HTTP_CODE" = "502" ]; then
  echo "→ Traefik trouve la route mais pas l'application : vérifier le port du domaine (3000)"
  echo "  et que le conteneur est démarré (voir « L'application répond-elle depuis Traefik ? »)."
elif [ "$HTTPS_CODE" = "000" ] || [ -z "$TRAEFIK" ]; then
  echo "→ Traefik ne répond pas sur les ports 80/443 : vérifier qu'il est démarré."
else
  echo "→ Situation non reconnue : transmettre cette sortie complète."
fi
if [ -n "$TOO_OLD" ]; then
  echo "→ Par ailleurs, Traefik est trop ancien pour cette version de Docker : les routes par"
  echo "  étiquettes (docker-compose) répondent 404. Mettre Traefik à jour en v3.6 ou plus."
fi
