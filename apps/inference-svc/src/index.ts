import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import { enforceTokenCap } from "../../../packages/shared/src/capMiddleware";
import { recordUsage } from "../../../packages/shared/src/usage";
import { HEADER_API_KEY } from "../../../packages/shared/src/constants";

const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());

// Simple API-key authentication middleware
app.use(async (req: Request, res: Response, next: NextFunction) => {
  const key = req.header(HEADER_API_KEY);
  if (!key) return res.status(401).json({ error: "Missing API key" });
  try {
    const apiKey = await prisma.apiKey.findFirst({
      where: {
        keyIdentifier: key,
        revokedAt: null,
      },
    });
    if (!apiKey) return res.status(401).json({ error: "Invalid API key" });
    (req as any).apiKey = apiKey;
    next();
  } catch (e) {
    console.error("auth error", e);
    res.status(500).json({ error: "Auth failed" });
  }
});

// Enforce per-key monthly spend cap
app.use(enforceTokenCap(prisma));

// Example inference endpoint (echo)
app.post("/v1/echo", async (req: Request, res: Response) => {
  const { prompt, tokensUsed } = req.body as { prompt: string; tokensUsed?: number };
  if (!prompt) return res.status(400).json({ error: "prompt required" });
  const tokens = tokensUsed ?? prompt.split(/\s+/).length; // naive token count
  const apiKey = (req as any).apiKey as { id: string };
  await recordUsage(prisma, apiKey.id, "echo", tokens);
  return res.json({ completion: prompt });
});

const port = parseInt(process.env.PORT || "4000", 10);
app.listen(port, () => {
  console.log(`inference-svc listening on :${port}`);
});
