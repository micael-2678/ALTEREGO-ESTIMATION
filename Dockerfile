# Dockerfile pour AlterEgo - Application Next.js
FROM node:20-alpine

# Définir le répertoire de travail
WORKDIR /app

# Copier les fichiers de dépendances
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./

# Installer les dépendances
RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm i --frozen-lockfile; \
  else echo "No lockfile found, using yarn install" && yarn install; \
  fi

# Copier tout le code source
COPY . .

# Variables d'environnement pour la build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build de l'application Next.js
RUN yarn build

# Exposer le port 3000
EXPOSE 3000

# Définir les variables d'environnement par défaut (à surcharger)
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Démarrer l'application
CMD ["yarn", "start"]
