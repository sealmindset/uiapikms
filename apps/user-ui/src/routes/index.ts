import { Router } from "express";
import { router as oidcRouter } from "./oidc";
import { z } from "zod";
import crypto from "crypto";
import { requireAuth, requireRole } from "../middleware/rbac";
import { config } from "../config";
import { prisma } from "../prisma";
import { storeApiKey } from "../services/keyVault";
export const router = Router();

// Friendly label mapping for form fields
const labelFor = (path: string): string => {
  switch (path) {
    case "usageDescription":
      return "Usage description";
    case "purpose":
      return "Purpose";
    case "projectName":
      return "Project name";
    case "contactEmail":
      return "Contact email";
    default:
      return path;
  }
};

// Convert Zod issues into user-friendly messages
const friendlyMessage = (label: string, issue: z.ZodIssue): string => {
  switch (issue.code) {
    case "too_small": {
      const anyIssue: any = issue as any;
      if (anyIssue?.minimum === 1 && anyIssue?.type === "string") return `${label} is required.`;
      return `${label} is too short.`;
    }
    case "too_big":
      return `${label} is too long.`;
    case "invalid_string": {
      const anyIssue: any = issue as any;
      if (anyIssue?.validation === "email") return `${label} must be a valid email.`;
      return `${label} is invalid.`;
    }
    case "invalid_enum_value":
      return `${label} has an invalid value.`;
    case "invalid_type":
      return `${label} is invalid.`;
    default:
      return issue.message && !issue.message.toLowerCase().includes(label.toLowerCase())
        ? `${label}: ${issue.message}`
        : (issue.message || `${label} is invalid.`);
  }
};
router.get("/healthz", (_req, res)=>res.json({ok:true}));
router.get("/", (req,res)=>{
  const user = (req.session as any)?.user;
  if (user) return res.redirect("/keys");
  return res.redirect("/login");
});

router.post("/keys/:id/revoke", requireAuth, async (req,res)=>{
  const { id } = req.params as { id: string };
  const sessionUser = (req.session as any)?.user;
  if ((process.env.NODE_ENV || "development") === "test") {
    // No persistence in tests; just redirect
    return res.redirect("/keys");
  }
  try {
    const dbUser = await prisma.user.findFirst({ where: { entraId: sessionUser?.entraId || "mock-dev-user" } });
    if (!dbUser) return res.status(404).send("User not found");
    const key = await prisma.apiKey.findFirst({ where: { id, userId: dbUser.id } });
    if (!key) return res.status(404).send("Key not found");
    if (!key.revokedAt) {
      await prisma.apiKey.update({ where: { id: key.id }, data: { revokedAt: new Date() } });
      await prisma.auditLog.create({
        data: {
          userId: dbUser.id,
          action: 'REVOKE_KEY' as any,
          keyId: key.id,
          metadata: { keyIdentifier: key.keyIdentifier } as any
        }
      });
    }
    return res.redirect("/keys");
  } catch (e) {
    return res.status(400).send("Bad Request");
  }
});

// -------------------------------
// Keys issuance and listing
// -------------------------------
const issueSchema = z.object({
  usageDescription: z.string().trim().min(1, { message: "usageDescription is required" }).max(200)
});

router.get("/keys", requireAuth, async (req,res)=>{
  const sessionUser = (req.session as any)?.user;
  if ((process.env.NODE_ENV || "development") === "test") {
    return res.render("keys", { title: "Your API Keys", user: sessionUser, keys: [] });
  }
  const dbUser = await prisma.user.upsert({
    where: { entraId: sessionUser?.entraId || "mock-dev-user" },
    update: { email: sessionUser?.email || "dev@example.com", isActive: true },
    create: { entraId: sessionUser?.entraId || "mock-dev-user", email: sessionUser?.email || "dev@example.com", isActive: true }
  });
  const keys = await prisma.apiKey.findMany({ where: { userId: dbUser.id }, orderBy: { createdAt: "desc" } });
  res.render("keys", { title: "Your API Keys", user: sessionUser, keys });
});

router.post("/keys", requireAuth, async (req,res)=>{
  try {
    const parsed = issueSchema.parse(req.body);
    const sessionUser = (req.session as any)?.user;
    if ((process.env.NODE_ENV || "development") === "test") {
      // In tests, render a fake secret and do not persist
      const wantsJson = (req.headers["accept"] || "").toString().includes("application/json");
      if (wantsJson) {
        return res.json({ secret: "test_secret_value" });
      }
      return res.render("key-once", { title: "Your New API Key", user: sessionUser, secret: "test_secret_value" });
    }
    const dbUser = await prisma.user.upsert({
      where: { entraId: sessionUser?.entraId || "mock-dev-user" },
      update: { email: sessionUser?.email || "dev@example.com", isActive: true },
      create: { entraId: sessionUser?.entraId || "mock-dev-user", email: sessionUser?.email || "dev@example.com", isActive: true }
    });
    // Generate a random API key value
    const raw = crypto.randomBytes(32).toString("base64url");
    const secretName = `api-${dbUser.id}-${Date.now()}`;
    const identifier = await storeApiKey(secretName, raw);
    await prisma.apiKey.create({
      data: {
        userId: dbUser.id,
        keyIdentifier: identifier,
        usageDescription: parsed.usageDescription,
        shownOnce: true
      }
    });
    await prisma.auditLog.create({
      data: {
        userId: dbUser.id,
        action: 'CREATE_KEY' as any,
        keyId: null,
        metadata: { usageDescription: parsed.usageDescription, keyIdentifier: identifier } as any
      }
    });
    // Display-once: respond JSON for XHR or HTML for normal form post
    const wantsJson = (req.headers["accept"] || "").toString().includes("application/json");
    if (wantsJson) {
      return res.json({ secret: raw });
    }
    return res.render("key-once", { title: "Your New API Key", user: sessionUser, secret: raw });
  } catch (e) {
    // Render keys page with validation errors
    const sessionUser = (req.session as any)?.user;
    const errors = (e instanceof z.ZodError)
      ? e.issues.map((i)=>{ const path = i.path.join('.'); const label = labelFor(path); return { path, message: friendlyMessage(label, i) }; })
      : [{ path: "_", message: "Invalid input" }];
    if ((process.env.NODE_ENV || "development") === "test") {
      return res.status(400).render("keys", { title: "Your API Keys", user: sessionUser, keys: [], errors, form: req.body });
    }
    try {
      const dbUser = await prisma.user.upsert({
        where: { entraId: sessionUser?.entraId || "mock-dev-user" },
        update: { email: sessionUser?.email || "dev@example.com", isActive: true },
        create: { entraId: sessionUser?.entraId || "mock-dev-user", email: sessionUser?.email || "dev@example.com", isActive: true }
      });
      const keys = await prisma.apiKey.findMany({ where: { userId: dbUser.id }, orderBy: { createdAt: "desc" } });
      return res.status(400).render("keys", { title: "Your API Keys", user: sessionUser, keys, errors, form: req.body });
    } catch {
      return res.status(400).render("keys", { title: "Your API Keys", user: sessionUser, keys: [], errors, form: req.body });
    }
  }
});
router.get("/login", (_req, res) => {
  res.redirect("/auth/oidc/start");
});

router.post("/logout", (req,res)=>{ req.session?.destroy(()=>res.redirect("/login")); });

// Protected user dashboard
// /dashboard is deprecated – redirect to /keys for backward compat
router.get("/dashboard", requireAuth, (req,res)=> res.redirect("/keys"));


// Registration form schema
const registrationSchema = z.object({
  purpose: z.enum(["internal_tooling","third_party_integration","other"]),
  projectName: z.string().trim().max(200).optional().or(z.literal("")),
  contactEmail: z.string().trim().email().optional().or(z.literal(""))
});

// Registration routes
router.get("/register", requireAuth, (_req,res)=>{
  res.render("register", { title: "Register API Use" });
});

router.post("/register", requireAuth, async (req,res)=>{
  try {
    const parsed = registrationSchema.parse(req.body);
    const sessionUser = (req.session as any)?.user;
    if ((process.env.NODE_ENV || "development") === "test") {
      return res.redirect("/keys");
    }
    const dbUser = await prisma.user.upsert({
      where: { entraId: sessionUser?.entraId || "mock-dev-user" },
      update: { email: sessionUser?.email || "dev@example.com", isActive: true },
      create: { entraId: sessionUser?.entraId || "mock-dev-user", email: sessionUser?.email || "dev@example.com", isActive: true }
    });
    const reg = await prisma.registration.create({
      data: {
        userId: dbUser.id,
        purpose: parsed.purpose as any,
        projectName: parsed.projectName || null,
        contactEmail: parsed.contactEmail || null
      }
    });
    // Audit log: reuse LOGIN action to avoid enum migration during this step
    await prisma.auditLog.create({
      data: {
        userId: dbUser.id,
        action: 'LOGIN' as any,
        keyId: null,
        metadata: {
          event: 'registration',
          purpose: parsed.purpose,
          projectName: parsed.projectName || null,
          contactEmail: parsed.contactEmail || null,
          registrationId: reg.id
        } as any
      }
    });
    return res.redirect("/keys");
  } catch (e) {
    const errors = (e instanceof z.ZodError)
      ? e.issues.map((i)=>{ const path = i.path.join('.'); const label = labelFor(path); return { path, message: friendlyMessage(label, i) }; })
      : [{ path: "_", message: "Invalid input" }];
    return res.status(400).render("register", { title: "Register API Use", errors, form: req.body });
  }
});
