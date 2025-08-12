"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidatorBodySchema = exports.AcknowledgeSchema = exports.RevokeKeyParamsSchema = exports.CreateKeySchema = exports.RegistrationSchema = void 0;
const zod_1 = require("zod");
exports.RegistrationSchema = zod_1.z.object({
    purpose: zod_1.z.enum(["internal_tooling", "third_party_integration", "other"]),
    projectName: zod_1.z.string().max(200).optional().or(zod_1.z.literal("")),
    contactEmail: zod_1.z.string().email().optional().or(zod_1.z.literal(""))
});
exports.CreateKeySchema = zod_1.z.object({ usageDescription: zod_1.z.string().min(3).max(200) });
exports.RevokeKeyParamsSchema = zod_1.z.object({ keyId: zod_1.z.string().uuid() });
exports.AcknowledgeSchema = zod_1.z.object({ keyId: zod_1.z.string().uuid(), acknowledged: zod_1.z.literal("on") });
exports.ValidatorBodySchema = zod_1.z.object({ key: zod_1.z.string().min(10) });
//# sourceMappingURL=schemas.js.map