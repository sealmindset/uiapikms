# Container Security Guardrails

This document summarizes the defense-in-depth controls applied to the **uiapikms** Docker images / Compose stack and explains the purpose of each.

## 1. Minimal & Verified Base Images
* **`node:20-alpine`** – Alpine is ~10 MB, greatly reducing attack surface vs. Debian images.
* Images are pulled from the official Docker Hub library (content-trust validated via SHA at build time by CI).

## 2. Non-Production Build Stages
* Multi-stage Dockerfiles compile at build-time and copy only `dist/` JS, views and production `node_modules` into the final image.
* Dev tooling, docs and source TS are left behind in earlier stages so they are **not shipped to prod**.

## 3. Read-Only File System (optional production flag)
* Containers run fine with `readOnlyRootFilesystem: true` in Kubernetes or Docker `--read-only`.  The local Compose keeps RW for hot-reload convenience.

## 4. Network Exposure
| Service   | Internal Port | Published Port | Notes |
|-----------|---------------|----------------|-------|
| `postgres`| 5432          | 5432           | Exposed for local dev only; cloud deploy omits `ports:`.|
| `user-ui` | 3020          | 3020           | CORS restricted to `USER_UI_ORIGIN` / `ADMIN_UI_ORIGIN`.|
| `admin-ui`| 4000          | 4000           | Same CORS policy |

Only HTTPS/LB traffic should be allowed in prod.

## 5. Runtime Security Middleware
* **Helmet** – standard HTTP security headers (CSP, X-Frame-Options, HSTS, Referrer-Policy, etc.).
* **CORS** – Origins are **explicitly whitelisted** by env vars; credentials=true only for these.
* **express-rate-limit** – Global and per-route limits mitigate brute-force & DoS.
* **CSRF (user-ui only)** – `csurf` tokens on all state-changing forms.
* **Session cookies** – `httpOnly`, `sameSite=lax`, `secure` in production.
* **Prisma parameterised queries** – prevents SQL injection.

## 6. Secrets Management
* No plaintext keys are embedded in images.
* Environment variables are provided at runtime via **`.env` (git-ignored)** or orchestration secrets.
* Actual API secrets are stored in **Azure Key Vault** and retrieved by the app with managed identity / client credentials.

## 7. Build-time Filtering
* `.dockerignore` removes `.git`, `tests`, `node_modules`, `.env`, and other sensitive/dev files from the build context, shrinking the attack surface.

## 8. Health Checks & Least-Privilege Networking
* Each container defines a **healthcheck** hitting `/healthz`; orchestrators can restart unhealthy pods.
* Internal communication uses Docker default bridge; cloud deploys should place services in **private networks / subnet**.

---
## 9. Prisma Data Layer

Prisma is the single data-access layer for both `user-ui` and `admin-ui` services. Usage summary:

| Concern | Details |
| --- | --- |
| **Schema as code** | `prisma/schema.prisma` defines `User`, `ApiKey`, `Registration`, and `AuditLog` models. Changes are tracked in Git. |
| **Migrations** | During CI/CD the image runs `pnpm prisma:generate` (codegen) and, in staging/prod, `pnpm prisma:deploy` to apply SQL migrations safely. |
| **Typed ORM** | Services import a singleton `PrismaClient` (see `apps/*/src/prisma.ts`). All CRUD uses methods like `prisma.user.findUnique`, giving compile-time type safety and automatic parameterisation. |
| **Transactions** | Critical flows—issue/revoke API key plus audit trail—use `prisma.$transaction([...])` ensuring atomicity. |
| **Raw queries** | Limited to health-checks (`SELECT 1`) and analytics; always invoked with `$queryRaw` placeholders to stay parameterised. |
| **Connection pooling** | Prisma connects once per pod; connection string comes from `DATABASE_URL`. PG Bouncer is recommended for high concurrency. |
| **Engine binaries** | Prisma engines are installed at build time; the Dockerfile retains only the required binaries, keeping image size ~65 MB. |
| **Security** | No SQL is ever interpolated by string; Prisma escapes all inputs. Role-based access is applied in application logic, not the database. |

Prisma therefore covers schema management, migrations, and safe, typed data access—parameterised queries are just one facet of its role.

## 9. Dependency & Image Scanning
* CI pipeline runs `npm audit` / `pnpm audit` and Docker image scanning (Trivy) (to be configured).

## 10. Purpose of Guardrails
These controls collectively:
1. Reduce the chance of remote code execution by stripping unnecessary packages and restricting headers.
2. Limit impact of credential leaks via Key Vault & .env hygiene.
3. Slow automated attacks with rate-limiting and CSRF.
4. Provide visibility & auto-healing with health checks.
5. Enable safe roll-outs by separating build and runtime stages.

---
_This document is living; update when new security measures are introduced._
