import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import assert from "node:assert/strict";
import { routeMqttMessage, createEventSpool, retryPendingAcks, deliverAck, commandExpired } from "./ide-mqtt-routing.mjs";
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


test("failed card POST survives restart in JSONL and succeeds once backoff elapses", async t => {
  const directory = mkdtempSync(join(tmpdir(), "ide-spool-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  let time = 1000;
  const f = fixture();
  f.convexPost = async (path, body) => { f.requests.push({ path, body }); throw new Error("offline"); };
  f.eventSpool = createEventSpool({ directory, convexPost: f.convexPost, now: () => time });
  await routeMqttMessage("event/9001/access/online", message(9001), f);
  assert.equal(f.eventSpool.size(), 1);
  const disk = readFileSync(join(directory, "events.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
  assert.equal(disk.length, 1);
  assert.equal(disk[0].body.topic, "event/access/online");
  assert.equal(disk[0].attempts, 1);
  const delivered = [];
  const restarted = createEventSpool({ directory, now: () => time,
    convexPost: async (path, body) => { delivered.push({ path, body }); return { ok: true }; } });
  await restarted.drain();
  assert.equal(delivered.length, 0);
  time += 1000;
  await restarted.drain();
  assert.deepEqual(delivered, [f.requests[0]]);
  assert.equal(restarted.size(), 0);
  assert.equal(readFileSync(join(directory, "events.jsonl"), "utf8"), "");
});

test("event spool retains FIFO, bounds size and warns instead of growing indefinitely", async t => {
  const directory = mkdtempSync(join(tmpdir(), "ide-spool-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const logs = [];
  let time = 0;
  const spool = createEventSpool({ directory, maxEntries: 2, now: () => time,
    log: value => logs.push(value), convexPost: async () => ({ ok: false }) });
  await spool.forward({ topic: "event/access/online", body: "one" });
  await spool.forward({ topic: "event/access/online", body: "two" });
  assert.equal(await spool.forward({ topic: "event/access/online", body: "three" }), false);
  assert.equal(spool.size(), 2);
  assert.ok(logs.some(line => line.includes("FULL")));
  time = 1000;
  await spool.drain();
  const disk = readFileSync(join(directory, "events.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
  assert.equal(disk[0].attempts, 2);
  assert.equal(disk[0].nextRetryAt, 3000);
  assert.deepEqual(disk.map(row => row.body.body), ["one", "two"]);
});

test("ACK HTTP failure retains pending, retries identical payload with exponential backoff", async () => {
  const f = fixture();
  let time = 0, ok = false;
  f.now = () => time;
  f.convexPost = async (path, body) => { f.requests.push({ path, body }); return { ok }; };
  f.pending.set(42, { opId: "operation-a", deviceUuid: "9001" });
  await routeMqttMessage("device/publish/9001", message(9001), f);
  assert.equal(f.pending.has(42), true);
  await retryPendingAcks(f);
  assert.equal(f.requests.length, 1);
  time = 1000;
  await retryPendingAcks(f);
  assert.equal(f.requests.length, 2);
  assert.equal(f.pending.get(42).ackNextRetryAt, 3000);
  ok = true;
  time = 3000;
  await retryPendingAcks(f);
  assert.equal(f.pending.has(42), false);
  assert.deepEqual(f.requests, Array(3).fill(f.requests[0]));
});

test("timeout/login_failed ACKs also stay pending on HTTP errors and do not change on duplicate responses", async () => {
  for (const errorCode of ["login_failed", "ack_timeout"]) {
    const f = fixture();
    let time = 0;
    f.now = () => time;
    f.pending.set(42, { opId: "operation-a", deviceUuid: "9001" });
    f.convexPost = async (path, body) => { f.requests.push({ path, body }); if (!time) throw new Error("offline"); return { ok: true }; };
    const ack = { opId: "operation-a", msxId: 42, result: "fail", errorCode };
    await deliverAck(42, ack, f);
    await routeMqttMessage("device/publish/9001", message(9001), f);
    assert.equal(f.pending.has(42), true);
    time = 1000;
    await retryPendingAcks(f);
    assert.equal(f.pending.has(42), false);
    assert.deepEqual(f.requests.map(row => row.body), [ack, ack]);
  }
});

test("bridge blocks expired door commands at the delivery boundary", () => {
  assert.equal(commandExpired({ opType: "openDoor", expiresAt: 100 }, 100), true);
  assert.equal(commandExpired({ opType: "openDoor", expiresAt: 101 }, 100), false);
  assert.equal(commandExpired({ opType: "triggerSync", expiresAt: 10 }, 100), false);
});

test("startup quarantines malformed, invalid and truncated rows and replays valid neighbors", async t => {
  const directory = mkdtempSync(join(tmpdir(), "ide-spool-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, "events.jsonl");
  const row = id => ({ id, body: { topic: "event/access/online", body: id }, attempts: 0, nextRetryAt: 0 });
  const corrupt = ["bad-json", "null", JSON.stringify({ id: "invalid" }), '{"id":"truncated'];
  writeFileSync(path, [JSON.stringify(row("one")), ...corrupt.slice(0, 3), JSON.stringify(row("two")), corrupt[3]].join("\n"));
  const delivered = [], logs = [];
  const options = { directory, now: () => 0, log: line => logs.push(line),
    convexPost: async (_, body) => { delivered.push(body.body); return { ok: true }; } };
  const spool = createEventSpool(options);
  assert.equal(spool.size(), 2);
  assert.equal(readFileSync(`${path}.corrupt`, "utf8"), corrupt.join("\n") + "\n");
  assert.ok(logs.some(line => line.includes("WARNING") && line.includes("4 corrupt")));
  assert.equal(createEventSpool(options).size(), 2);
  assert.equal(readFileSync(`${path}.corrupt`, "utf8"), corrupt.join("\n") + "\n");
  await spool.drain();
  assert.deepEqual(delivered, ["one", "two"]);
});

test("startup terminates a valid final JSONL row before appending another event", async t => {
  const directory = mkdtempSync(join(tmpdir(), "ide-spool-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, "events.jsonl");
  writeFileSync(path, JSON.stringify({ id: "one", body: { topic: "event/access/online", body: "one" }, attempts: 0, nextRetryAt: 1000 }));
  const options = { directory, now: () => 0, convexPost: async () => ({ ok: true }) };
  const spool = createEventSpool(options);
  await spool.forward({ topic: "event/access/online", body: "two" });
  assert.equal(createEventSpool(options).size(), 2);
  assert.equal(existsSync(`${path}.corrupt`), false);
});

test("permanent 4xx events are archived before advancing FIFO to the healthy event", async t => {
  for (const status of [400, 401, 403, 404, 422]) {
    const directory = mkdtempSync(join(tmpdir(), "ide-spool-"));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    let time = 0;
    const requests = [], logs = [];
    const spool = createEventSpool({ directory, now: () => time, log: line => logs.push(line),
      convexPost: async (_, body) => {
        requests.push(body.body);
        return !time ? { ok: false, status: 503 } : body.body === "bad" ? { ok: false, status } : { ok: true };
      } });
    await spool.forward({ topic: "event/access/online", body: "bad" });
    await spool.forward({ topic: "event/access/online", body: "good" });
    time = 1000;
    await spool.drain();
    assert.deepEqual(requests, ["bad", "bad", "good"]);
    assert.equal(spool.size(), 0);
    const rejected = JSON.parse(readFileSync(join(directory, "events.jsonl.rejected"), "utf8"));
    assert.equal(rejected.status, status);
    assert.equal(rejected.body.body, "bad");
    assert.equal(rejected.attempts, 2);
    assert.ok(logs.some(line => line.includes("WARNING") && line.includes(".rejected")));
    assert.equal(readFileSync(join(directory, "events.jsonl"), "utf8"), "");
  }
});

test("5xx, timeout, rate limiting and network failures retry the head without reordering", async t => {
  for (const status of [500, 503, 408, 429, undefined]) {
    const directory = mkdtempSync(join(tmpdir(), "ide-spool-"));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    let time = 0, healthy = false;
    const requests = [];
    const spool = createEventSpool({ directory, now: () => time,
      convexPost: async (_, body) => {
        requests.push(body.body);
        if (healthy) return { ok: true };
        if (status === undefined) throw new Error("network timeout");
        return { ok: false, status };
      } });
    await spool.forward({ topic: "event/access/online", body: "one" });
    await spool.forward({ topic: "event/access/online", body: "two" });
    time = 1000;
    await spool.drain();
    assert.equal(spool.size(), 2);
    assert.deepEqual(requests, ["one", "one"]);
    const disk = readFileSync(join(directory, "events.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
    assert.deepEqual(disk.map(row => row.body.body), ["one", "two"]);
    assert.equal(disk[0].nextRetryAt, 3000);
    assert.equal(existsSync(join(directory, "events.jsonl.rejected")), false);
    healthy = true;
    time = 2999;
    await spool.drain();
    assert.deepEqual(requests, ["one", "one"]);
    time = 3000;
    await spool.drain();
    assert.deepEqual(requests, ["one", "one", "one", "two"]);
    assert.equal(spool.size(), 0);
  }
});

function seedEvents(directory, count) {
  writeFileSync(join(directory, "events.jsonl"), Array.from({ length: count }, (_, i) => JSON.stringify({
    id: String(i), body: { topic: "event/access/online", body: String(i) }, attempts: 0, nextRetryAt: 0,
  }) + "\n").join(""));
}

test("1000 queued events compact the file only once per 100 acknowledged rows", async t => {
  const directory = mkdtempSync(join(tmpdir(), "ide-spool-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  seedEvents(directory, 1000);
  const write = fs.writeFileSync;
  const writes = t.mock.method(fs, "writeFileSync", (...args) => write(...args));
  syncBuiltinESMExports();
  t.after(() => { writes.mock.restore(); syncBuiltinESMExports(); });
  const delivered = [];
  const spool = createEventSpool({ directory, now: () => 0,
    convexPost: async (_, body) => { delivered.push(body.body); return { ok: true }; } });
  while (spool.size()) await spool.drain();
  assert.deepEqual(delivered, Array.from({ length: 1000 }, (_, i) => String(i)));
  assert.equal(writes.mock.callCount(), 10);
  assert.equal(readFileSync(join(directory, "events.jsonl"), "utf8"), "");
});

test("a crash before batch compaction may replay successes but loses no undelivered event", async t => {
  const directory = mkdtempSync(join(tmpdir(), "ide-spool-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  seedEvents(directory, 250);
  const delivered = [];
  let reachedCrash;
  const crash = new Promise(resolve => { reachedCrash = resolve; });
  const spool = createEventSpool({ directory, now: () => 0, convexPost: async (_, body) => {
    if (delivered.length === 137) {
      reachedCrash();
      // Model abrupt process death: this instance never receives another response
      // or writes a retry checkpoint. Restart using only its durable file.
      return new Promise(() => {});
    }
    delivered.push(body.body);
    return { ok: true };
  } });
  await spool.drain(); // The first 100 successes are compacted.
  void spool.drain();
  await crash;
  assert.equal(delivered.length, 137);
  const replayed = [];
  const restarted = createEventSpool({ directory, now: () => 0,
    convexPost: async (_, body) => { replayed.push(body.body); return { ok: true }; } });
  while (restarted.size()) await restarted.drain();
  assert.deepEqual(replayed, Array.from({ length: 150 }, (_, i) => String(i + 100)));
  assert.equal(new Set([...delivered, ...replayed]).size, 250);
});

test("heartbeat goes directly to HTTP even with a full spool; failures only log", async t => {
  for (const status of [200, 503]) {
    const directory = mkdtempSync(join(tmpdir(), "ide-spool-"));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    seedEvents(directory, 1);
    const before = readFileSync(join(directory, "events.jsonl"), "utf8");
    const f = fixture(), logs = [];
    f.log = line => logs.push(line);
    f.convexPost = async (path, body) => { f.requests.push({ path, body }); return { ok: status === 200, status }; };
    f.eventSpool = createEventSpool({ directory, maxEntries: 1, convexPost: f.convexPost });
    await routeMqttMessage("event/9001/heartbeat", message(9001), f);
    assert.deepEqual(f.requests, [{ path: "/ide-bridge/event", body: { topic: "event/heartbeat", body: message(9001).toString("utf8") } }]);
    assert.equal(f.eventSpool.size(), 1);
    assert.equal(readFileSync(join(directory, "events.jsonl"), "utf8"), before);
    assert.equal(logs.some(line => line.includes("forward FAIL")), status !== 200);
  }
});

test("a new event appended while a batch is in flight survives the next compaction", async t => {
  const directory = mkdtempSync(join(tmpdir(), "ide-spool-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  seedEvents(directory, 100);
  let release;
  const response = new Promise(resolve => { release = resolve; });
  let calls = 0;
  const delivered = [];
  const spool = createEventSpool({ directory, now: () => 0, convexPost: async (_, body) => {
    delivered.push(body.body);
    if (++calls === 100) await response;
    return { ok: true };
  } });
  const draining = spool.drain();
  // Wait until HTTP has yielded in the middle of its 100th record.
  while (calls < 100) await Promise.resolve();
  await spool.forward({ topic: "event/access/online", body: "appended" });
  release();
  await draining;
  assert.equal(spool.size(), 1);
  assert.deepEqual(readFileSync(join(directory, "events.jsonl"), "utf8").trim().split("\n").map(JSON.parse).map(row => row.body.body), ["appended"]);
  await spool.drain();
  assert.equal(spool.size(), 0);
  assert.equal(delivered.at(-1), "appended");
});
