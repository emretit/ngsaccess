/** Broker ACL, provisioner and bridge share this numeric panel identity contract. */
export function panelUuid(value) {
  const uuid = typeof value === "number" && Number.isSafeInteger(value) ? String(value) : value;
  if (typeof uuid !== "string" || !/^[1-9]\d{0,14}$(?![\s\S])/.test(uuid)) {
    throw new Error("Invalid numeric panel UUID");
  }
  return uuid;
}

export const eventKinds = Object.freeze(["access/online", "access/offline", "heartbeat", "connected", "disconnected"]);
export function panelTopics(value) {
  const uuid = panelUuid(value);
  return {
    command: `device/subscribe/${uuid}`,
    response: `device/publish/${uuid}`,
    events: Object.fromEntries(eventKinds.map((kind) => [kind, `event/${uuid}/${kind}`])),
  };
}

export function responseUuid(topic) {
  const match = /^device\/publish\/([1-9]\d{0,14})$(?![\s\S])/.exec(topic);
  return match?.[1] ?? null;
}

/** Never consume a waiter for a foreign topic, even when its msx-id was observed. */
export function matchesResponse(topic, parsed, expectedUuid) {
  return responseUuid(topic) === panelUuid(expectedUuid)
    && String(parsed?.transaction?.["src-id"]) === panelUuid(expectedUuid);
}

/** Normalize only after topic ownership and body source agree; backend API stays compatible. */
export function boundEvent(topic, parsed, { legacy = false } = {}) {
  const match = /^event\/([1-9]\d{0,14})\/(.+)$/.exec(topic);
  if (match && eventKinds.includes(match[2]) && String(parsed?.transaction?.["src-id"]) === match[1]) {
    return { topic: `event/${match[2]}`, sourceUuid: match[1], isolated: true };
  }
  if (legacy && eventKinds.some((kind) => topic === `event/${kind}`)) {
    // Explicit compatibility mode is NOT a provenance guarantee. Never mobile-safe.
    try { return { topic, sourceUuid: panelUuid(parsed?.transaction?.["src-id"]), isolated: false }; }
    catch { return null; }
  }
  return null;
}

export function bridgeSubscriptions({ legacy = false } = {}) {
  return ["device/publish/+", ...eventKinds.map((kind) => `event/+/${kind}`),
    ...(legacy ? eventKinds.map((kind) => `event/${kind}`) : [])];
}

export function assertSecureBrokerTransport(url) {
  const parsed = new URL(url);
  if (parsed.username || parsed.password) throw new Error("MQTT URL must not contain credentials");
  if (parsed.protocol === "mqtts:") return;
  if (parsed.protocol === "mqtt:" && ["127.0.0.1", "[::1]"].includes(parsed.hostname)) return;
  throw new Error("MQTT requires TLS except for a local loopback bridge connection");
}
