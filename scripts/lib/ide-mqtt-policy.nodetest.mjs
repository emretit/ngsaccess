import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { panelUuid, panelTopics, boundEvent, matchesResponse, bridgeSubscriptions, assertSecureBrokerTransport } from "./ide-mqtt-policy.mjs";

const acl = readFileSync(new URL("../../infra/mqtt/config/acl", import.meta.url), "utf8");
// Small independent interpreter of the shipped ACL subset, rejects unrecognized directives.
// This verifies the actual file's authorization matrix, not a second generated policy.
function allowed(user, action, topic) {
  let current = null;
  let accepted = false;
  for (const line of acl.split("\n").map((s) => s.trim()).filter((s) => s && !s.startsWith("#"))) {
    const [directive, access, filter] = line.split(/\s+/);
    if (directive === "user") { current = access; continue; }
    assert.ok(["topic", "pattern"].includes(directive));
    if (directive === "topic" && current !== user) continue;
    if (access !== action) continue;
    const levels = filter.split("/").map((part) => part === "%u" ? user : part);
    const target = topic.split("/");
    if (levels.every((part, i) => part === "#" || part === "+" && target[i] !== undefined || part === target[i])
      && (levels.at(-1) === "#" || levels.length === target.length)) accepted = true;
  }
  return accepted;
}

const A = "9001", B = "9002";
test("shipped broker ACL blocks B capturing A command and forging A ACK even with known msx-id", () => {
  assert.equal(allowed(B, "read", panelTopics(A).command), false);
  assert.equal(allowed(B, "write", panelTopics(A).response), false);
  assert.equal(allowed(B, "write", panelTopics(A).command), false);
  assert.equal(allowed(A, "read", panelTopics(A).command), true);
  assert.equal(allowed(A, "write", panelTopics(A).response), true);
  assert.equal(allowed(A, "read", panelTopics(A).response), false);
  assert.equal(allowed("bridge", "write", panelTopics(A).command), true);
  assert.equal(allowed("bridge", "read", panelTopics(A).response), true);
});
test("every event kind isolated; shared event topics denied to panel and bridge", () => {
  for (const [kind, topic] of Object.entries(panelTopics(A).events)) {
    assert.equal(allowed(A, "write", topic), true);
    assert.equal(allowed(B, "write", topic), false);
    assert.equal(allowed(B, "read", topic), false);
    assert.equal(allowed("bridge", "read", topic), true);
    assert.equal(allowed(A, "write", `event/${kind}`), false);
    assert.equal(allowed("bridge", "read", `event/${kind}`), false);
  }
  assert.equal(allowed("device", "write", panelTopics(A).response), false);
  assert.equal(allowed("device", "read", panelTopics(A).command), false);
});
test("bridge rejects self-topic with forged foreign body and all unbound topics", () => {
  const body = { transaction: { "src-id": Number(A), type: "access_event" } };
  assert.equal(boundEvent(`event/${B}/access/online`, body), null);
  assert.deepEqual(boundEvent(`event/${A}/access/online`, body), { topic: "event/access/online", sourceUuid: A, isolated: true });
  for (const topic of ["event/access/online", `event/${A}/telemetry`, `event/${A}/access/online/extra`, `device/publish/${A}`]) assert.equal(boundEvent(topic, body), null);
  assert.equal(boundEvent(`event/${A}/heartbeat`, {}), null);
  assert.equal(boundEvent("event/access/online", body, { legacy: true }).isolated, false);
  assert.equal(bridgeSubscriptions().includes("event/access/online"), false);
});
test("bridge binds response topic AND source even when adversary knows correlation id", () => {
  const forged = { transaction: { "src-id": Number(A), "msx-id": 1234 }, payload: { result: "success" } };
  assert.equal(matchesResponse(`device/publish/${B}`, forged, A), false);
  assert.equal(matchesResponse(`device/publish/${A}/extra`, forged, A), false);
  assert.equal(matchesResponse(`device/publish/${A}`, { transaction: { "src-id": B } }, A), false);
  assert.equal(matchesResponse(`device/publish/${A}`, forged, A), true);
});
test("identity rejects wildcards, reserved/shared accounts and lossy/noncanonical values", () => {
  for (const id of ["device", "bridge", "+", "#", "1/x", "01", "0", "1e3", " 9001", "9001\n", 1.5, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => panelUuid(id));
  assert.equal(panelUuid(9001), "9001");
});
test("bridge accepts TLS or literal loopback only and never URL-embedded credentials", () => {
  for (const url of ["mqtt://broker.example:1883", "mqtt://localhost:1883", "ws://127.0.0.1", "mqtts://u:p@broker.example"]) assert.throws(() => assertSecureBrokerTransport(url));
  for (const url of ["mqtt://127.0.0.1:1883", "mqtt://[::1]:1883", "mqtts://broker.example:8883"]) assert.doesNotThrow(() => assertSecureBrokerTransport(url));
  const compose = readFileSync(new URL("../../infra/mqtt/docker-compose.yml", import.meta.url), "utf8");
  assert.match(compose, /127\.0\.0\.1:1883:1883/);
  assert.doesNotMatch(compose, /"1883:1883"/);
});
