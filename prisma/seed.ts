import { PrismaClient, AuditAction, Purpose } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map(e=>e.trim()).filter(Boolean);
  if (adminEmails.length) {
    const email = adminEmails[0];
    const entraId = \`seed-\${Date.now()}\`;
    await prisma.user.upsert({
      where: { entraId },
      update: {},
      create: { email, entraId,
        registrations: { create: { purpose: Purpose.internal_tooling, contactEmail: email } },
        auditLogs: { create: { action: AuditAction.LOGIN, metadata: { seed: true } } }
      }
    });
    console.log(\`Seeded example user with entraId=\${entraId}, email=\${email}\`);
  }
}
main().catch(e=>{console.error(e);process.exit(1)}).finally(async()=>{await prisma.$disconnect()});
