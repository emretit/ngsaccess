# 11. Boot Modes & Recovery

## 11.1 Boot Modes

| Mode | Value | Description |
| :---- | :---- | :---- |
| NORMAL | 2 | Standard operating mode. |
| UPDATE | 1 | Device is in OTA update mode. |
| SAFE | 3 | Safe mode (minimal services running). |
| RESCUE | 4 | Rescue mode for crash recovery |

> **⚠ Çelişki (teyit bekliyor):** Bu tablo `RESCUE = 4` diyor; `10-full-parameter-reference.md`
> (BOOT.MODE satırı) ise `8=RESCUE` diyor. Hangisinin doğru olduğu firmware'den **doğrulanmadı**
> — IDE Smart'a sorulmalı, körlemesine değiştirilmemeli.

**ℹ  Note:** BOOT.MODE is set by the device on each reboot. BOOT.REASON provides a human-readable description of the cause (e.g., "Power-on", "OTA", "Crash").
