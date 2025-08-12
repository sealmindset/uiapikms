"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redactHeaders = redactHeaders;
function redactHeaders(headers) {
    const h = { ...headers };
    const redactList = ["authorization", "x-api-key", "cookie", "x-apim-secret"];
    for (const k of Object.keys(h))
        if (redactList.includes(k.toLowerCase()))
            h[k] = "***REDACTED***";
    return h;
}
//# sourceMappingURL=security.js.map