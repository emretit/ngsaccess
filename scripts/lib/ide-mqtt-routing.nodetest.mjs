import test from "node:test";
import assert from "node:assert/strict";
import { routeMqttMessage } from "./ide-mqtt-routing.mjs";
function fixture() {
  const requests = [];
  return { requests, pending: new Map(), loginWaiters: new Map(), tokenCache: new Map(),
    convexPost: async (path, body) => { requests.push({ path, body }); return { ok: true }; } };
}
function message(source, msx = 42) { return Buffer.from(JSON.stringify({ transaction: { "src-id": source, "msx-id": msx }, payload: { result: "success", data: { token: "synthetic-token" } } })); }
test("actual bridge router preserves A pending operation when B sends known A msx-id; only A response ACKs", async () => {
  const f = fixture(); f.pending.set(42, { opId: "operation-a", deviceUuid: "9001", timer: undefined });
  await routeMqttMessage("device/publish/9002", message(9001), f);
  assert.equal(f.pending.has(42), true); assert.equal(f.requests.length, 0);
  await routeMqttMessage("device/publish/9001", message(9002), f);
  assert.equal(f.pending.has(42), true); assert.equal(f.requests.length, 0);
  await routeMqttMessage("device/publish/9001", message(9001), f);
  assert.equal(f.pending.has(42), false);
  assert.deepEqual(f.requests, [{ path: "/ide-bridge/ack", body: { opId: "operation-a", msxId: 42, result: "success", message: "panel accepted command" } }]);
});
test("foreign login response cannot consume A waiter or resolve/cache attacker token", async () => {
  const f = fixture(), resolved = [];
  f.loginWaiters.set(42, { uuid: "9001", resolve: (token) => resolved.push(token), timer: undefined });
  await routeMqttMessage("device/publish/9002", message(9001), f);
  assert.equal(f.loginWaiters.has(42), true); assert.deepEqual(resolved, []);
  await routeMqttMessage("device/publish/9001", message(9001), f);
  assert.equal(f.loginWaiters.has(42), false); assert.deepEqual(resolved, ["synthetic-token"]);
});
test("actual bridge drops common events, malformed payload and foreign source then forwards bound event compatibly", async () => {
  const f = fixture();
  for (const topic of ["event/access/online", "event/9002/access/online", "unexpected/topic"]) await routeMqttMessage(topic, message(9001), f);
  await routeMqttMessage("event/9001/access/online", Buffer.from("bad-json"), f);
  assert.deepEqual(f.requests, []);
  const body = message(9001);
  await routeMqttMessage("event/9001/access/online", body, f);
  assert.deepEqual(f.requests, [{ path: "/ide-bridge/event", body: { topic: "event/access/online", body: body.toString("utf8") } }]);
});

test("panel rejection preserves already_exists contract and masks credentials/card numbers", async () => {
  const f = fixture();
  f.pending.set(42, { opId: "operation-a", deviceUuid: "9001" });
  const body = Buffer.from(JSON.stringify({ transaction: { "src-id": 9001, "msx-id": 42 },
    payload: { result: "fail", code: "already_exists", message: 'already exists: cardNumber=12345678; password="secret phrase"; token=abc-def; record 87654321' } }));
  await routeMqttMessage("device/publish/9001", body, f);
  assert.deepEqual(f.requests, [{ path: "/ide-bridge/ack", body: { opId: "operation-a", msxId: 42,
    result: "fail", errorCode: "already_exists", message: 'already_exists: already exists: cardNumber=[redacted]; password=[redacted]; token=[redacted]; record [redacted]' } }]);
});

test("message-only not found, nested message, sensitive objects, and long diagnostics are bounded", async () => {
  for (const payload of [
    { message: "record not found" },
    { message: { code: "not_found", message: "record missing", password: "never forward" } },
    { code: "E42", message: "failure " + "diagnostic ".repeat(100) + " token=secret" },
    { message: { password: "never forward" } },
  ]) {
    const f = fixture(); f.pending.set(42, { opId: "operation-a", deviceUuid: "9001" });
    await routeMqttMessage("device/publish/9001", Buffer.from(JSON.stringify({
      transaction: { "src-id": 9001, "msx-id": 42 }, payload: { ...payload, result: "fail" },
    })), f);
    const ack = f.requests[0]?.body;
    assert.ok(ack.message.length <= 200);
    assert.doesNotMatch(ack.message, /never forward|secret|42/);
    if (payload.message === "record not found" || payload.message?.code === "not_found") assert.equal(ack.errorCode, "not_found");
  }
});

test("explicit panel code takes priority over contradictory diagnostic text", async () => {
  const f = fixture(); f.pending.set(42, { opId: "operation-a", deviceUuid: "9001" });
  await routeMqttMessage("device/publish/9001", Buffer.from(JSON.stringify({ transaction: { "src-id": 9001, "msx-id": 42 },
    payload: { result: "fail", code: "not_found", message: "already exists in previous command" } })), f);
  assert.equal(f.requests[0]?.body.errorCode, "not_found");
});
