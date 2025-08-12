import "dotenv/config";
export const config = {
  env: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "3020", 10),
  dbUrl: process.env.DATABASE_URL!,
  sessionSecret: process.env.SESSION_SECRET || "dev-secret",
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10),
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || "100", 10),
  // Route-specific POST limiters
  registrationRateWindowMs: parseInt(process.env.REGISTRATION_RATE_WINDOW_MS || "600000", 10), // 10m
  registrationRateMax: parseInt(process.env.REGISTRATION_RATE_MAX || "5", 10),
  keysIssueRateWindowMs: parseInt(process.env.KEYS_ISSUE_RATE_WINDOW_MS || "600000", 10), // 10m
  keysIssueRateMax: parseInt(process.env.KEYS_ISSUE_RATE_MAX || "3", 10),
  origins: {
    user: process.env.USER_UI_ORIGIN || "http://localhost:3020",
    admin: process.env.ADMIN_UI_ORIGIN || "http://localhost:4000"
  },
  trustProxy: (process.env.TRUST_PROXY || "true").toLowerCase() === "true",
  apimSharedSecret: process.env.APIM_VALIDATE_ENDPOINT_SECRET || "",
  kv: { uri: process.env.AZURE_KEY_VAULT_URI || "", useManagedIdentity: (process.env.USE_MANAGED_IDENTITY || "false").toLowerCase() === "true" }
};
