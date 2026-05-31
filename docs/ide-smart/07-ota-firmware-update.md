# 7. OTA (Over-the-Air) Firmware Update

## 7.1 Overview

The device uses a server-side provisioning model. Firmware meta information and binaries are fetched from the provisioning server over HTTPS. OTA can be triggered automatically on boot, periodically, or manually via the ota_update / ota_check message types.

## 7.2 OTA Parameters

| Parameter | Default | Validation | Description |
| :---- | :---- | :---- | :---- |
| OTA.AUTO_UPDATE | 1 | 0 or 1 | Enable automatic OTA checks. |
| OTA.AUTO_UPDATE_INTERVAL | 120 | 1–1440 min | How often (minutes) to check for updates. |
| OTA.AUTO_UPDATE_TIME | 180 | 0–1439 (minute-of-day) | Target minute-of-day for the update check window. |
| OTA.LATEST_ATTEMPT | (empty) | Read only | Timestamp of the last update attempt. |
| OTA.LATEST_STATUS | (empty) | Read only | Result of the last attempt. |
| OTA.LATEST_UPDATE | (empty) | Read only | Timestamp of the last successful update. |

**ℹ  Note:** BOOT.UPDATE_ON_BOOT (default 1) triggers an OTA check on every boot before the main application starts.

## 7.3 OTA Flow

The device checks for a new firmware version every OTA.AUTO_UPDATE_INTERVAL minutes. If a newer version is available, it waits until the minute-of-day defined by OTA.AUTO_UPDATE_TIME before downloading and applying the update. This allows scheduling updates during low-traffic periods.

* Device contacts the provisioning server and verifies it is authorised to receive updates.  
* Device fetches the latest firmware metadata and compares the version against the currently installed firmware. If no newer version exists, the process ends with no disruption.  
* If a newer version is found, the device reboots into update mode and begins the download. The System LED enters the **Updating** state (see Section 2.5) — **do not power off or reboot the device while in this state**.  
* Once the download is complete, the device reboots into the new firmware and enters a stabilisation window.   
* When the stabilisation window completes successfully, the System LED returns to the **Boot Completed** state (see Section 2.3). The device is now fully operational on the new firmware.  
* If the stabilisation window expires without confirmation, the device automatically rolls back to the previous firmware. 

Version check or update can be triggered on demand at any time:

// Check for a new version without disrupting normal operation  
{ "transaction": { ..., "type": "ota_check", "token": "<token>" }, "payload": {} }

// Immediately enter update mode and apply the latest firmware  
{ "transaction": { ..., "type": "ota_update", "token": "<token>" }, "payload": {} }

**ℹ  Note:** Do not power off or reboot the device while the System LED is in the Updating state, or in the Booting state, until the System LED reaches the Boot Completed state and the Network LED reaches the All Ready state (see Section 2 for the full OTA LED sequence).
