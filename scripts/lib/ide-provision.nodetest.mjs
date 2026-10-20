import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, chmodSync, statSync, symlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { provisionPanel } from "./ide-provision.mjs";
import { credentialRegistry, provisioningCredentials, readPrivateFile } from "./ide-mqtt-credentials.mjs";
import { createCredentials } from "../ide-mqtt-create-credentials.mjs";

const base = { ip: "192.168.0.2", l3User: "3", l3Pass: "synthetic-l3", broker: "broker.example", mqttUser: "9001", mqttPw: "synthetic-device-password-at-least-24" };
function panel(t, { mismatch, failedWrite = false, invalidJson = false, rebootFail = false } = {}) {
  const calls = [], state = {};
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    const req = JSON.parse(init.body); calls.push(req);
    let payload;
    if (req.transaction.type === "login") payload = { result: "success", data: { token: "3.100.900.9001.synthetic" } };
    else if (req.transaction.type === "parameter_write") {
      Object.assign(state, req.payload);
      payload = { result: failedWrite ? "fail" : "success", message: { "MQTT.PASSWORD": base.mqttPw } };
    } else if (req.transaction.type === "parameter_read") payload = { result: "success", data: { ...Object.fromEntries(req.payload.parameters.filter((key) => key in state).map((key) => [key, state[key]])), ...(mismatch ? { [mismatch]: "wrong" } : {}), "MQTT.PASSWORD": base.mqttPw } };
    else payload = { result: rebootFail ? "fail" : "success" };
    return { ok: true, status: 200, text: async () => invalidJson ? base.mqttPw : JSON.stringify({ payload }) };
  });
  return { calls, state };
}
test("secure provision binds authenticated UUID identity and all event topics, verifies before reboot", async (t) => {
  const { calls, state } = panel(t);
  const result = await provisionPanel(base);
  assert.equal(state["MQTT.USERNAME"], "9001");
  assert.equal(state["MQTT.TOPIC_SUBSCRIBE"], "device/subscribe/9001");
  assert.equal(state["MQTT.TOPIC_PUBLISH"], "device/publish/9001");
  for (const key of ["AC_LOG_TOPIC", "AC_OFFLINE_LOG_TOPIC", "HB_TOPIC", "CONNECTED_TOPIC", "DISCONNECTED_TOPIC"]) assert.match(state[`LOGGER.${key}`], /^event\/9001\//);
  assert.equal(state["MQTT.SSL_SELF_SIGNED"], 0);
  assert.equal(calls.at(-1).transaction.type, "reboot");
  assert.equal(result.ok, true);
  assert.equal(result.secureConfiguration, true);
  assert.equal(JSON.stringify(result).includes(base.mqttPw), false);
});
test("secure provision refuses shared/mismatched/absent identity without writing panel configuration", async (t) => {
  const { calls } = panel(t);
  for (const mqttUser of ["device", "bridge", "9002", undefined]) await assert.rejects(provisionPanel({ ...base, mqttUser }), /credentials|UUID/);
  assert.equal(calls.some((call) => call.transaction.type === "parameter_write"), false);
});
test("secure provision refuses plaintext and certificate bypass before any network request", async (t) => {
  const { calls } = panel(t);
  for (const opts of [{ ssl: false }, { selfSigned: true }]) await assert.rejects(provisionPanel({ ...base, ...opts }), /verified TLS/);
  assert.equal(calls.length, 0);
});
test("partial firmware write/readback rejection is failure and never reboots", async (t) => {
  const { calls } = panel(t, { mismatch: "LOGGER.DISCONNECTED_TOPIC" });
  await assert.rejects(provisionPanel(base), /readback mismatch/);
  assert.equal(calls.some((call) => call.transaction.type === "reboot"), false);
});
test("firmware write errors and invalid JSON cannot expose echoed secrets", async (t) => {
  panel(t, { failedWrite: true });
  await assert.rejects(provisionPanel(base), (error) => !error.message.includes(base.mqttPw));
});
test("malformed panel JSON error omits raw body", async (t) => {
  panel(t, { invalidJson: true });
  await assert.rejects(provisionPanel(base), (error) => !error.message.includes(base.mqttPw));
});
test("private per-device registry resolves only authenticated panel and forbids shared passwords", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "mqtt-credentials-test-")); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, "credentials.json");
  writeFileSync(path, JSON.stringify({ "9001": base.mqttPw, "9002": `${base.mqttPw}-other` }), { mode: 0o600 });
  const config = provisioningCredentials({ MQTT_DEVICE_CREDENTIALS_FILE: path });
  assert.equal(config.resolveMqttCredentials("9001").username, "9001");
  assert.throws(() => config.resolveMqttCredentials("9003"), /No MQTT credential/);
  chmodSync(path, 0o644); assert.throws(() => credentialRegistry(path));
  chmodSync(path, 0o600);
  symlinkSync(path, join(dir, "link")); assert.throws(() => readPrivateFile(join(dir, "link")));
  writeFileSync(path, JSON.stringify({ "9001": base.mqttPw, "9002": base.mqttPw }));
  assert.throws(() => credentialRegistry(path), /unique password/);
  assert.throws(() => provisioningCredentials({ MQTT_DEVICE_PW: base.mqttPw, MQTT_SECURITY_MODE: "secur" }), /Invalid/);
  assert.equal(provisioningCredentials({ MQTT_DEVICE_PW: base.mqttPw }).resolveMqttCredentials("9001").username, "");
});
test("offline credential staging writes private files, no shared user, no overwrite; failed hash conversion cleans up", (t) => {
  const root = mkdtempSync(join(tmpdir(), "mqtt-stage-test-")); t.after(() => rmSync(root, { recursive: true, force: true }));
  const directory = join(root, "good");
  const opts = { uuids: ["9001", "9002"], directory, bridgePassword: "synthetic-bridge-password-at-least-24", hashFile(path) {
    const lines = readFileSync(path, "utf8").trim().split("\n");
    assert.deepEqual(lines.map((line) => line.split(":")[0]), ["9001", "9002", "bridge"]);
    // This test isolates orchestration/file safety; it does not validate real Mosquitto hashing.
    writeFileSync(path, lines.map((line) => `${line.split(":")[0]}:$7$synthetic-hash`).join("\n"));
  } };
  createCredentials(opts);
  assert.equal(statSync(directory).mode & 0o777, 0o700);
  assert.equal(statSync(join(directory, "device-credentials.json")).mode & 0o777, 0o600);
  const registry = credentialRegistry(join(directory, "device-credentials.json"));
  assert.notEqual(registry["9001"], registry["9002"]);
  assert.throws(() => createCredentials(opts), /empty private/);
  assert.throws(() => createCredentials({ ...opts, directory: join(root, "bad"), hashFile() {} }), /staging failed/);
  assert.throws(() => readFileSync(join(root, "bad", "passwd")));
  assert.throws(() => readFileSync(join(root, "bad", "device-credentials.json")));
});

test("failed reboot never returns fake provisioning success", async (t) => {
  panel(t, { rebootFail: true });
  const result = await provisionPanel(base);
  assert.equal(result.ok, false);
  assert.equal(result.rebooted, false);
});
test("per-device resolver receives authenticated UUID and missing fleet credential prevents all writes", async (t) => {
  const { calls } = panel(t);
  let resolved;
  await assert.rejects(provisionPanel({ ...base, mqttPw: undefined, resolveMqttCredentials(uuid) { resolved = uuid; throw new Error("No local credential"); } }), /No local credential/);
  assert.equal(resolved, "9001");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].transaction.type, "login");
});
