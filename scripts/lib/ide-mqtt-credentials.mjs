import { openSync, readFileSync, fstatSync, closeSync, constants } from "node:fs";
import { panelUuid } from "./ide-mqtt-policy.mjs";

/** No symlinks, no group/world permissions. Never include path/content in errors. */
export function readPrivateFile(path) {
  let fd;
  try {
    fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = fstatSync(fd);
    if (!stat.isFile() || (stat.mode & 0o077) !== 0) throw new Error();
    return readFileSync(fd, "utf8");
  } catch { throw new Error("Secret file must be a regular private file (0600), not a symlink"); }
  finally { if (fd !== undefined) closeSync(fd); }
}

export function secretFromEnv(env, key) {
  return env[`${key}_FILE`] ? readPrivateFile(env[`${key}_FILE`]).replace(/\r?\n$/, "") : env[key] || "";
}

export function credentialRegistry(path) {
  let parsed;
  try { parsed = JSON.parse(readPrivateFile(path)); }
  catch { throw new Error("Cannot read private MQTT credential registry"); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid MQTT credential registry");
  const entries = Object.entries(parsed);
  if (!entries.length) throw new Error("Empty MQTT credential registry");
  for (const [uuid, password] of entries) {
    panelUuid(uuid);
    if (typeof password !== "string" || password.length < 24 || /[\r\n:\0]/.test(password)) {
      throw new Error("MQTT device passwords must contain at least 24 characters and no separators");
    }
  }
  if (new Set(entries.map(([, password]) => password)).size !== entries.length) throw new Error("Each panel requires a unique password");
  return parsed;
}

/** Resolve after panel login, from a local registry or an explicitly UUID-bound env pair. */
export function provisioningCredentials(env = process.env) {
  const secureMode = env.MQTT_SECURITY_MODE !== "legacy";
  if (env.MQTT_SECURITY_MODE && !["secure", "legacy"].includes(env.MQTT_SECURITY_MODE)) throw new Error("Invalid MQTT_SECURITY_MODE");
  const registry = env.MQTT_DEVICE_CREDENTIALS_FILE ? credentialRegistry(env.MQTT_DEVICE_CREDENTIALS_FILE) : null;
  const password = secretFromEnv(env, "MQTT_DEVICE_PW");
  if (!registry && !password) throw new Error("MQTT per-device credentials required");
  return {
    secureMode,
    resolveMqttCredentials(uuid) {
      if (registry) {
        const pw = registry[panelUuid(uuid)];
        if (!pw) throw new Error("No MQTT credential for authenticated panel UUID");
        return { username: uuid, password: pw };
      }
      return { username: env.MQTT_DEVICE_USER || (secureMode ? "" : "device"), password };
    },
  };
}
