# IDE MQTT isolation: secure rollout target

This repository is a rollout candidate, **not an attestation about the live broker**. Do not enable mobile IDE commands until the operator records all gates below. Existing hardware notes describe plaintext deployment/CA-loading failure; enabling SSL in a helper does not resolve firmware trust support.

## Identity and topic contract

Every panel authenticates with username equal to its canonical numeric `SYSTEM.UUID` (1–15 digits, positive, no leading zero). `MQTT.CLIENT_ID` is `ngs-<uuid>` but is **not** the ACL identity. Each panel has a distinct random password; the old shared `device` account is removed. Only the bridge service receives the trusted `bridge` credential.

| Actor | Allowed read | Allowed write |
| --- | --- | --- |
| panel `<uuid>` | `device/subscribe/<uuid>` | `device/publish/<uuid>`, `event/<uuid>/access/online`, `event/<uuid>/access/offline`, `event/<uuid>/heartbeat`, `event/<uuid>/connected`, `event/<uuid>/disconnected` |
| trusted bridge | scoped event topics above across UUIDs, `device/publish/+`, `$SYS/#` | `device/subscribe/+` |

All other panel command/response/event access is denied by `config/acl`. `%u` is the authenticated username; the policy uses no client-id substitution. The bridge checks exact topic structure and `transaction.src-id === topic UUID` before processing ACKs/login replies/events. A foreign response cannot remove the legitimate pending operation or login waiter. Correlation randomness alone cannot secure a shared account.

Accepted scoped events are forwarded as `{topic: "event/<kind>", body: <original JSON>}` to the existing `/ide-bridge/event` API **after** source binding. There is no backend schema/API migration. Common `event/access/online` etc. are rejected by default. `MQTT_SECURITY_MODE=legacy` is an explicit maintenance-only bridge/provision compatibility mode: it accepts unattributed common events, provides **no cross-panel provenance guarantee**, and must never coexist with a mobile isolation attestation. The secure ACL intentionally does not grant legacy event topics.

Delivery limitation: command publish still uses MQTT QoS 1. Backend sent-mark/TTL does not cancel a command already queued by MQTT.js or the broker; reconnect/redelivery can duplicate or delay actuation beyond a backend deadline. Exactly-once actuation and physical TTL are **not verified**; firmware expiry/dedup behavior and offline/reconnect tests remain release gates. Do not enable mobile on the strength of backend single-dispatch tests alone.

Trust limitation: a compromised panel can forge **its own** events; a compromised `bridge` credential/process or broker can impersonate any panel. This is transport/source isolation, not proof of physical passage or attendance. Firmware can emit actuator/access logs for a remote command; do not equate those with a human crossing a door.

## Offline credential preparation (no deployment)

Requirements: Node and an operator-installed `mosquitto_passwd` supporting `-H sha512-pbkdf2 -U`. The tool is not installed by this change. From repository root:

1. Create a bridge password in an approved secret manager. Supply it through `MQTT_BRIDGE_PW_FILE`, an existing regular file owned by the operator with mode `0600`; `MQTT_BRIDGE_PW` env is also supported. Never pass passwords as CLI arguments, paste them in docs, or use `mosquitto_passwd -b`.
2. Set `MQTT_SECRETS_DIR` to a **new empty private staging directory** (default `infra/mqtt/secrets`, ignored). Run `node scripts/ide-mqtt-create-credentials.mjs <uuid-a> <uuid-b>` with the real UUIDs as nonsecret arguments. This is offline: random unique device passwords are written to `device-credentials.json`; `passwd` is converted in place with `mosquitto_passwd -H sha512-pbkdf2 -U`. No secret is printed. No live file is overwritten. Failure removes the incomplete files.
3. Keep the plaintext registry on the authorized provisioning workstation only: directory `0700`, file `0600`, no symlinks. Set `MQTT_DEVICE_CREDENTIALS_FILE` to that file. Do not mount the plaintext registry into the broker or distribute bridge credentials to panels.
4. Stage only the hashed `passwd` for broker use. On the deployment host, arrange ownership so the container's actual broker UID can read it (`0600` with broker ownership, parent searchable). Determine the UID from the selected image; do not assume a local workstation UID. Server keys also need broker-readable restricted ownership. Do not change the workstation registry to group/world-readable.

For a single known panel, the provisioner also accepts `MQTT_DEVICE_USER=<exact UUID>` plus `MQTT_DEVICE_PW_FILE` (or env `MQTT_DEVICE_PW`). Secure mode rejects `device`, `bridge`, missing identity, mismatched UUID and passwords shorter than 24 characters. A registry is preferred for fleets because it enforces distinct passwords.

## Provisioning interface and readback

`provisionPanel` logs into the panel first, derives its UUID, resolves local credentials, and writes UUID-scoped command/response and **all five** LOGGER topics. Secure mode is the default. It requires SSL enabled and disables self-signed bypass. It checks the MQTT host/port/identity/client/topic/TLS settings and LOGGER topic/protocol/heartbeat-response settings by readback before reboot. A partial write, omitted field or mismatch fails without reboot. Configuration writes are individually applied by firmware, so failure may leave partial configuration: resolve on the maintenance LAN while the mobile gate stays closed. Returned data is allowlisted; password/token/firmware error body is never returned.

CLI: `node --env-file=<private-local-env-file> scripts/ide-smart-set-mqtt-target.mjs`; local admin helper: `node --env-file=<private-local-env-file> scripts/ide-provision-agent.mjs`. Required configuration: `IDE_IP` for CLI, `IDE_L3_USER`, `IDE_L3_PASS`, `MQTT_BROKER_HOST`, optional `MQTT_BROKER_PORT` (8883), `MQTT_DEVICE_CREDENTIALS_FILE`. `NO_REBOOT=1` stages CLI changes for manual reboot. Neither helper is run by tests. Local panel provisioning uses firmware HTTP on a trusted maintenance LAN; MQTT TLS does not encrypt this provisioning leg. Do not provision over an untrusted network.

## Authorized rollout sequence — operator executes later

1. Keep backend `MOBILE_IDE_ISOLATION_VERIFIED` **unset**. Owner11's backend gate requires exact `true`; repository files cannot attest deployment. Record firmware versions, broker image digest/config version, fleet UUIDs, command backlog and maintenance window without credentials. Back up broker configuration/state and private panel settings securely.
2. Stop/drain command producers and bridge polling for the maintenance cutover; preserve existing admin operation semantics afterwards. Do not expose a second insecure bridge path. Retire queued non-idempotent commands with backend owner approval; never replay unknown old open-door commands automatically.
3. Resolve verified TLS trust on every supported firmware first. `config/mosquitto.conf` exposes TLS 8883; Compose binds plaintext 1883 to **host loopback only**. Validate external 1883 is unreachable, including host firewall/NAT rules and previously deployed containers. Panels that cannot load/validate the broker chain remain unsupported for mobile; do not use plaintext or `SSL_SELF_SIGNED=1` as a release workaround.
4. Stage new hashed UUID+bridge password file and secure ACL; remove shared `device` and all obsolete service credentials. Disconnect old sessions during cutover; a password-file change alone does not prove existing sessions were evicted. Remove old retained command/response/event messages and persistent sessions in the maintenance window using an approved broker-state procedure; old insecurely authored retained messages are not trustworthy. Do not restore them into the secure broker. Do not blindly delete the Docker volume containing operational data.
5. Provision each panel over the maintenance LAN with its own registry entry and scoped event topics; verify readback and reboot/connect. Deploy the updated bridge, leave secure mode default, use its dedicated credentials, and set `MQTT_URL=mqtt://127.0.0.1:1883` on the broker host or `mqtts://<verified-host>:8883` remotely. `MQTT_BRIDGE_PW_FILE` and `IDE_BRIDGE_SECRET_FILE` are supported private regular files. Remote plaintext/URL-embedded passwords are rejected.
6. In an isolated staging broker with two synthetic panels A/B, authenticate as B and prove: cannot receive A command; cannot publish A ACK; cannot publish A events or common events. Prove A can receive its command and its ACK is accepted. Using known msx-id, attempt B's own response topic with A body; legitimate A pending/login waiter must survive. Try `event/B/access/online` with A source and common `event/access/online`; neither reaches backend. Check authorized same-panel events and normalized backend ingestion. Record results without raw secrets/card payloads.
7. Verify physical firmware behavior per supported model: TLS chain/hostname rejection, UUID username, exact subscriptions, scoped access/offline/heartbeat/LWT, true ACK/NACK, network loss/late ACK, actuator IO mapping, no duplicated command on restart, and physical door outcome. A software ACK is not physical passage evidence. Run existing admin sync/door operations against staged devices to check compatibility.
8. Only after the **entire relevant fleet**, all publishers/readers and both network paths meet these checks may the release owner deliberately attest `MOBILE_IDE_ISOLATION_VERIFIED=true`. Record signed-off rollout evidence externally. Any unverified panel or legacy bridge means no attestation. This worker did not set the flag, deploy, restart, provision or contact a broker/panel.

## Rollback

First unset the mobile attestation and stop mobile command dispatch; confirm it is closed before changing infrastructure. Stop bridge command polling during recovery, reconcile pending/sent operations with the backend owner, and retain secure UUID credentials/ACL/TLS where possible. If reverting firmware/bridge to shared topics is unavoidable, keep mobile disabled and treat that path as legacy untrusted infrastructure. Restore only a reviewed configuration and reconcile panel-by-panel over the maintenance LAN; do not reintroduce broad grants as an automatic fallback or restore old retained command state. No rollback step sets the mobile gate true. Re-enablement requires the complete isolation verification again.

## Local evidence and remaining gates

Run `node --test scripts/lib/ide-mqtt-policy.nodetest.mjs scripts/lib/ide-mqtt-routing.nodetest.mjs scripts/lib/ide-provision.nodetest.mjs`. These execute the shipped ACL authorization matrix through a limited independent interpreter, the actual incoming bridge router, mocked firmware provisioning and private-file staging. They do **not** replace real Mosquitto authentication/ACL tests, hash conversion with installed Mosquitto, or firmware/TLS/hardware proof. Broker tools are absent in this worker environment.

Sources: [official Mosquitto ACL semantics](https://mosquitto.org/man/mosquitto-conf-5.html) (`%u`, patterns across users, password encryption requirement), [official password utility](https://mosquitto.org/man/mosquitto_passwd-1.html) (`-U`, `-H`, unsafe password-in-argv behavior). Firmware contract: `docs/ide-smart/03-authentication-authorization.md`, `04-message-types-reference.md`, `06-device-upstream-events.md`, `10-full-parameter-reference.md`.
