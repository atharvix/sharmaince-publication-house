# syntax=docker/dockerfile:1

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src
COPY scripts ./scripts
RUN npx prisma generate && npm run build

FROM node:24-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
# Production dependencies plus the Prisma CLI, which the one-off migrate step needs.
RUN npm ci --omit=dev && npm install --no-save --omit=dev prisma@$(node -p "require('./package-lock.json').packages['node_modules/prisma'].version") \
  && npx prisma generate && npm cache clean --force

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./
COPY --chown=node:node prisma ./prisma
RUN mkdir -p /app/uploads && chown node:node /app/uploads
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --start-interval=1s CMD wget -qO- http://127.0.0.1:4000/api/health || exit 1
# Migrations are a separate release step (`npm run prisma:deploy`, see docker-compose.yml),
# not part of startup, so several replicas never race to migrate.
CMD ["node", "dist/index.js"]
