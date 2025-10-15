# Multi-stage build optimisé pour Next.js standalone
FROM node:20-alpine AS deps
WORKDIR /app

# Copier les fichiers de dépendances
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./

# Installer les dépendances de production uniquement
RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile --production=false; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm i --frozen-lockfile; \
  else echo "No lockfile found, using yarn install" && yarn install; \
  fi

# Stage 2: Build de l'application
FROM node:20-alpine AS builder
WORKDIR /app

# Copier les dépendances depuis deps
COPY --from=deps /app/node_modules ./node_modules

# Copier le code source
COPY . .

# Variables d'environnement pour le build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build de l'application Next.js
RUN yarn build

# Stage 3: Production runner (image finale légère)
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Créer un utilisateur non-root pour la sécurité
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copier les fichiers nécessaires depuis le builder
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copier les scripts d'ingestion DVF et d'initialisation
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/lib ./lib
COPY --from=builder --chown=nextjs:nodejs /app/docker-entrypoint.sh ./

# Rendre les scripts exécutables
USER root
RUN chmod +x /app/docker-entrypoint.sh /app/scripts/*.sh

# Changer vers l'utilisateur non-root
USER nextjs

# Exposer le port 3000
EXPOSE 3000

# Utiliser l'entrypoint personnalisé
ENTRYPOINT ["/app/docker-entrypoint.sh"]

# Démarrer l'application standalone
CMD ["node", "server.js"]
