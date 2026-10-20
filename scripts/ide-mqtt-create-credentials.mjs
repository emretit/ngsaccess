#!/usr/bin/env node
/** OFFLINE ONLY. Generates private files; never connects to a broker or panel. */
import { randomBytes } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync, unlinkSync, chmodSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { panelUuid } from "./lib/ide-mqtt-policy.mjs";
import { credentialRegistry, secretFromEnv } from "./lib/ide-mqtt-credentials.mjs";

/** Write new files only: rotations are staged separately, never overwrite live secrets. */
export function createCredentials({ uuids, directory, bridgePassword, hashFile }) {
  const ids = uuids.map(panelUuid);
  if (!ids.length || new Set(ids).size !== ids.length) throw new Error("Provide distinct numeric panel UUIDs");
  if (typeof bridgePassword !== "string" || bridgePassword.length < 24 || /[\r\n:\0]/.test(bridgePassword)) throw new Error("Strong private bridge password required");
  const registryPath = resolve(directory, "device-credentials.json");
  const passwdPath = resolve(directory, "passwd");
  if (existsSync(registryPath) || existsSync(passwdPath)) throw new Error("Stage new credentials in an empty private directory");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  chmodSync(directory, 0o700);
  const registry = Object.fromEntries(ids.map((uuid) => [uuid, randomBytes(32).toString("base64url")]));
  let registryCreated = false;
  let passwdCreated = false;
  try {
    writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    registryCreated = true;
    credentialRegistry(registryPath);
    writeFileSync(passwdPath, [...ids.map((id) => `${id}:${registry[id]}`), `bridge:${bridgePassword}`, ""].join("\n"), { flag: "wx", mode: 0o600 });
    passwdCreated = true;
    hashFile(passwdPath);
    chmodSync(passwdPath, 0o600);
    // Fail closed if a wrong converter left plaintext behind.
    const lines = readFileSync(passwdPath, "utf8").trim().split("\n");
    if (lines.length !== ids.length + 1 || lines.some((line) => !/^[^:]+:\$7\$/.test(line))) throw new Error("Password conversion did not produce Mosquitto PBKDF2 hashes");
  } catch {
    if (registryCreated) unlinkSync(registryPath);
    if (passwdCreated) unlinkSync(passwdPath);
    throw new Error("Credential staging failed; incomplete secret files removed");
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    createCredentials({
      uuids: process.argv.slice(2),
      directory: process.env.MQTT_SECRETS_DIR || "infra/mqtt/secrets",
      bridgePassword: secretFromEnv(process.env, "MQTT_BRIDGE_PW"),
      hashFile(path) {
        // No -b, no password in argv/stdout. Mosquitto converts this private file in place.
        const result = spawnSync("mosquitto_passwd", ["-H", "sha512-pbkdf2", "-U", path], { stdio: "pipe" });
        if (result.error || result.status !== 0) throw new Error("mosquitto_passwd conversion failed");
      },
    });
    console.log("Private MQTT credentials staged; nothing deployed or provisioned.");
  } catch {
    console.error("Credential staging failed; verify UUIDs, private bridge secret, empty output directory and mosquitto_passwd installation.");
    process.exitCode = 1;
  }
}
