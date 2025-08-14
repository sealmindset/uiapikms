# AIaaSvc ↔ uiaiaks Integration Overview

This document explains **how the two sister Terraform stacks**—`AIaaSvc` and `uiaiaks`—work together to expose Azure OpenAI functionality to end-users through a secure, private, and scalable Kubernetes front-end.

---
## 1. High-level Components

```mermaid
flowchart LR
  subgraph User Subscription & Traffic
    U[User / Client App]
    U -->|HTTPS| APIM
  end

  subgraph AIaaSvc (API Layer)
    APIM[Azure API Management\n(dev SKU / private)]
    APIM -->|Managed Identity| OpenAI[(Azure OpenAI\nprivate endpoint)]
  end

  subgraph uiaiaks (Execution Plane)
    AKS[(AKS Cluster)]
    AKS -->|Helm charts| UIPods[Docker containers \n(React, Flask, etc.)]
  end

  APIM <-->|Private Link| AKS
```

* **AIaaSvc** – Builds the *API façade* (Azure API Management) and its private networking so that only traffic originating inside the spoke VNet is accepted.
* **uiapikms** – Provisions the *subscription portal*: an AKS-hosted UI (user + admin views) that lets Entra ID users self-register and obtain an APIM subscription key. Admins can list/rotate/revoke keys.

---
## 2. Networking & Security Coupling

| Aspect | AIaaSvc output | Consumed by uiaiaks |
| --- | --- | --- |
| **Spoke VNet & subnets** | `azurerm_virtual_network.vnet_ai` with subnets for APIM + private link | Peered in `modules/network` so AKS, ingress and PGSQL sit in the same address space |
| **Private Endpoint for APIM** | `azurerm_private_endpoint.apim` | AKS ingress controller resolves `apim.<dns_zone>` to the PE’s private IP via custom DNS zone |
| **Managed Identity** | `azurerm_api_management.apim.identity.principal_id` | Granted `User Access Administrator` on AKS namespace so APIM can call internal services if needed |
| **Tags & naming prefix** | `var.name_prefix` | Re-used as `local.name_prefix` in uiaiaks for visual parity across all RGs |

Security baseline:
1. **No public endpoints**—All traffic enters via APIM’s private link; AKS ingress is internal-only unless `ui_public_test=true`.
2. **Least privilege**—APIM uses MSI to call OpenAI; AKS workloads have no direct OpenAI keys.
3. **End-to-end TLS** enforced by cert-manager + NGINX Ingress inside AKS.

---
## 3. Docker Image Lifecycle

1. **Build & Push** – A GitHub Action (or `scripts/build-push.sh`) inside `uiaiaks` builds images from `./ui` and pushes to ACR.
2. **Helm Deploy** – The `modules/aks` sub-module deploys a Helm release which:
   - Pulls the tagged Docker images from ACR.
   - Exposes them via an internal load-balancer + Ingress.
3. **API Consumption** – UI pods call `https://apim.<dns_zone>/openai/...` which routes through AIaaSvc APIM to Azure OpenAI.

Because APIM sits in the same VNet, latency is <2 ms and no data leaves the virtual network boundary.

---
## 4. Terraform Workflow

```bash
# Step 1 – Deploy the API layer
cd AIaaSvc
terraform init && terraform apply -var-file=prod.tfvars

# Step 2 – Deploy the AKS & UI layer
cd ../uiaiaks
terraform init && terraform apply -var-file=prod.tfvars \
  -var "apim_private_ips=[\"<APIM-PE-IP>\"]" \
  -var "org_cidr=<your_org_cidr>"
```

The second stack expects outputs from the first (e.g., *private IP of APIM*, *name prefix*). You can pass them via `terraform_remote_state` or CI/CD variables.

---
## 5. End-user Flow

1. **Self-service signup** – A user signs into the `uiapikms` portal with their Entra ID account.
2. **API-key provisioning** – The portal (via its backend) calls the APIM management API to create or re-enable a subscription under the `openai-product` product and surfaces the key.
3. **Key storage / rotation** – The key is displayed once and stored only in APIM. Admin UI can rotate or revoke subscriptions.
4. **Inference calls** – The user’s application adds `Ocp-Apim-Subscription-Key: <key>` to requests like `POST https://apim.<dns_zone>/openai/deployments/<model>/completions?...`.
5. **APIM policy execution** – APIM authenticates to Azure OpenAI via its managed identity and returns the model response to the client.

---
## 6. Failure Domains & Scaling

| Layer | How to scale | Independent destroy? |
| --- | --- | --- |
| *API (APIM)* | Upgrade SKU or add units | Yes – deleting AIaaSvc does **not** affect AKS apps |
| *Compute (AKS)* | Node-pool autoscale, HPA | Yes – uiaiaks can be torn down without touching APIM |
| *OpenAI* | Deployment throughput limits | External resource; reference-only in AIaaSvc |

---
## 7. Next Steps / Enhancements

* Add `terraform_remote_state` data sources so uiaiaks pulls APIM private IP & DNS automatically.
* Introduce GitHub Actions matrix to build multi-arch images for AKS.
* Consider Azure Front Door with WAF if `ui_public_test` is enabled for production.
* Enable CMK/CMEK for Key Vault, Storage, and PostgreSQL once organizational policies allow.

---
## 8. Entra ID Integration

The uiapikms portal is built to use Azure Entra ID (formerly Azure AD) single-sign-on, so MFA enforced through Microsoft Authenticator works out of the box.

### Key points

#### Authentication flow
UI redirects unauthenticated users to the Entra ID authorization endpoint (OpenID Connect).
Entra ID enforces any conditional-access rules—including Microsoft Authenticator MFA—before issuing the ID/Access tokens.

The portal receives the tokens and starts a session; no passwords are handled by the app.

#### SSO experience
– Users already signed in to Microsoft 365 (with MFA) are silently logged in to the portal.
– Logout simply clears the session; identities remain governed by Entra ID.

#### API-key provisioning security
– The backend obtains a bearer token (on-behalf-of flow) to call the APIM management API, so only authenticated Entra ID principals can create or manage subscriptions.
– When an account is disabled in Entra ID, the portal’s admin job detects it (graph query) and automatically revokes the user’s APIM subscription key.

#### If the company’s conditional-access policies change (e.g., phishing-resistant MFA, device compliance), the portal inherits them without code changes because all auth is delegated to Entra ID.

---
### 9. Production Admin UI environment variables

| Variable | Description |
| --- | --- |
| `OIDC_AUTHORITY` | `https://login.microsoftonline.com/<tenantId>/v2.0` |
| `OIDC_CLIENT_ID` | App registration ID of `uiapikms-admin-prod` |
| `OIDC_REDIRECT_URI` | Public HTTPS callback, e.g. `https://admin.portal.company.com/auth/oidc/callback` |
| `NODE_ENV` | `production` to enable privileged enforcement |
| `SESSION_SECRET` | Strong random string for cookie sessions |
| `DATABASE_URL` | Postgres connection string |

Add these to your secret store / deployment pipeline only for the prod environment. Dev/test continue to use mock login and do **not** require these vars.

---
### 10. Data Persistence (Postgres + Prisma)

Both **`user-ui`** and **`admin-ui`** depend on a shared Postgres instance provisioned by the `uiapikms` Terraform stack (Azure Database for PostgreSQL Flexible Server with private endpoint). Prisma acts as the type-safe ORM and migration engine.

| Table / Model | Purpose |
| --- | --- |
| `User` | Maps Entra ID object (`oid`) to local profile; tracks active / inactive state. |
| `ApiKey` | Stores subscription key value (hashed), creation & rotation timestamps, expiry. |
| `Registration` | One-time self-service registration records pending verification. |
| `AuditLog` | Immutable log of every key creation, rotation, revocation, and admin action. |

Key points:

1. **Schema & migrations** – `prisma/schema.prisma` defines models; `prisma migrate` applies versioned SQL during CI/CD.
2. **Typed CRUD** – All data access uses `PrismaClient` methods (`findMany`, `create`, etc.) ensuring parameterisation.
3. **Atomic operations** – Complex flows run inside `prisma.$transaction` to keep user/key/audit changes consistent.
4. **No DB → no keys** – If Postgres is unavailable the UIs can render static pages, but sign-up, key issuance, and admin workflows are disabled.
5. **Connection** – `DATABASE_URL` injected via environment/Key Vault; connections stay inside the AKS VNet.

> _Operational note_: For high concurrency enable PG Bouncer or Azure Flexible Server connection pooling and adjust Prisma `connection_limit`.

> _This overview complements the detailed READMEs in each repository and should be the starting point for new engineers onboarding to the AI platform._
