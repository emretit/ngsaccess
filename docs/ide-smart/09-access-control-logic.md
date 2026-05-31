# 9. Access Control Logic

## 9.1 Evaluation Flow

When update_actuator is called, the device runs the following checks in order. Any check that fails returns immediately with a specific failure reason and the actuator is not pulsed.

0\. Request channel authorization (pre-flight, runs before the access logic below)

If the request arrives through a network channel (MQTT, HTTP, UDP, BLE, etc.):  
→ Validate token (level ≥ channel minimum)  
→ If token is invalid or missing: deny

If the request arrives from a Wiegand reader on channel X:  
→ If WIEGANDX.ENABLED = 0 at boot, the Wiegand channel does not exist and no request can be delivered  
→ If WIEGANDX.ACCEPTED_FC ≠ -1 and the card's facility code ≠ WIEGANDX.ACCEPTED_FC: deny

1\. Actuator-busy gate

If ACTUATORX is mid-cycle (a pulse or latch is currently running on this IO):  
→ Deny with "Actuator X busy (pulse in progress)"  
→ No user lookup happens

2\. Broker-offline gate (only when AC.COORDINATION_MODE = MQTT)

If the MQTT broker connection is down:  
→ If AC.MQTT_OFFLINE_BEHAVIOR = 0 (fail-closed, default): deny  
→ If AC.MQTT_OFFLINE_BEHAVIOR = 1 (fail-open): grant  
→ No further checks run

Skipped in SOLO and MULTICAST modes.

3\. User lookup

Look up the user record by user_id:  
→ Not found: deny

4\. User status

Check user.status = 1 (enabled):  
→ Disabled: deny

5\. User validity window

Check user.start ≤ now ≤ user.end:  
→ Outside the window: deny

6\. Anti-passback check

If AC.ANTI_PASSBACK = 1 and ACTUATORX.ANTI_PASSBACK_MODE ≠ 0:  
→ Compare user.current_zone with ACTUATORX.ZONE (the actuator's origin zone)  
→ If they match: continue to step 7  
→ If they differ and ANTI_PASSBACK_MODE = 1 (Hard): deny; the user's zone is NOT updated  
→ If they differ and ANTI_PASSBACK_MODE = 2 (Soft): log a SOFT_APB_VIOLATION access-log entry (result code 3) and continue to step 7; the user's zone WILL be updated on sensor confirmation (step 9)

If AC.ANTI_PASSBACK = 0 or ACTUATORX.ANTI_PASSBACK_MODE = 0, the check is skipped entirely.

7\. Permission evaluation

Iterate the user's permission list. For each permission:

a. Fetch the permission record  
b. Check the permission's IO list includes the requested io_id (i.e., the actuator is one of the permission's targets)  
c. Check the permission's schedule matches the current time (minute-of-day window AND day selector — weekly / monthly / yearly)  
d. If max_uses > 0 and period_type is set (1 = daily, 2 = weekly, 3 = monthly, 4 = yearly):  
→ Compute the current period bucket from period_type \+ current time  
→ Look up the counter for the pair (user_id, ACTUATORX.NEW_ZONE) — note that this is keyed by the actuator's destination zone, shared across every actuator that leads into the same zone  
→ If a counter exists in the same bucket AND count ≥ max_uses: this permission is exhausted; skip it and continue to the next permission in the list  
→ Otherwise: the permission is counter-eligible; remember the computed bucket for step 9b  
e. If all checks above passed: this permission grants the request. Stop iterating.

If no permission grants the request: deny with "User is not permitted".

8\. Grant — relay pulse

Pulse ACTUATORX for ACTUATORX.PULSE_TIME seconds.

9\. Post-grant state updates (fire on sensor confirmation, or immediately if ACTUATORX.REQUIRE_SENSOR_ACTIVATION = 0)

a. Zone update — update user.current_zone to ACTUATORX.NEW_ZONE. This happens on every successful grant regardless of the anti-passback setting; the device always tracks where each user is so anti-passback can be re-enabled later, and so peer devices stay in sync.

b. Counter increment — if step 7d marked the grant as counter-eligible, increment the counter for (user_id, ACTUATORX.NEW_ZONE) in the current period bucket. The new count propagates to peer devices in the same coordination cluster.

c. Peer announcement — if ACTUATORX.BROADCAST_ZONE_CHANGE = 1 (default) AND AC.COORDINATION_MODE ≠ SOLO, broadcast the zone event (and the counter increment, if applicable) to peer devices via the configured transport.

If ACTUATORX.REQUIRE_SENSOR_ACTIVATION = 1 and the door sensor never reports the door opened (user walked away):  
→ The relay returns to its idle state when the pulse expires (or earlier in turnstile mode, when EARLY_RELEASE_ON_SENSOR = 1)  
→ user.current_zone is NOT updated, the counter is NOT incremented, and no peer announcement fires  
→ An access-log entry of result type 2 (granted-but-not-consumed) is recorded

## 9.2 Anti-Passback

| Parameter | Default | Description |
| :---- | :---- | :---- |
| AC.ANTI_PASSBACK | 0 | Enable anti-passback zone enforcement. Default OFF. |
| ACTUATOR0.ZONE | 0 | Expected zone for the user to be in to pass through this door. |
| ACTUATOR0.NEW_ZONE | 1 | Zone assigned to the user after a successful passage. |

**ℹ  Note:** Anti-passback after v0.1.0 is configured at two levels: AC.ANTI_PASSBACK is the device-wide master switch (default 0 = off), and ACTUATORX.ANTI_PASSBACK_MODE selects per-actuator behaviour (0 = Off, 1 = Hard, 2 = Soft). Both must be set appropriately for enforcement. Zone updates still happen on sensor confirmation when the master switch is off, so re-enabling APB later does not lose track of where each user is.

**Per-Actuator Modes (v0.1.0)**

| Value | Mode | On zone mismatch | On zone match |
| :---- | :---- | :---- | :---- |
| 0 | Off | Check skipped; grant proceeds. | Grant proceeds. |
| 1 | Hard | Deny with message “APB zone mismatch”. User's zone is NOT updated. | Grant proceeds; zone updated on sensor confirmation. |
| 2 | Soft | Grant proceeds; logs a SOFT_APB_VIOLATION access record (result code 3). Zone IS updated. | Grant proceeds; zone updated on sensor confirmation. |

**ℹ  Note:** Soft APB violations are logged with the user id, actuator id, the user's actual zone, the expected zone, and the timestamp. This lets the backend report violations without losing the underlying access record.

## 9.3 AC Parameters Reference

| Parameter | Default | Validation | Description |
| :---- | :---- | :---- | :---- |
| AC.ACCESS_CACHE | 0 | 0 or 1 | Access cache for faster evaluations. Default flipped to 0 in v0.1.0; forced to 0 on first boot after upgrade from v0.0.22. |
| AC.ANTI_PASSBACK | 0 | 0 or 1 | Enable zone-based anti-passback enforcement. |
| AC.RUN_WITHOUT_TIME | 0 | 0 or 1 | If 1, allow access evaluation even when NTP time is not yet synchronized. |
| ACTUATOR0.PULSE_TIME | 1 | 0–50 s | Relay activation duration in seconds. |
| ACTUATOR0.ZONE | 0 | int | Zone ID this door belongs to. |
| ACTUATOR0.NEW_ZONE | 1 | int | Zone ID assigned to user after passage. |
| ACTUATOR0.REQUIRE_SENSOR_ACTIVATION | 1 | 0 or 1 | If 1, the door sensor must confirm the door opened before the event is logged as granted. |
| ACTUATOR0.SENSOR | 0 | 0–1 | Input index of the door sensor. |
| ACTUATOR0.DOOR_OPEN_STATE | 0 | 0 or 1 | Input level read by sensor when door is open. |
| ACTUATOR0.DEFAULT_STATE | 0 | 0–2 | Default relay state after boot. 0 = Closed (default, fail-safe / normally-closed); 1 = Open (latched on); 2 = Remember last (restores pre-reboot latch state from ACTUATOR0.LAST_STATE). Widened from 0/1 to 0/1/2 in v0.1.0. |
| AC.COORDINATION_MODE | 1 | 0–2 | Peer coordination transport. 0 = SOLO, 1 = MULTICAST (default; UDP multicast over LAN), 2 = MQTT (broker-mediated). New in v0.1.0. |
| AC.MQTT_OFFLINE_BEHAVIOR | 0 | 0 or 1 | Behaviour when COORDINATION_MODE=2 and broker is unreachable. 0 = fail-closed (default; deny all), 1 = fail-open (grant locally). Consulted only in COORD_MQTT. New in v0.1.0. |
| AC.MAX_PERMS_PER_USER | 16 | 1–255 | Boot-only. Sizes the inline permission slot array in each user record. Changing invalidates users.bin. New in v0.1.0. |
| ACTUATOR0.ANTI_PASSBACK_MODE | 0 | 0–2 | Per-actuator APB mode. 0 = Off, 1 = Hard (deny on mismatch), 2 = Soft (log violation but grant). Honoured only when AC.ANTI_PASSBACK = 1\. New in v0.1.0. See §9.2. |
| ACTUATOR0.EARLY_RELEASE_ON_SENSOR | 0 | 0 or 1 | Door (0, default) vs Turnstile (1) sensor pattern. When 1 and REQUIRE_SENSOR_ACTIVATION=1, relay closes immediately on sensor signal. New in v0.1.0. |
| ACTUATOR0.LAST_STATE | 0 | 0 or 1 | Read-only diagnostic. Reflects the most recent persisted latch state when DEFAULT_STATE = 2\. New in v0.1.0. |
| ACTUATOR0.RELAY_OUTPUT | i (identity) | int 0..N-1 (N=total number of relays) | Physical relay this actuator drives. See  [0 2 0 Release Notes](https://docs.google.com/document/d/17tQ_wLFrL7lPmp-pOR2kDfJrmwTn8oPXyzGLPv2NYFI/edit?tab=t.0)section 2\. |
