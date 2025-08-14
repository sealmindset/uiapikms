FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml ./
COPY packages ./packages
RUN mkdir -p apps/user-ui
COPY apps/user-ui/package.json apps/user-ui/tsconfig.json ./apps/user-ui/
COPY prisma ./prisma
RUN corepack enable && corepack prepare pnpm@9.6.0 --activate
RUN pnpm install --no-frozen-lockfile
RUN pnpm -w prisma:generate

FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app /app
COPY tsconfig.base.json ./
COPY prisma ./prisma
RUN corepack enable && corepack prepare pnpm@9.6.0 --activate
RUN pnpm -w prisma:generate
RUN pnpm --filter @uiapikms/shared exec tsc -p tsconfig.json
# Copy source incl. views and public assets
COPY apps/user-ui/src ./apps/user-ui/src
RUN pnpm --filter user-ui run build
# Copy static assets into dist for runtime serving
COPY apps/user-ui/src/public ./apps/user-ui/dist/public
## Using workspace node_modules from deps stage

FROM node:20-bookworm-slim
ENV NODE_ENV=production
# Ensure OpenSSL is present for Prisma engines
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
# Bring in full workspace with node_modules
COPY --from=deps /app /app
# Copy built artifacts into app package
COPY --from=build /app/apps/user-ui/dist /app/apps/user-ui/dist

COPY --from=build /app/apps/user-ui/src/views /app/apps/user-ui/src/views
# Public static assets (raw) – serve in prod image
COPY apps/user-ui/src/public /app/apps/user-ui/public
WORKDIR /app/apps/user-ui
# Ensure Prisma Client is generated in the final image
RUN corepack enable \
 && corepack prepare pnpm@9.6.0 --activate \
 && pnpm -w prisma:generate
EXPOSE 3000
CMD ["node", "dist/index.js"]
