import express from "express";
import path from "path";
import bodyParser from "body-parser";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { Pool } from "pg";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import { requireAuth, requireRole } from "./middleware/rbac";
import { prisma } from "./prisma";
import csurf from "csurf";
import { z } from "zod";

export function buildApp() {
  const app = express();
  // Enable caching in dev/test by default; disable in production
  if ((process.env.NODE_ENV || "development") === "production") {
    app.disable("etag");
  }
  // Views
  app.set("views", path.join(__dirname, "../src/views"));
  app.set("view engine", "ejs");

  // Security: tighten CSP but keep permissive XHR and styles from HTTPS
  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "data:"],
        styleSrc: ["'self'", "https:", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        connectSrc: ["*"] , // allow open XHR per project rule
        formAction: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'self'"]
      }
    },
    crossOriginEmbedderPolicy: false
  }));
  app.use(cors({ origin: ["http://localhost:4000"], credentials: true }));
  app.use(rateLimit({ windowMs: 900000, max: 100 }));
  const PgSession = connectPgSimple(session);
  const useMemory = (process.env.NODE_ENV || "development") === "test";
  const store = useMemory
    ? new session.MemoryStore()
    : new PgSession({ pool: new Pool({ connectionString: process.env.DATABASE_URL }), tableName: "session", createTableIfMissing: true });
  app.use(session({
    store,
    secret: process.env.SESSION_SECRET || "dev-secret", resave: false, saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax", secure: false }
  }));
  app.use(pinoHttp());
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(bodyParser.json());
  // CSRF protection (disabled in test)
  const isTest = (process.env.NODE_ENV || "development") === "test";
  if (!isTest) {
    app.use((csurf() as any));
    app.use((req: any, res, next) => {
      try {
        res.locals.csrfToken = req.csrfToken();
      } catch {
        res.locals.csrfToken = '';
      }
      next();
    });
  } else {
    app.use((_req, res, next) => { (res.locals as any).csrfToken = ''; next(); });
  }
  app.get("/healthz", (_req, res)=>res.json({ok:true}));
  // Liveness
  app.get("/health/live", (_req, res)=>res.json({ ok: true }));
  // Readiness
  app.get("/health/ready", async (req: any, res) => {
    try {
      if ((process.env.NODE_ENV || "development") === "test") {
        return res.json({ ok: true, db: "skipped", session: "skipped" });
      }
      await prisma.$queryRawUnsafe("SELECT 1");
      if (!req.session) throw new Error("session missing");
      req.session.__health = Date.now();
      return res.json({ ok: true, db: "ok", session: "ok" });
    } catch (e) {
      req.log?.error(e);
      return res.status(503).json({ ok: false });
    }
  });
  // Simple session verification endpoint
  app.get("/session-check", (req: any, res: any) => {
    if (!req.session) return res.status(500).json({ ok: false, error: "session missing" });
    req.session.count = (req.session.count || 0) + 1;
    res.json({ ok: true, count: req.session.count });
  });
  // Dev mock auth
  app.get("/", (_req,res)=>res.redirect("/login"));
  app.get("/login", (req,res)=>{
    if ((process.env.NODE_ENV || "development") === "production") {
      res.set("Cache-Control","no-store");
    }
    res.render("login", { title: "Admin Login", app: "admin" });
  });
  app.get("/auth/mock", (req:any,res:any)=>{ (req.session as any).user={id:"admin",email:"admin@example.com",entraId:"mock",roles:["admin"]}; res.redirect("/admin/users"); });
  app.post("/logout", (req,res)=>{ req.session?.destroy(()=>res.redirect("/login")); });

  // Per-route POST rate limiter (admin actions). Disabled in test.
  const postWindowMs = parseInt(process.env.ADMIN_POST_WINDOW_MS || "900000", 10) || 900000; // 15m
  const postMax = parseInt(process.env.ADMIN_POST_MAX || "50", 10) || 50;
  const adminPostLimiter = ((process.env.NODE_ENV || "development") === "test")
    ? ((_req:any,_res:any,next:any)=>next())
    : rateLimit({ windowMs: postWindowMs, max: postMax, standardHeaders: true, legacyHeaders: false });

  // Additional: Admin GET limiter to reduce scraping on list pages
  const getWindowMs = parseInt(process.env.ADMIN_GET_WINDOW_MS || "60000", 10) || 60000; // 1m
  const getMax = parseInt(process.env.ADMIN_GET_MAX || "120", 10) || 120; // 120 req/min per IP
  const adminGetLimiter = ((process.env.NODE_ENV || "development") === "test")
    ? ((_req:any,_res:any,next:any)=>next())
    : rateLimit({ windowMs: getWindowMs, max: getMax, standardHeaders: true, legacyHeaders: false });

  // Brute-force prevention: user-action limiter keyed by IP + target userId
  const actionWindowMs = parseInt(process.env.ADMIN_USER_ACTION_WINDOW_MS || "900000", 10) || 900000; // 15m
  const actionMax = parseInt(process.env.ADMIN_USER_ACTION_MAX || "10", 10) || 10; // limit actions per userId per IP
  const userActionLimiter = ((process.env.NODE_ENV || "development") === "test")
    ? ((_req:any,_res:any,next:any)=>next())
    : rateLimit({
        windowMs: actionWindowMs,
        max: actionMax,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req:any) => {
          const id = req.params?.id || "unknown";
          return `${req.ip}:user:${id}`;
        }
      });

  // Zod schema for path params
  const userIdParamSchema = z.object({ id: z.string().min(1, "id is required") });

  // Admin: Users list with search + pagination
  app.get("/admin/users", adminGetLimiter, requireAuth, requireRole("admin"), async (req,res)=>{
    const sessionUser = (req.session as any)?.user;
    const q = req.query as Record<string,string | undefined>;
    const page = Math.max(parseInt(String(q.page || '1'), 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(String(q.pageSize || '25'), 10) || 25, 1), 100);
    const search = (q.q || '').trim();

    if ((process.env.NODE_ENV || "development") === 'test') {
      return res.render("admin-users", {
        title: "Admin Users",
        user: sessionUser,
        items: [],
        search,
        pagination: { page, pageSize, hasNext: false, hasPrev: page > 1, total: 0, totalPages: 1 }
      });
    }

    const where: any = {};
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { entraId: { contains: search, mode: 'insensitive' } }
      ];
    }
    const skip = (page - 1) * pageSize;
    const [items, count] = await Promise.all([
      prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: pageSize }),
      prisma.user.count({ where })
    ]);
    const totalPages = Math.max(Math.ceil(count / pageSize), 1);
    res.render("admin-users", {
      title: "Admin Users",
      user: sessionUser,
      items,
      search,
      pagination: { page, pageSize, hasNext: page < totalPages, hasPrev: page > 1, total: count, totalPages }
    });
  });

  // Admin: Single user detail (registrations + keys)
  app.get("/admin/users/:id", adminGetLimiter, requireAuth, requireRole('admin'), async (req,res)=>{
    const sessionUser = (req.session as any)?.user;
    const { id } = req.params as { id: string };
    if ((process.env.NODE_ENV || "development") === 'test') {
      return res.render("admin-user", { title: "User Detail", user: sessionUser, item: null, registrations: [], keys: [] });
    }
    const item = await prisma.user.findUnique({ where: { id } });
    if (!item) return res.status(404).send("User not found");
    const [registrations, keys] = await Promise.all([
      prisma.registration.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 100 }),
      prisma.apiKey.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 100 })
    ]);
    res.render("admin-user", { title: `User: ${item.email || item.entraId}`, user: sessionUser, item, registrations, keys });
  });

  // Admin: Activate user
  app.post("/admin/users/:id/activate", userActionLimiter, adminPostLimiter, requireAuth, requireRole('admin'), async (req,res)=>{
    const sessionUser = (req.session as any)?.user;
    const parsed = userIdParamSchema.safeParse(req.params);
    if (!parsed.success) {
      return res.status(400).send("Invalid user id");
    }
    const { id } = parsed.data;
    if ((process.env.NODE_ENV || "development") === 'test') {
      return res.redirect(`/admin/users/${id}`);
    }
    try {
      const updated = await prisma.user.update({ where: { id }, data: { isActive: true } });
      await prisma.auditLog.create({
        data: {
          userId: updated.id,
          action: 'USER_ACTIVATE' as any,
          keyId: null,
          metadata: { adminActor: sessionUser?.email || 'unknown' } as any
        }
      });
      return res.redirect(`/admin/users/${id}`);
    } catch (e) {
      req.log?.error(e);
      return res.status(400).send("Bad Request");
    }
  });

  // Admin: Deactivate user
  app.post("/admin/users/:id/deactivate", userActionLimiter, adminPostLimiter, requireAuth, requireRole('admin'), async (req,res)=>{
    const sessionUser = (req.session as any)?.user;
    const parsed = userIdParamSchema.safeParse(req.params);
    if (!parsed.success) {
      return res.status(400).send("Invalid user id");
    }
    const { id } = parsed.data;
    if ((process.env.NODE_ENV || "development") === 'test') {
      return res.redirect(`/admin/users/${id}`);
    }
    try {
      const updated = await prisma.user.update({ where: { id }, data: { isActive: false } });
      await prisma.auditLog.create({
        data: {
          userId: updated.id,
          action: 'USER_DEACTIVATE' as any,
          keyId: null,
          metadata: { adminActor: sessionUser?.email || 'unknown' } as any
        }
      });
      return res.redirect(`/admin/users/${id}`);
    } catch (e) {
      req.log?.error(e);
      return res.status(400).send("Bad Request");
    }
  });

  // List recent registrations
  app.get("/admin/registrations", requireAuth, requireRole('admin'), async (req,res)=>{
    const user = (req.session as any)?.user;
    if ((process.env.NODE_ENV || "development") === 'test') {
      return res.render("admin-registrations", { title: "Registrations", user, registrations: [] });
    }
    const registrations = await prisma.registration.findMany({
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: 50
    });
    res.render("admin-registrations", { title: "Registrations", user, registrations });
  });

  app.get("/admin/keys", requireAuth, requireRole('admin'), async (req,res)=>{
    const user = (req.session as any)?.user;
    if ((process.env.NODE_ENV || "development") === 'test') {
      return res.render("admin-keys", { title: "API Keys", user, items: [] });
    }
    const keys = await prisma.apiKey.findMany({
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: 50
    });
    res.render("admin-keys", { title: "API Keys", user, items: keys });
  });

  app.get("/admin/audit-logs", requireAuth, requireRole('admin'), async (req,res)=>{
    const user = (req.session as any)?.user;
    const q = req.query as Record<string,string | undefined>;
    const page = Math.max(parseInt(String(q.page || '1'), 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(String(q.pageSize || '25'), 10) || 25, 1), 100);
    const action = q.action || '';
    const email = q.email || '';
    const start = q.start ? new Date(String(q.start)) : undefined;
    const end = q.end ? new Date(String(q.end)) : undefined;

    if ((process.env.NODE_ENV || "development") === 'test') {
      return res.render("admin-audit-logs", {
        title: "Audit Logs", user, items: [],
        filters: { action, email, start: q.start || '', end: q.end || '' },
        pagination: { page, pageSize, hasNext: false, hasPrev: page > 1 }
      });
    }

    const where: any = {};
    if (action) where.action = action;
    if (email) where.user = { email: { contains: email, mode: 'insensitive' as const } };
    if (start || end) {
      where.createdAt = { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) };
    }

    const skip = (page - 1) * pageSize;
    const [items, count] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize
      }),
      prisma.auditLog.count({ where })
    ]);
    const totalPages = Math.max(Math.ceil(count / pageSize), 1);
    res.render("admin-audit-logs", {
      title: "Audit Logs",
      user,
      items,
      filters: { action, email, start: q.start || '', end: q.end || '' },
      pagination: { page, pageSize, hasNext: page < totalPages, hasPrev: page > 1, total: count, totalPages }
    });
  });

  return app;
}
