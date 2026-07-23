# Multi-stage: `dev` roda com hot-reload (tsx watch) via bind mount,
# `prod` roda a mesma stack (tsx, sem build step — ver README) sem bind mounts.
FROM node:24-slim AS base
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/server/package.json ./apps/server/package.json
COPY packages/db/package.json ./packages/db/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json

FROM base AS dev
RUN pnpm install --frozen-lockfile
COPY apps/server ./apps/server
COPY packages/db ./packages/db
COPY packages/contracts ./packages/contracts
WORKDIR /app/apps/server
EXPOSE 3000
CMD ["pnpm", "dev"]

FROM base AS prod
RUN pnpm install --prod --frozen-lockfile
COPY apps/server ./apps/server
COPY packages/db ./packages/db
COPY packages/contracts ./packages/contracts
WORKDIR /app/apps/server
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npx", "tsx", "src/server.ts"]
