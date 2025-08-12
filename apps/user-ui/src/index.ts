import { buildApp } from "./app";
import { config } from "./config";
import { prisma } from "./services/db";

const app = buildApp();
(async () => {
  await prisma.$queryRaw`SELECT 1`;
  app.listen(config.port, () => {
    console.log(`User UI listening on http://localhost:${config.port}`);
  });
})().catch(e=>{ console.error(e); process.exit(1); });
