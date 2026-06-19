import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Her ayın 1'i saat 09:00 UTC'de zamanlanmış raporları gönder
crons.monthly(
  "send-scheduled-reports",
  { day: 1, hourUTC: 9, minuteUTC: 0 },
  internal.reports.triggerScheduledReports
);

// Hikvision sync kuyruğu: her dakika failed op'ları (online cihazlar için) retry et.
crons.interval(
  "process-hik-queue",
  { minutes: 1 },
  internal.actions.hikQueueWorker.processHikQueue,
);

// Stale failure temizliği: 10 dk'da bir orphan/non-Hik/24h+ failure'ları dismiss.
crons.interval(
  "cleanup-stale-hik-failures",
  { minutes: 10 },
  internal.hikvisionSync.cleanupStaleSyncIssues,
);

// Windows localBridge claim edip kapanırsa processing'te asılı kalan işleri geri aç.
crons.interval(
  "requeue-stale-hik-local-bridge-ops",
  { minutes: 1 },
  internal.hikvisionSync.requeueStaleLocalBridgeOperations,
);

// Cihaz saat senkronu: her gün 01:00 UTC (TR 04:00) — drift'le Valid window
// ve week plan time evaluation'ı bozulmasın.
crons.daily(
  "sync-hik-device-times",
  { hourUTC: 1, minuteUTC: 0 },
  internal.actions.hikGatewayDevice.syncHikDeviceTimes,
);

// IDE Smart komut kuyruğu: "sent"te asılı kalan (bridge ack'i kaçırdı / broker koptu)
// op'ları geri "pending"e al veya maxAttempts dolduysa "failed" yap. Bridge'in kendi
// timeout'unu (CMD_ACK_TIMEOUT_MS) kaçırdığı durumlar için güvenlik ağı.
crons.interval(
  "requeue-ide-timeouts",
  { minutes: 1 },
  internal.ideSync.requeueTimedOut,
);

// Ziyaretçi geçici erişimi: süresi dolan (accessExpiresAt<=now) aktif ziyaretçileri pasife çek
// → mevcut isActive=false desync yolu cihazdan söker.
crons.interval(
  "expire-visitor-access",
  { minutes: 5 },
  internal.visitors.expireVisitorAccess,
);

// E-posta doğrulama token temizliği: her gün 03:00 UTC — setupToken+tokenExpiresAt sıfırla.
crons.daily(
  "cleanup-expired-email-tokens",
  { hourUTC: 3, minuteUTC: 0 },
  internal.emailVerification.cleanupExpiredTokens,
);

export default crons;
