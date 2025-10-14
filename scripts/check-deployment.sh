#!/bin/bash

# Script de vérification pré-déploiement pour AlterEgo
echo "🔍 Vérification Pré-Déploiement AlterEgo"
echo "========================================"
echo ""

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Compteurs
ERRORS=0
WARNINGS=0

# 1. Vérifier Dockerfile
echo "📦 Dockerfile..."
if [ -f "Dockerfile" ]; then
    echo -e "${GREEN}✓${NC} Dockerfile présent"
else
    echo -e "${RED}✗${NC} Dockerfile manquant"
    ERRORS=$((ERRORS + 1))
fi

# 2. Vérifier package.json
echo ""
echo "📋 package.json..."
if [ -f "package.json" ]; then
    echo -e "${GREEN}✓${NC} package.json présent"
    
    # Vérifier les scripts nécessaires
    if grep -q '"build"' package.json; then
        echo -e "${GREEN}✓${NC} Script 'build' trouvé"
    else
        echo -e "${RED}✗${NC} Script 'build' manquant dans package.json"
        ERRORS=$((ERRORS + 1))
    fi
    
    if grep -q '"start"' package.json; then
        echo -e "${GREEN}✓${NC} Script 'start' trouvé"
    else
        echo -e "${RED}✗${NC} Script 'start' manquant dans package.json"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}✗${NC} package.json manquant"
    ERRORS=$((ERRORS + 1))
fi

# 3. Vérifier lockfile
echo ""
echo "🔒 Lockfile..."
if [ -f "yarn.lock" ]; then
    echo -e "${GREEN}✓${NC} yarn.lock présent"
elif [ -f "package-lock.json" ]; then
    echo -e "${GREEN}✓${NC} package-lock.json présent"
elif [ -f "pnpm-lock.yaml" ]; then
    echo -e "${GREEN}✓${NC} pnpm-lock.yaml présent"
else
    echo -e "${YELLOW}⚠${NC} Aucun lockfile trouvé (yarn install sera utilisé)"
    WARNINGS=$((WARNINGS + 1))
fi

# 4. Vérifier .dockerignore
echo ""
echo "🚫 .dockerignore..."
if [ -f ".dockerignore" ]; then
    echo -e "${GREEN}✓${NC} .dockerignore présent"
else
    echo -e "${YELLOW}⚠${NC} .dockerignore manquant (recommandé)"
    WARNINGS=$((WARNINGS + 1))
fi

# 5. Vérifier .env.example
echo ""
echo "🔐 Variables d'environnement..."
if [ -f ".env.example" ]; then
    echo -e "${GREEN}✓${NC} .env.example présent"
else
    echo -e "${YELLOW}⚠${NC} .env.example manquant (documentation recommandée)"
    WARNINGS=$((WARNINGS + 1))
fi

# 6. Vérifier structure Next.js
echo ""
echo "⚛️  Structure Next.js..."
if [ -f "next.config.js" ] || [ -f "next.config.mjs" ]; then
    echo -e "${GREEN}✓${NC} Configuration Next.js présente"
else
    echo -e "${RED}✗${NC} next.config.js manquant"
    ERRORS=$((ERRORS + 1))
fi

if [ -d "app" ] || [ -d "pages" ]; then
    echo -e "${GREEN}✓${NC} Répertoire app/ ou pages/ présent"
else
    echo -e "${RED}✗${NC} Ni app/ ni pages/ trouvé"
    ERRORS=$((ERRORS + 1))
fi

# 7. Vérifier .gitignore
echo ""
echo "📝 .gitignore..."
if [ -f ".gitignore" ]; then
    echo -e "${GREEN}✓${NC} .gitignore présent"
    
    if grep -q "node_modules" .gitignore; then
        echo -e "${GREEN}✓${NC} node_modules est ignoré"
    else
        echo -e "${YELLOW}⚠${NC} node_modules devrait être dans .gitignore"
        WARNINGS=$((WARNINGS + 1))
    fi
    
    if grep -q ".env" .gitignore; then
        echo -e "${GREEN}✓${NC} .env est ignoré"
    else
        echo -e "${RED}✗${NC} .env devrait être dans .gitignore"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${YELLOW}⚠${NC} .gitignore manquant"
    WARNINGS=$((WARNINGS + 1))
fi

# 8. Vérifier taille du repo
echo ""
echo "💾 Taille du projet..."
SIZE=$(du -sh . 2>/dev/null | cut -f1)
echo "   Taille totale: $SIZE"

# 9. Test build local (optionnel)
echo ""
echo "🏗️  Test de build..."
echo -e "${YELLOW}ℹ${NC} Pour tester le build localement: ${GREEN}yarn build${NC}"

# Résumé
echo ""
echo "========================================"
echo "📊 Résumé"
echo "========================================"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ Prêt pour le déploiement !${NC}"
    echo ""
    echo "🚀 Prochaines étapes:"
    echo "   1. Commit et push sur GitHub"
    echo "   2. Déployer sur Dokploy"
    echo "   3. Configurer les variables d'environnement"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  Prêt avec quelques avertissements${NC}"
    echo -e "   ${WARNINGS} avertissement(s)"
    echo ""
    echo "Vous pouvez déployer, mais corrigez les avertissements pour optimiser."
    exit 0
else
    echo -e "${RED}❌ Corrections nécessaires avant le déploiement${NC}"
    echo -e "   ${ERRORS} erreur(s)"
    echo -e "   ${WARNINGS} avertissement(s)"
    echo ""
    echo "Corrigez les erreurs avant de déployer."
    exit 1
fi
