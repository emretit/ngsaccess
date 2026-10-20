# 21 — MQTT per-panel isolation implementation

19 October 2026 · task `task_da386a5e5934` · dispatch `ctx_1a2ce6669509`

## Outcome

Implemented secure repository broker policy, offline credential staging, UUID-bound firmware provisioning, actual bridge source validation and 19 passing offline regressions. Reviewer19 independently reran the first 17 tests and confirmed the original cross-panel command-read / ACK / event forgery source chain is closed under the shipped secure policy. **This is not live broker, firmware, TLS or physical-door verification.** IDE mobile must remain disabled until the external release gates are satisfied; no gate environment value was changed.

## Revalidated findings and closure scope

- **ASR06 (reviewer19): software mitigation verified, deployed isolation pending.** Original `user device` could read `device/subscribe/#` and write `device/publish/#`; B could observe A's msx-id then send success on A's response topic. Random correlation IDs and comparing a topic suffix with expected UUID did not identify its authenticated publisher. Original common `event/#` let B forge another panel's `transaction.src-id` too.
- **ASR05: remains open as physical delivery/replay limitation.** MQTT QoS1, reconnect/client or broker queuing may duplicate/delay actuation beyond backend TTL; backend single dispatch cannot establish exactly-once physical execution or cancellation of already queued commands. No unverified QoS/protocol workaround was introduced.
- **MOB-06 / NET-F02 / DEV-F04: supporting infrastructure implemented, full capability not closed by this worker.** Transport ACK, physical door movement, a human passage and attendance remain distinct. Backend authorization, mobile capability gate and broader operation lifecycle are owned elsewhere. This worker does not claim their acceptance criteria completed.

## Delivered behavior

1. `infra/mqtt/config/acl`: panel identity is authenticated numeric UUID, independent of clientId. Panel reads only `device/subscribe/%u`, writes only `device/publish/%u` and five exact `event/%u/...` paths. Bridge retains its trusted command/sync role with explicit scoped event reads. Removed shared device and common event grants.
2. Compose exposes plaintext bridge port only on host loopback. Panel TLS listener remains 8883; secure provisioning requires SSL and rejects self-signed bypass. This cannot solve historical firmware CA-loading problems by itself.
3. Offline credential tool generates unique 256-bit panel passwords, writes a private registry and a broker password file, and invokes installed `mosquitto_passwd` with explicit PBKDF2 selection and `-U` conversion. No password appears in CLI argv or printed output. Existing files are never overwritten; incomplete files created by the operation are removed on failure. Registry `0600`, parent `0700`; defaults are ignored, existing secret/runtime ignore patterns preserved.
4. Provisioner resolves credentials only after L3 login supplies the panel UUID. Default secure mode has no `device` fallback; mismatched/shared/missing identity is rejected before configuration writes. Registry enforces unique passwords and rejects invalid UUIDs. Single-panel explicit UUID env credentials are also supported.
5. Provisioner writes all command/response/event topics, disables HTTP heartbeat command processing, and checks identity/TLS/topic/LOGGER readback before reboot. Firmware partial write/readback failure withholds reboot, surfaces a safe error and requires maintenance recovery. Failed reboot returns `ok:false`. Return data is allowlisted so firmware echo/error payloads cannot return credentials.
6. Actual bridge router rejects unscoped events by default, validates topic structure and requires payload source to equal topic UUID. Validated events normalize back to the existing API topic before forwarding. Foreign ACK/login responses cannot consume legitimate pending/waiter state. Shared broker credentials remain necessary infrastructure trust: the bridge/broker can impersonate panels and a panel can forge its own events.
7. `MQTT_SECURITY_MODE=legacy` is explicit maintenance compatibility only, never mobile-safe. The secure broker ACL deliberately provides no shared event grant. Runbook requires the mobile attestation unset for any legacy/unverified state and for rollback.

## Integration contracts and dependencies

- No Convex/mobile/schema/API files changed. Existing `/ide-bridge/event` request remains `{topic: "event/<kind>", body: <original JSON string>}` after validation of `event/<uuid>/<kind>` and `transaction.src-id`. Existing ACK endpoint shape remains; firmware message text is replaced by safe fixed status text.
- Panel UUID: positive canonical decimal string, 1–15 digits; safe integer input accepted for bridge operation destinations. Wildcards, topic separators, reserved identities and lossy numeric forms are rejected.
- Local provisioning input: `MQTT_DEVICE_CREDENTIALS_FILE` referencing private JSON `{ "<uuid>": "<unique password>" }`; alternative explicit `MQTT_DEVICE_USER=<uuid>` and `MQTT_DEVICE_PW[_FILE]`. No generated/example real password included in source/report.
- Bridge accepts `MQTT_BRIDGE_PW_FILE` and `IDE_BRIDGE_SECRET_FILE` or their existing env values. Secret files must be private regular files and final-component symlinks are rejected. Remote MQTT must use TLS; only literal loopback permits plaintext; URL-embedded credentials are rejected.
- Offline staging: `MQTT_SECRETS_DIR` (default ignored `infra/mqtt/secrets`), `MQTT_BRIDGE_PW[_FILE]`, positional nonsecret panel UUIDs. Requires operator-installed `mosquitto_passwd`; no package/dependency/lockfile was changed or installed.
- Backend owner11 reported an exact `MOBILE_IDE_ISOLATION_VERIFIED=true` operator gate, default closed. Owner11 received initial policy immediately; after its dispatch settled, final API/test/rollout contract was relayed through the coordinator. **This worker never set or attested that gate.**

## Modified/new files

- `infra/mqtt/.gitignore`
- `infra/mqtt/RUNBOOK.md`
- `infra/mqtt/config/acl`
- `infra/mqtt/config/mosquitto.conf` (TLS rollout comments)
- `infra/mqtt/docker-compose.yml`
- `scripts/ide-mqtt-bridge.mjs`
- `scripts/ide-provision-agent.mjs`
- `scripts/ide-smart-set-mqtt-target.mjs`
- `scripts/ide-mqtt-create-credentials.mjs` (new)
- `scripts/lib/ide-provision.mjs`
- `scripts/lib/ide-mqtt-policy.mjs` (new)
- `scripts/lib/ide-mqtt-credentials.mjs` (new)
- `scripts/lib/ide-mqtt-routing.mjs` (new)
- `scripts/lib/ide-mqtt-policy.nodetest.mjs` (new)
- `scripts/lib/ide-mqtt-routing.nodetest.mjs` (new)
- `scripts/lib/ide-provision.nodetest.mjs` (new)
- `docs/mobile-release/reports/21-mqtt-isolation.md` (this report)

Pre-existing web/Convex/mobile changes preserved; no ownership boundary edits. No commit/push/deploy/restart, broker/panel call, production mutation, Flutter/Dart/SDK command or secret-value inspection occurred. Mocked provisioning tests invoke the actual helper while replacing fetch; credential tests use temporary synthetic data, clean it up, and do not print generated credentials.

## Tests and checks actually run

`node --test scripts/lib/ide-mqtt-policy.nodetest.mjs scripts/lib/ide-mqtt-routing.nodetest.mjs scripts/lib/ide-provision.nodetest.mjs` — **19 passed, 0 failed**.

Coverage: shipped ACL authorization matrix for cross-panel command capture/ACK/event forgery; correct panel and bridge privileges; all five event paths; actual router known-msx forged ACK and foreign login preservation; own-topic/foreign-source rejection; malformed/common event rejection; compatible valid event forwarding; strict identity/transport validation; provisioned username/topics/readback-before-reboot; no configuration writes with mismatched identity or absent fleet credential; plaintext/certificate bypass rejection before network; partial write/readback failure; safe firmware error redaction; private registry/modes/symlink/unique-password rejection; offline file staging/no overwrite/failed conversion cleanup; failed reboot cannot claim success.

The ACL tests interpret the shipped file's supported directives using an independent limited interpreter; they are **not real Mosquitto auth/ACL execution**. The staging test injects a synthetic hash converter to test file orchestration and cleanup; it does **not certify installed Mosquitto PBKDF2 conversion**. Both `mosquitto` and `mosquitto_passwd` are absent locally; no live broker was contacted. Reviewer19 independently ran 17/17 tests before the last two tests were added; final 19/19 were run by this worker.

`node --check` passed for bridge, router, provision agent, CLI, credential staging CLI, provision helper, policy and credential helper. Scoped `git diff --check` passed. Broad npm/TS/lint and Flutter tooling remain with coordinator per SDK/check ownership.

## External release gates and rollback

See `infra/mqtt/RUNBOOK.md` for concrete staged credential, TLS, fleet provisioning, session/retained-state eviction, A/B real-broker and firmware/hardware validation sequence. The gate stays unset until all relevant panels and infrastructure paths are verified. Particular blockers: absent actual broker tool execution; actual deployed ACL/password file/session inventory unknown; firmware trust-chain/hostname validation and UUID-topic readback untested on physical devices; physical command expiry/dedup/late execution unverified. These are explicit incomplete deployment/hardware acceptance conditions, not hidden software successes.

Rollback always unsets the mobile gate first, stops/reconciles command producers, retains secure credentials/ACL where possible and never automatically opens shared grants or restores old retained command state. Legacy recovery cannot enable mobile; full verification is required again before reattestation.

References checked: [official Mosquitto configuration/ACL semantics](https://mosquitto.org/man/mosquitto-conf-5.html), [official password utility](https://mosquitto.org/man/mosquitto_passwd-1.html), [official PBKDF2 hash encoding source](https://github.com/eclipse-mosquitto/mosquitto/blob/master/plugins/dynamic-security/clients.c). Existing firmware documentation in `docs/ide-smart` supplied parameter/readback/identity contracts; no current firmware behavior was invented or remotely exercised.
