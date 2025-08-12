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
COPY apps/user-ui/src ./apps/user-ui/src
RUN pnpm --filter user-ui run build
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
WORKDIR /app/apps/user-ui
EXPOSE 3000
CMD ["node", "dist/index.js"]
