bash -lc '
set -euo pipefail
ROOT="/Users/rvance/Documents/GitHub/uiapikms"
mkdir -p "$ROOT"/{apps/user-ui/src/{routes,services,middleware,views},apps/admin-ui/src/{routes,services,middleware,views},packages/shared/src,prisma/migrations/202508110001_init,apim-policies}
cd "$ROOT"

# .gitignore
cat > .gitignore << "EOF"
node_modules/
dist/
.env
coverage/
pnpm-lock.yaml
.prisma/
EOF

# .dockerignore
cat > .dockerignore << "EOF"
node_modules
dist
.git
.env
npm-debug.log
pnpm-lock.yaml
coverage
EOF

# pnpm workspace + root package.json + tsconfig
cat > pnpm-workspace.yaml << "EOF"
packages:
  - "apps/*"
  - "packages/*"
EOF

cat > package.json << "EOF"
{
  "name": "uiapikms",
  "private": true,
  "packageManager": "pnpm@9.6.0",
  "version": "1.0.0",
  "workspaces": ["apps/*","packages/*"],
  "scripts": {
    "build": "pnpm -r run build",
    "dev": "pnpm -r --parallel run dev",
    "start": "pnpm -r --parallel run start",
    "lint": "pnpm -r run lint",
    "format": "pnpm -r run format",
    "test": "pnpm -r run test",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:deploy": "prisma migrate deploy",
    "prisma:seed": "ts-node --transpile-only prisma/seed.ts"
  },
  "dependencies": {
    "@prisma/client": "^5.18.0"
  },
  "devDependencies": {
    "@types/csurf": "^1.11.5",
    "@types/ejs": "^3.1.5",
    "@types/express": "^4.17.21",
    "@types/express-session": "^1.17.8",
    "@types/jest": "^29.5.12",
    "@types/node": "^20.14.12",
    "@types/supertest": "^2.0.16",
    "dotenv": "^16.4.5",
    "eslint": "^9.9.0",
    "eslint-config-prettier": "^9.1.0",
    "eslint-plugin-import": "^2.29.1",
    "jest": "^29.7.0",
    "prettier": "^3.3.3",
    "prisma": "^5.18.0",
    "supertest": "^7.0.0",
    "ts-jest": "^29.2.5",
    "ts-node": "^10.9.2",
    "typescript": "^5.5.4"
  }
}
EOF

cat > tsconfig.base.json << "EOF"
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "outDir": "dist",
    "types": ["node", "jest"]
  }
}
EOF

# .env.example
cat > .env.example << "EOF"
NODE_ENV=development
PORT_USER=3020
PORT_ADMIN=4000
DATABASE_URL=postgresql://admin:admin@postgres:5432/apikeydb?schema=public
SESSION_SECRET=change_me_to_a_strong_secret
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
AZURE_TENANT_ID=
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=
OIDC_AUTHORITY=https://login.microsoftonline.com/\${AZURE_TENANT_ID}/v2.0
OIDC_REDIRECT_URI=http://localhost:3020/auth/callback
OIDC_LOGOUT_REDIRECT_URI=http://localhost:3020/login
ADMIN_GROUP_ID=
ADMIN_EMAILS=admin@example.com
AZURE_KEY_VAULT_URI=
USE_MANAGED_IDENTITY=false
APIM_VALIDATE_ENDPOINT_SECRET=change_me_shared_secret
USER_UI_ORIGIN=http://localhost:3020
ADMIN_UI_ORIGIN=http://localhost:4000
TRUST_PROXY=true
EOF

# docker-compose
cat > docker-compose.yml << "EOF"
version: "3.9"
services:
  postgres:
    image: postgres:14-alpine
    environment:
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: admin
      POSTGRES_DB: apikeydb
    ports: ["5432:5432"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U admin -d apikeydb"]
      interval: 5s
      timeout: 5s
      retries: 10
    volumes: [ "pgdata:/var/lib/postgresql/data" ]

  user-ui:
    build:
      context: ./apps/user-ui
      dockerfile: Dockerfile
    env_file: .env
    environment:
      NODE_ENV: ${NODE_ENV:-development}
      PORT: 3020
      DATABASE_URL: ${DATABASE_URL}
      SESSION_SECRET: ${SESSION_SECRET}
      RATE_LIMIT_WINDOW_MS: ${RATE_LIMIT_WINDOW_MS}
      RATE_LIMIT_MAX: ${RATE_LIMIT_MAX}
      AZURE_TENANT_ID: ${AZURE_TENANT_ID}
      AZURE_CLIENT_ID: ${AZURE_CLIENT_ID}
      AZURE_CLIENT_SECRET: ${AZURE_CLIENT_SECRET}
      OIDC_AUTHORITY: ${OIDC_AUTHORITY}
      OIDC_REDIRECT_URI: ${OIDC_REDIRECT_URI}
      OIDC_LOGOUT_REDIRECT_URI: ${OIDC_LOGOUT_REDIRECT_URI}
      ADMIN_GROUP_ID: ${ADMIN_GROUP_ID}
      ADMIN_EMAILS: ${ADMIN_EMAILS}
      AZURE_KEY_VAULT_URI: ${AZURE_KEY_VAULT_URI}
      USE_MANAGED_IDENTITY: ${USE_MANAGED_IDENTITY}
      APIM_VALIDATE_ENDPOINT_SECRET: ${APIM_VALIDATE_ENDPOINT_SECRET}
      USER_UI_ORIGIN: ${USER_UI_ORIGIN}
      ADMIN_UI_ORIGIN: ${ADMIN_UI_ORIGIN}
      TRUST_PROXY: ${TRUST_PROXY}
    ports: ["3020:3020"]
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3020/healthz"]
      interval: 10s
      timeout: 5s
      retries: 10

  admin-ui:
    build:
      context: ./apps/admin-ui
      dockerfile: Dockerfile
    env_file: .env
    environment:
      NODE_ENV: ${NODE_ENV:-development}
      PORT: 4000
      DATABASE_URL: ${DATABASE_URL}
      SESSION_SECRET: ${SESSION_SECRET}
      RATE_LIMIT_WINDOW_MS: ${RATE_LIMIT_WINDOW_MS}
      RATE_LIMIT_MAX: ${RATE_LIMIT_MAX}
      AZURE_TENANT_ID: ${AZURE_TENANT_ID}
      AZURE_CLIENT_ID: ${AZURE_CLIENT_ID}
      AZURE_CLIENT_SECRET: ${AZURE_CLIENT_SECRET}
      OIDC_AUTHORITY: ${OIDC_AUTHORITY}
      OIDC_REDIRECT_URI: http://localhost:4000/auth/callback
      OIDC_LOGOUT_REDIRECT_URI: http://localhost:4000/login
      ADMIN_GROUP_ID: ${ADMIN_GROUP_ID}
      ADMIN_EMAILS: ${ADMIN_EMAILS}
      USER_UI_ORIGIN: ${USER_UI_ORIGIN}
      ADMIN_UI_ORIGIN: ${ADMIN_UI_ORIGIN}
      TRUST_PROXY: ${TRUST_PROXY}
    ports: ["4000:4000"]
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4000/healthz"]
      interval: 10s
      timeout: 5s
      retries: 10

volumes:
  pgdata:
EOF

# Prisma schema + minimal seed
cat > prisma/schema.prisma << "EOF"
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

model User {
  id         String   @id @default(uuid())
  email      String
  entraId    String   @unique
  isActive   Boolean  @default(true)
  createdAt  DateTime @default(now())
  registrations Registration[]
  apiKeys    ApiKey[]
  auditLogs  AuditLog[]
}

model Registration {
  id           String   @id @default(uuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  purpose      Purpose
  projectName  String?
  contactEmail String?
  createdAt    DateTime @default(now())
}

model ApiKey {
  id               String   @id @default(uuid())
  userId           String
  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  keyIdentifier    String   @unique
  usageDescription String
  createdAt        DateTime @default(now())
  revokedAt        DateTime?
  shownOnce        Boolean  @default(false)
}

model AuditLog {
  id        String    @id @default(uuid())
  userId    String?
  user      User?     @relation(fields: [userId], references: [id])
  action    AuditAction
  keyId     String?
  metadata  Json?
  createdAt DateTime  @default(now())
}

enum Purpose { internal_tooling third_party_integration other }
enum AuditAction { CREATE_KEY REVOKE_KEY REVOKE_ALL RESET_USER LOGIN LOGOUT }
EOF

cat > prisma/migrations/202508110001_init/migration.sql << "EOF"
-- See schema.prisma; Prisma will generate SQL. Placeholder migration file.
EOF

cat > prisma/seed.ts << "EOF"
import { PrismaClient, AuditAction, Purpose } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map(e=>e.trim()).filter(Boolean);
  if (adminEmails.length) {
    const email = adminEmails[0];
    const entraId = \`seed-\${Date.now()}\`;
    await prisma.user.upsert({
      where: { entraId },
      update: {},
      create: { email, entraId,
        registrations: { create: { purpose: Purpose.internal_tooling, contactEmail: email } },
        auditLogs: { create: { action: AuditAction.LOGIN, metadata: { seed: true } } }
      }
    });
    console.log(\`Seeded example user with entraId=\${entraId}, email=\${email}\`);
  }
}
main().catch(e=>{console.error(e);process.exit(1)}).finally(async()=>{await prisma.$disconnect()});
EOF

# shared package
cat > packages/shared/package.json << "EOF"
{
  "name": "@uiapikms/shared",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "license": "MIT",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "lint": "eslint . --ext .ts",
    "format": "prettier -w .",
    "test": "echo \\"(no tests)\\""
  },
  "dependencies": { "zod": "^3.23.8" },
  "devDependencies": { "typescript": "^5.5.4" }
}
EOF

cat > packages/shared/tsconfig.json << "EOF"
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src", "composite": true },
  "include": ["src"]
}
EOF

cat > packages/shared/src/constants.ts << "EOF"
export const HEADER_API_KEY = "x-api-key";
export const HEADER_APIM_SHARED_SECRET = "x-apim-secret";
export const MAX_KEYS_PER_USER = 5;
export const CREATE_RATE_LIMIT_PER_HOUR = 3;
export const CSP_DEFAULT =
  "default-src 'self'; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; script-src 'self'; img-src 'self' data:; connect-src 'self'";
EOF

cat > packages/shared/src/types.ts << "EOF"
export type SessionUser = { id: string; email: string; entraId: string; roles: ("user"|"admin")[] };
EOF

cat > packages/shared/src/schemas.ts << "EOF"
import { z } from "zod";
export const RegistrationSchema = z.object({
  purpose: z.enum(["internal_tooling","third_party_integration","other"]),
  projectName: z.string().max(200).optional().or(z.literal("")),
  contactEmail: z.string().email().optional().or(z.literal(""))
});
export const CreateKeySchema = z.object({ usageDescription: z.string().min(3).max(200) });
export const RevokeKeyParamsSchema = z.object({ keyId: z.string().uuid() });
export const AcknowledgeSchema = z.object({ keyId: z.string().uuid(), acknowledged: z.literal("on") });
export const ValidatorBodySchema = z.object({ key: z.string().min(10) });
EOF

cat > packages/shared/src/security.ts << "EOF"
export function redactHeaders(headers: Record<string, any>) {
  const h = { ...headers };
  const redactList = ["authorization","x-api-key","cookie","x-apim-secret"];
  for (const k of Object.keys(h)) if (redactList.includes(k.toLowerCase())) h[k] = "***REDACTED***";
  return h;
}
EOF

# Minimal user-ui app (index/app + routes + Dockerfile + package.json + tsconfig)
cat > apps/user-ui/package.json << "EOF"
{
  "name": "user-ui",
  "version": "1.0.0",
  "main": "dist/index.js",
  "type": "commonjs",
  "license": "MIT",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "ts-node src/index.ts",
    "start": "node dist/index.js",
    "lint": "eslint . --ext .ts",
    "format": "prettier -w .",
    "test": "jest --runInBand"
  },
  "dependencies": {
    "@azure/identity": "^4.4.1",
    "@azure/keyvault-secrets": "^4.9.0",
    "@prisma/client": "^5.18.0",
    "@uiapikms/shared": "workspace:*",
    "csurf": "^1.11.0",
    "cors": "^2.8.5",
    "ejs": "^3.1.10",
    "express": "^5.0.0",
    "express-rate-limit": "^7.4.0",
    "express-session": "^1.17.3",
    "helmet": "^7.1.0",
    "openid-client": "^5.7.1",
    "pg": "^8.12.0",
    "connect-pg-simple": "^9.0.0",
    "pino": "^9.2.0",
    "pino-http": "^9.0.0",
    "uuid": "^9.0.1",
    "zod": "^3.23.8",
    "body-parser": "^1.20.2"
  },
  "devDependencies": {
    "@types/connect-pg-simple": "^7.0.5",
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/express-session": "^1.17.8",
    "@types/jest": "^29.5.12",
    "@types/node": "^20.14.12",
    "@types/supertest": "^2.0.16",
    "jest": "^29.7.0",
    "supertest": "^7.0.0",
    "ts-jest": "^29.2.5",
    "ts-node": "^10.9.2",
    "typescript": "^5.5.4"
  }
}
EOF

cat > apps/user-ui/tsconfig.json << "EOF"
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src", "../../packages/shared/src/**/*.ts"]
}
EOF

cat > apps/user-ui/Dockerfile << "EOF"
FROM node:20-alpine AS deps
WORKDIR /app
COPY ../../package.json ../../pnpm-workspace.yaml ./
COPY ../../packages ./packages
COPY package.json tsconfig.json ./
RUN corepack enable && corepack prepare pnpm@9.6.0 --activate
RUN pnpm install --frozen-lockfile

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app /app
COPY ../../tsconfig.base.json ./
COPY ../../prisma ./prisma
RUN pnpm prisma:generate
RUN pnpm --filter @uiapikms/shared build
COPY src ./src
RUN pnpm --filter user-ui build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/user-ui/dist ./dist
COPY --from=build /app/apps/user-ui/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/user-ui/src/views ./src/views
EXPOSE 3020
CMD ["node", "dist/index.js"]
EOF

cat > apps/user-ui/src/config.ts << "EOF"
import "dotenv/config";
export const config = {
  env: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "3020", 10),
  dbUrl: process.env.DATABASE_URL!,
  sessionSecret: process.env.SESSION_SECRET || "dev-secret",
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10),
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || "100", 10),
  origins: {
    user: process.env.USER_UI_ORIGIN || "http://localhost:3020",
    admin: process.env.ADMIN_UI_ORIGIN || "http://localhost:4000"
  },
  trustProxy: (process.env.TRUST_PROXY || "true").toLowerCase() === "true",
  apimSharedSecret: process.env.APIM_VALIDATE_ENDPOINT_SECRET || "",
  kv: { uri: process.env.AZURE_KEY_VAULT_URI || "", useManagedIdentity: (process.env.USE_MANAGED_IDENTITY || "false").toLowerCase() === "true" }
};
EOF

cat > apps/user-ui/src/logger.ts << "EOF"
import pino from "pino";
export const logger = pino({ level: process.env.LOG_LEVEL || "info" });
EOF

cat > apps/user-ui/src/services/db.ts << "EOF"
import { PrismaClient } from "@prisma/client";
export const prisma = new PrismaClient();
EOF

cat > apps/user-ui/src/routes/index.ts << "EOF"
import { Router } from "express";
export const router = Router();
router.get("/healthz", (_req, res)=>res.json({ok:true}));
router.get("/", (_req,res)=>res.redirect("/login"));
router.get("/login", (_req,res)=>res.send("<html><body><a href='/auth/mock'>Dev Mock Login</a></body></html>"));
router.get("/auth/mock", (req,res)=>{ (req.session as any).user={id:"dev",email:"dev@example.com",entraId:"mock",roles:["user","admin"]}; res.redirect("/"); });
EOF

cat > apps/user-ui/src/app.ts << "EOF"
import express from "express";
import path from "path";
import bodyParser from "body-parser";
import pinoHttp from "pino-http";
import session from "express-session";
import { Pool } from "pg";
import connectPgSimple from "connect-pg-simple";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { router as systemRouter } from "./routes/index";
import { config } from "./config";
import { logger } from "./logger";

export function buildApp() {
  const app = express();
  app.set("views", path.join(__dirname, "views"));
  app.set("view engine", "ejs");

  app.set("trust proxy", config.trustProxy);
  app.use(helmet());
  app.use(cors({ origin: [config.origins.user, config.origins.admin], credentials: true }));
  app.use(rateLimit({ windowMs: config.rateLimitWindowMs, max: config.rateLimitMax }));
  const PgSession = connectPgSimple(session);
  const pool = new Pool({ connectionString: config.dbUrl });
  app.use(session({
    store: new PgSession({ pool, tableName: "session", createTableIfMissing: true }),
    secret: config.sessionSecret, resave: false, saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax", secure: config.env==="production" }
  }));
  app.use(pinoHttp({ logger }));
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(bodyParser.json());

  app.use(systemRouter);

  app.use((err:any,_req:any,res:any,_next:any)=>{ logger.error(err); res.status(500).send("Internal Server Error"); });
  return app;
}
EOF

cat > apps/user-ui/src/index.ts << "EOF"
import { buildApp } from "./app";
import { config } from "./config";
import { prisma } from "./services/db";

const app = buildApp();
(async () => {
  await prisma.$queryRaw`SELECT 1`;
  app.listen(config.port, ()=> console.log(\`User UI listening on http://localhost:\${config.port}\`));
})().catch(e=>{ console.error(e); process.exit(1); });
EOF

# Minimal admin-ui app
cat > apps/admin-ui/package.json << "EOF"
{
  "name": "admin-ui",
  "version": "1.0.0",
  "main": "dist/index.js",
  "type": "commonjs",
  "license": "MIT",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "ts-node src/index.ts",
    "start": "node dist/index.js",
    "lint": "eslint . --ext .ts",
    "format": "prettier -w .",
    "test": "jest --runInBand"
  },
  "dependencies": {
    "@prisma/client": "^5.18.0",
    "@uiapikms/shared": "workspace:*",
    "cors": "^2.8.5",
    "ejs": "^3.1.10",
    "express": "^5.0.0",
    "express-rate-limit": "^7.4.0",
    "express-session": "^1.17.3",
    "helmet": "^7.1.0",
    "pg": "^8.12.0",
    "connect-pg-simple": "^9.0.0",
    "pino": "^9.2.0",
    "pino-http": "^9.0.0",
    "body-parser": "^1.20.2"
  },
  "devDependencies": {
    "@types/connect-pg-simple": "^7.0.5",
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/express-session": "^1.17.8",
    "@types/jest": "^29.5.12",
    "@types/node": "^20.14.12",
    "@types/supertest": "^2.0.16",
    "jest": "^29.7.0",
    "supertest": "^7.0.0",
    "ts-jest": "^29.2.5",
    "ts-node": "^10.9.2",
    "typescript": "^5.5.4"
  }
}
EOF

cat > apps/admin-ui/tsconfig.json << "EOF"
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src", "../../packages/shared/src/**/*.ts"]
}
EOF

cat > apps/admin-ui/Dockerfile << "EOF"
FROM node:20-alpine AS deps
WORKDIR /app
COPY ../../package.json ../../pnpm-workspace.yaml ./
COPY ../../packages ./packages
COPY package.json tsconfig.json ./
RUN corepack enable && corepack prepare pnpm@9.6.0 --activate
RUN pnpm install --frozen-lockfile

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app /app
COPY ../../tsconfig.base.json ./
COPY ../../prisma ./prisma
RUN pnpm prisma:generate
RUN pnpm --filter @uiapikms/shared build
COPY src ./src
RUN pnpm --filter admin-ui build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/admin-ui/dist ./dist
COPY --from=build /app/apps/admin-ui/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
EXPOSE 4000
CMD ["node", "dist/index.js"]
EOF

cat > apps/admin-ui/src/app.ts << "EOF"
import express from "express";
import bodyParser from "body-parser";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { Pool } from "pg";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";

export function buildApp() {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: ["http://localhost:4000"], credentials: true }));
  app.use(rateLimit({ windowMs: 900000, max: 100 }));
  const PgSession = connectPgSimple(session);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  app.use(session({
    store: new PgSession({ pool, tableName: "session", createTableIfMissing: true }),
    secret: process.env.SESSION_SECRET || "dev-secret", resave: false, saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax", secure: false }
  }));
  app.use(pinoHttp());
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(bodyParser.json());
  app.get("/healthz", (_req, res)=>res.json({ok:true}));
  app.get("/admin/users", (_req,res)=>res.send("<html><body><h1>Admin Users (stub)</h1></body></html>"));
  return app;
}
EOF

cat > apps/admin-ui/src/index.ts << "EOF"
import { buildApp } from "./app";
const app = buildApp();
const port = parseInt(process.env.PORT || "4000", 10);
app.listen(port, ()=> console.log(\`Admin UI listening on http://localhost:\${port}\`));
EOF

echo "Scaffold created."
'