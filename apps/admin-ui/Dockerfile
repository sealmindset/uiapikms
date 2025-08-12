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
# Bring in full workspace with node_modules
COPY --from=deps /app /app
# Copy built artifacts into app package
COPY --from=build /app/apps/admin-ui/dist /app/apps/admin-ui/dist
COPY --from=build /app/apps/admin-ui/src/views /app/apps/admin-ui/src/views
WORKDIR /app/apps/admin-ui
EXPOSE 4000
CMD ["node", "dist/index.js"]
