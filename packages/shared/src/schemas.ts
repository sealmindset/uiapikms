import { z } from "zod";
export const RegistrationSchema = z.object({
  purpose: z.enum(["internal_tooling","third_party_integration","other"]),
  projectName: z.string().max(200).optional().or(z.literal("")),
  contactEmail: z.string().email().optional().or(z.literal(""))
});
export const CreateKeySchema = z.object({ usageDescription: z.string().min(3).max(200) });
export const RevokeKeyParamsSchema = z.object({ keyId: z.string().uuid() });
export const AcknowledgeSchema = z.object({ keyId: z.string().uuid(), acknowledged: z.literal("on") });
export const ValidatorBodySchema = z.object({ key: z.string().min(10) });
