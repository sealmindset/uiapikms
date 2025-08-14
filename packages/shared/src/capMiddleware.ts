import { PrismaClient } from "@prisma/client";
import { HEADER_API_KEY } from "./constants";
import { withinMonthlyCap } from "./usage";
import { Request, Response, NextFunction } from "express";

/**
 * Express middleware that enforces `monthlyCapTokens` for every authenticated
 * API key. Assumes the calling code has already verified that the incoming
 * x-api-key header is valid and retrieved the `ApiKey` row.
 *
 * Usage example:
 *   app.post("/v1/inference",
 *     authenticateKey(prisma),  // sets req.apiKey
 *     enforceTokenCap(prisma),  // blocks if over cap
 *     inferenceHandler);
 */
export function enforceTokenCap(prisma: PrismaClient) {
  return async function (req: Request, res: Response, next: NextFunction) {
    const apiKey = (req as any).apiKey as { id: string; monthlyCapTokens?: number } | undefined;
    if (!apiKey || apiKey.monthlyCapTokens == null) return next(); // nothing to enforce

    try {
      const ok = await withinMonthlyCap(prisma, apiKey.id, apiKey.monthlyCapTokens);
      if (!ok)
        return res.status(429).json({ error: "Monthly token cap reached" });
      next();
    } catch (e) {
      console.error("cap middleware error", e);
      return res.status(500).json({ error: "Usage check failed" });
    }
  };
}
