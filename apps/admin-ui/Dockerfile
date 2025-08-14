FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml ./
COPY packages ./packages
RUN mkdir -p apps/admin-ui
COPY apps/admin-ui/package.json apps/admin-ui/tsconfig.json ./apps/admin-ui/
RUN corepack enable && corepack prepare pnpm@9.6.0 --activate
RUN pnpm install --no-frozen-lockfile

FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app /app
COPY tsconfig.base.json ./
COPY prisma ./prisma
RUN corepack enable && corepack prepare pnpm@9.6.0 --activate
RUN pnpm -w prisma:generate
RUN pnpm --filter @uiapikms/shared exec tsc -p tsconfig.json
COPY apps/admin-ui/src ./apps/admin-ui/src
RUN pnpm --filter admin-ui run build

FROM node:20-bookworm-slim
ENV NODE_ENV=production
# Install OpenSSL required by Prisma engines
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
# Bring in full workspace with node_modules
COPY --from=deps /app /app
# Copy Prisma schema so generate can run
COPY --from=build /app/prisma /app/prisma
# Copy built artifacts into app package
COPY --from=build /app/apps/admin-ui/dist /app/apps/admin-ui/dist
COPY --from=build /app/apps/admin-ui/src/views /app/apps/admin-ui/src/views
WORKDIR /app/apps/admin-ui
# Ensure Prisma Client is generated in the final image
RUN corepack enable \
 && corepack prepare pnpm@9.6.0 --activate \
 && pnpm -w prisma:generate
EXPOSE 4000
CMD ["node", "dist/index.js"]
