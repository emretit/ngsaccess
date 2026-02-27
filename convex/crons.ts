import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Her ayın 1'i saat 09:00 UTC'de zamanlanmış raporları gönder
crons.monthly(
  "send-scheduled-reports",
  { day: 1, hourUTC: 9, minuteUTC: 0 },
  internal.reports.triggerScheduledReports
);

export default crons;
