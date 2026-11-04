const diagnosticTextFields = new Set([
  "statusString", "subStatusCode", "errorCode", "errorMsg", "responseStatusStrg",
]);

/** Pure logging projection. Keep only bounded, explicitly named diagnostic text,
 * numeric/boolean values and object shape; all other text remains masked.
 * Never use this projection as a device request or a parsed device response. */
export function redactGatewayLog(value: unknown): unknown {
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) return value.map(redactGatewayLog);
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key,
      /key|pass|secret|token|authorization|cookie|finger|url|uri/i.test(key) ? "***"
        : diagnosticTextFields.has(key) && typeof item === "string" ? item.slice(0, 100)
        : redactGatewayLog(item),
    ]));
  }
  return "***";
}

/** Routes are diagnostic; query strings and fragments can contain credentials. */
export function gatewayLogPath(path: string): string {
  return path.split(/[?#]/, 1)[0] + (/[?#]/.test(path) ? "?***" : "");
}
