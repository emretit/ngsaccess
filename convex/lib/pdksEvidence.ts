import type { PdksDayPolicy } from "./pdksRules";
export type PunchQuality = "ok" | "missingEntry" | "missingExit" | "noPunch" | "undirected";
export type AttendanceEvidence = {
  firstISO: string | null;
  lastISO: string | null;
  durationMeasured: boolean;
  punchQuality: PunchQuality;
  attendanceCredit: boolean;
  decision: "present" | "absent" | "incomplete";
};
/** Manual timestamps have explicit directions and override that side only. */
export function resolveAttendanceEvidence(
  dayReadings: readonly { accessTime: string; direction?: string; accessStatus?: string }[],
  manual: { entryISO?: string; exitISO?: string } | undefined,
  policy: PdksDayPolicy,
): AttendanceEvidence {
  const readings = dayReadings.filter(r => !r.accessStatus || r.accessStatus === "izin_verildi")
    .slice().sort((a, b) => a.accessTime.localeCompare(b.accessTime));
  if (policy.punchMode === "legacy") {
    const firstISO = manual?.entryISO ?? readings[0]?.accessTime ?? null;
    const lastISO = manual?.exitISO ?? (readings.length > 1 ? readings[readings.length - 1]?.accessTime ?? null : null);
    const attendanceCredit = !!firstISO || !!lastISO;
    return { firstISO, lastISO, durationMeasured: !!firstISO && !!lastISO, punchQuality: firstISO && lastISO ? "ok" : firstISO ? "missingExit" : lastISO ? "missingEntry" : "noPunch", attendanceCredit, decision: attendanceCredit ? "present" : "absent" };
  }
  const firstISO = (manual?.entryISO ? new Date(manual.entryISO).toISOString() : undefined) ?? readings.find(r => r.direction === "entry")?.accessTime ?? null;
  const lastISO = (manual?.exitISO ? new Date(manual.exitISO).toISOString() : undefined) ?? [...readings].reverse().find(r => r.direction === "exit" && (!firstISO || r.accessTime > firstISO))?.accessTime ?? null;
  const durationMeasured = !!firstISO && !!lastISO && lastISO > firstISO;
  const undirected = readings.some(r => r.direction !== "entry" && r.direction !== "exit");
  const noPunch = readings.length === 0 && !manual?.entryISO && !manual?.exitISO;
  const punchQuality: PunchQuality = undirected ? "undirected" : durationMeasured ? "ok" : noPunch ? "noPunch" : !firstISO ? "missingEntry" : "missingExit";
  const missing = (policy.requireCheckIn && !firstISO) || (policy.requireCheckOut && (!lastISO || (!!firstISO && !durationMeasured)));
  const decision = undirected && missing ? "incomplete" : noPunch ? (policy.noPunch === "review" ? "incomplete" : "absent") : missing ? (policy.missingRequiredPunch === "review" ? "incomplete" : "absent") : "present";
  return { firstISO, lastISO: lastISO && firstISO && lastISO <= firstISO ? null : lastISO, durationMeasured, punchQuality, attendanceCredit: decision === "present", decision };
}
