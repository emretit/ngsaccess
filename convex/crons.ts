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

// Cihaz saat senkronu: her gün 01:00 UTC (TR 04:00) — drift'le Valid window
// ve week plan time evaluation'ı bozulmasın.
crons.daily(
  "sync-hik-device-times",
  { hourUTC: 1, minuteUTC: 0 },
  internal.actions.hikGatewayDevice.syncHikDeviceTimes,
);

export default crons;
