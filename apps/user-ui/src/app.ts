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
import csurf from "csurf";
import { prisma } from "./prisma";
import { getSecretClient } from "./services/keyVault";

export function buildApp() {
  const app = express();
  app.set("views", path.join(__dirname, "../src/views"));
  app.set("view engine", "ejs");

  // Use a non-permissive trust proxy setting for rate limiter safety.
  // In test, disable to avoid validation errors from express-rate-limit.
  if ((process.env.NODE_ENV || config.env) === "test") {
    app.set("trust proxy", false);
  } else {
    app.set("trust proxy", config.trustProxy ? 1 : false);
  }
  // Enable caching in dev/test by default; disable in production
  if (config.env === "production") {
    app.disable("etag");
  }
  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "data:"],
        fontSrc: ["'self'", "https:", "data:"],
        styleSrc: ["'self'", "https:", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        connectSrc: ["*"], // allow open XHR per project rule
        formAction: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'self'"]
      }
    },
    crossOriginEmbedderPolicy: false
  }));
  // Serve static assets (frontend JS/CSS) from src/public
  app.use(express.static(path.join(__dirname, "../src/public")));
  app.use(cors({ origin: [config.origins.user, config.origins.admin], credentials: true }));
  const isTest = (process.env.NODE_ENV || config.env) === "test";
  if (!isTest) {
    app.use(rateLimit({ windowMs: config.rateLimitWindowMs, max: config.rateLimitMax }));
  }

  // Route-specific POST-only rate limiters (skip entirely in tests)
  // reuse isTest
  const registerLimiter = rateLimit({
    windowMs: config.registrationRateWindowMs,
    max: config.registrationRateMax,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => isTest || req.method !== "POST",
  });
  const issueKeyLimiter = rateLimit({
    windowMs: config.keysIssueRateWindowMs,
    max: config.keysIssueRateMax,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => isTest || req.method !== "POST",
  });
  const PgSession = connectPgSimple(session);
  const useMemory = (process.env.NODE_ENV || config.env) === "test";
  const store = useMemory
    ? new session.MemoryStore()
    : new PgSession({ pool: new Pool({ connectionString: config.dbUrl }), tableName: "session", createTableIfMissing: true });
  app.use(session({
    store,
    secret: config.sessionSecret, resave: false, saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax", secure: config.env==="production" }
  }));
  // Use pino-http with its own logger to avoid type generics mismatch between pino and pino-http versions
  app.use(pinoHttp());
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(bodyParser.json());

  // Liveness
  app.get("/health/live", (_req, res) => res.json({ ok: true }));
  // Readiness
  app.get("/health/ready", async (req: any, res) => {
    try {
      if ((process.env.NODE_ENV || config.env) === "test") {
        return res.json({ ok: true, db: "skipped", session: "skipped", keyVault: "skipped" });
      }
      // DB check
      await prisma.$queryRawUnsafe("SELECT 1");
      // Session check
      if (!req.session) throw new Error("session missing");
      req.session.__health = Date.now();
      // Key Vault best-effort
      let kv = "skipped" as string;
      const hasKv = !!(process.env.AZURE_KEY_VAULT_URL || process.env.AZURE_KEY_VAULT_URI);
      if (hasKv) {
        try {
          getSecretClient();
          kv = "ok";
        } catch {
          kv = "error";
        }
      }
      return res.json({ ok: true, db: "ok", session: "ok", keyVault: kv });
    } catch (e) {
      logger.error(e);
      return res.status(503).json({ ok: false });
    }
  });

  // CSRF for registration flow (enabled outside test)
  if ((process.env.NODE_ENV || config.env) !== "test") {
    const csrfMw = csurf() as unknown as import("express").RequestHandler;
    app.use(["/register","/keys"], csrfMw);
    app.use(["/register","/keys"], (req: any, res: any, next: any) => {
      if (typeof req.csrfToken === "function") {
        res.locals.csrfToken = req.csrfToken();
      }
      next();
    });
  }

  // Mount targeted rate limiters before the routes (skip in test)
  if (!isTest) {
    app.use("/register", registerLimiter);
    app.use("/keys", issueKeyLimiter);
  }

  app.use(systemRouter);

  // Simple session verification endpoint
  app.get("/session-check", (req: any, res: any) => {
    if (!req.session) return res.status(500).json({ ok: false, error: "session missing" });
    req.session.count = (req.session.count || 0) + 1;
    res.json({ ok: true, count: req.session.count });
  });

  // CSRF error handler
  app.use((err:any,_req:any,res:any,_next:any)=>{
    if (err && err.code === 'EBADCSRFTOKEN') {
      return res.status(403).send('Invalid CSRF token');
    }
    logger.error(err);
    const isTest = (process.env.NODE_ENV || config.env) === "test";
    res.status(500).send(isTest && err && err.message ? String(err.message) : "Internal Server Error");
  });
  return app;
}
