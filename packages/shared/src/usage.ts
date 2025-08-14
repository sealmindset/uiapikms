import { PrismaClient } from "@prisma/client";

/**
 * Return true when total tokens consumed by `apiKeyId` during the current
 * calendar month are strictly below the provided `cap`.
 */
export async function withinMonthlyCap(
  prisma: PrismaClient,
  apiKeyId: string,
  cap: number
): Promise<boolean> {
  // first day of current UTC month
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);

  const { _sum } = await prisma.usage.aggregate({
    where: {
      apiKeyId,
      createdAt: {
        gte: start,
      },
    },
    _sum: {
      tokens: true,
    },
  });

  const used = _sum.tokens ?? 0;
  return used < cap;
}

/**
 * Record that `tokens` were consumed by API key `apiKeyId` for model `model`.
 *
 * This writes a row per request. If you expect very high volume you can batch
 * externally, but Postgres handles ~10k inserts/s which is adequate for most
 * use-cases.
 */
export async function recordUsage(
  prisma: PrismaClient,
  apiKeyId: string,
  model: string,
  tokens: number
): Promise<void> {
  await prisma.usage.create({
    data: {
      apiKeyId,
      model,
      tokens,
    },
  });
}
