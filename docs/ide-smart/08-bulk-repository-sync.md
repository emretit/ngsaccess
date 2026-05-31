# 8. Bulk Repository Synchronization (sync / sync_reset)

## 8.1 Overview

For large-scale deployments it may be more efficient to push the entire user and permission database as binary files rather than using individual CRUD calls. The device's FileSyncManager downloads these repository files from an integrator-hosted HTTP server and applies them atomically.

Four repository file types are supported:

| Type | File on Device | Description |
| :---- | :---- | :---- |
| USER | users.bin | Binary snapshot of all user records. |
| PERMISSION | permissions.bin | Binary snapshot of all permission records. |
| YEARBIT | yearbit.bin | Yearly schedule bitmap (computed from permissions). |
| MONTHBIT | monthbit.bin | Monthly schedule bitmap (computed from permissions). |

## 8.2 Repository Parameters (REPO.\*)

| Parameter | Default | Validation | Description |
| :---- | :---- | :---- | :---- |
| REPO.ENABLED | 1 | 0 or 1 | Enable the sync feature. |
| REPO.PROTOCOL | http | string | Sync protocol. Currently only HTTP is supported. |
| REPO.HOST | 192.168.0.100 | hostname or IP | Integrator's sync server host. |
| REPO.PORT | 8000 | valid port | Sync server port. |
| REPO.PATH | /sync | string | Endpoint path on the sync server. |
| REPO.SSL | 0 | 0 or 1 | Use HTTPS. |
| REPO.WRITE_ATOMIC | 0 | 0 or 1 | If 1, write to temp file first and rename on success (safer but uses more flash). |
| REPO.TRUST_FILENAME | 1 | 0 or 1 | If 0, verify downloaded file SHA-256 against manifest. If 1, skip SHA-256 check. |
| REPO.AUTO_RESET_CACHE | 1 | 0 or 1 | Automatically reset the access cache after a successful sync. |
| REPO.EPOCH | 0 | int | Local epoch counter. Used to detect delta changes. Updated by device after each successful sync. |

## 8.3 Sync Protocol

The device sends a single HTTP GET request to REPO.HOST:REPO.PORT/REPO.PATH with the current local epoch. The server responds with Content-Type: application/octet-stream containing:

* 4-byte little-endian unsigned integer — length of the JSON manifest in bytes  
* JSON manifest bytes (UTF-8 encoded) of the exact length declared above  
* Binary file payloads — concatenated, in the same order as the files array, each exactly size bytes

### Request

GET /sync?since=<local_epoch>  HTTP/1.1  
Host: 192.168.0.100:8000

### Server Response Structure

The server responds with a JSON manifest header followed by streamed binary content for each file that has changed since the requested epoch:

{  
  "epoch": 42,  
  "target_id": "site-a-firmware-v1",  
  "files": [  
    { "type": "USER",       "name": "users.bin",       "size": 4096, "sig": "abc123", "sha256": "..." },  
    { "type": "PERMISSION", "name": "permissions.bin", "size": 2048, "sig": "def456", "sha256": "..." }  
  ]  
}

| Manifest Field | Description |
| :---- | :---- |
| epoch | Remote epoch. If equal to device local epoch and files list is empty, the device considers all repos up to date and skips download. |
| target_id | Identifier of the firmware target / configuration profile the manifest belongs to. Informational on the device side; helps backend operators correlate which configuration was served. |
| files | List of files that have changed. Empty list = no changes. |
| type | One of: USER, PERMISSION, YEARBIT, MONTHBIT. |
| size | Byte count of the file's binary content in the stream. Must be exact. |
| sig | Unique file signature (e.g., content hash or version string). Device skips download if local sig matches. |
| sha256 | Hex SHA-256 of the file content. Used when REPO.TRUST_FILENAME = 0\. |

**ℹ  Note:** The binary file data is streamed contiguously after the JSON manifest, in the same order as the files array. The device reads each file's bytes directly by consuming exactly size bytes from the stream per entry.

## 8.4 sync vs sync_reset

| Command | Behavior |
| :---- | :---- |
| sync | Delta sync. Device sends its current REPO.EPOCH to the server. Server returns only files changed since that epoch. If epoch matches and file list is empty, no files are downloaded. |
| sync_reset | Force full sync. Device ignores its local epoch and downloads everything the server provides, overwriting all local repository files. |

## 8.5 Sync Status

After a sync completes, the result is available via a parameter_read on REPO.* (sync state is reflected in internal NVS signatures). The FileSyncManager produces a report with these result codes:

| Result | Meaning |
| :---- | :---- |
| ok | All files processed successfully. |
| partial | Some files updated, some failed. |
| failed | Sync failed entirely. |
| disabled | REPO.ENABLED = 0\. |
| bad_config | REPO.PROTOCOL / REPO.PATH misconfigured. |
| no_client | HTTP client not initialized. |

Per-file outcomes reported in the sync result:

| File Result | Meaning |
| :---- | :---- |
| updated | File was downloaded and committed successfully. |
| up_to_date | Local file signature matches remote — download skipped. |
| missing | Server did not include this file type in the manifest (and epoch changed — may indicate server intentionally omitted it). |
| download_failed | Network error during streaming. |
| verify_failed | SHA-256 mismatch (only when REPO.TRUST_FILENAME = 0). |
| rename_failed | Could not commit temp file (filesystem error). |
| protocol_failed | Could not drain stream bytes to stay in sync. |

## 8.6 Sample Server Implementation

A reference server implementation showing how to serve the sync endpoint (manifest \+ binary stream) is available in the following repository:

git clone https://x-token-auth:<BITBUCKET_ACCESS_TOKEN>@bitbucket.org/idesmart/ide_file_sync_sdk.git

The reference implementation demonstrates:

* Epoch management and delta detection

* Manifest JSON generation with correct file ordering

* Streaming binary file content in a single HTTP response

* SHA-256 signature generation for each file

* Handling sync_reset (returning all files regardless of client epoch)
