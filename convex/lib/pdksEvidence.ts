import { hasDirectionalPdksCheckpoints, resolvePdksCheckpoint, type CheckpointReading, type PdksDayPolicy } from "./pdksRules";
import { pairPdksPunches, pdksPairReadings } from "./pdksPunchPairs";
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
  dayReadings: readonly (CheckpointReading & { accessTime: string; accessStatus?: string })[],
  manual: { entryISO?: string; exitISO?: string } | undefined,
  policy: PdksDayPolicy,
  options?: { scheduleType: "flexible" },
): AttendanceEvidence {
  const readings = dayReadings.filter(r => !r.accessStatus || r.accessStatus === "izin_verildi")
    .slice().sort((a, b) => a.accessTime.localeCompare(b.accessTime));
  if (policy.calculationMode === "eachPunch") {
    const display = resolveAttendanceEvidence(dayReadings, manual, { ...policy, calculationMode: "firstLast" }, options);
    const minInterval = policy.minPunchIntervalMinutes ?? 1;
    const paired = pairPdksPunches(pdksPairReadings(readings, manual, minInterval), minInterval);
    const noPunch = readings.length === 0 && !manual?.entryISO && !manual?.exitISO;
    const missing = (policy.requireCheckIn !== false && paired.missingEntry) || (policy.requireCheckOut !== false && paired.missingExit);
    const decision = noPunch ? policy.noPunch === "review" ? "incomplete" : "absent"
      : missing ? policy.missingRequiredPunch === "absent" ? "absent" : "incomplete"
      : "present";
    return { ...display, durationMeasured: paired.pairs.length > 0,
      punchQuality: noPunch ? "noPunch" : paired.missingEntry ? "missingEntry" : paired.missingExit ? "missingExit" : "ok",
      attendanceCredit: decision === "present", decision };
  }
  if (policy.punchMode === "legacy" && hasDirectionalPdksCheckpoints(policy)) {
    // A `both` point retains legacy first/last semantics regardless of its stored
    // direction; one-way points may supply only their designated endpoint.
    const firstISO = manual?.entryISO ?? readings.find(r => resolvePdksCheckpoint(r, policy)?.pointType !== "exit")?.accessTime ?? null;
    const lastISO = manual?.exitISO ?? [...readings].reverse().find(r =>
      resolvePdksCheckpoint(r, policy)?.pointType !== "entry" && (!firstISO || Date.parse(r.accessTime) > Date.parse(firstISO)))?.accessTime ?? null;
    const durationMeasured = !!firstISO && !!lastISO && Date.parse(lastISO) > Date.parse(firstISO);
    const attendanceCredit = !!firstISO || !!lastISO;
    return { firstISO, lastISO, durationMeasured, punchQuality: durationMeasured ? "ok" : firstISO ? "missingExit" : lastISO ? "missingEntry" : "noPunch", attendanceCredit, decision: attendanceCredit ? "present" : "absent" };
  }
  if (policy.punchMode === "legacy") {
    const firstISO = manual?.entryISO ?? readings[0]?.accessTime ?? null;
    const singleFlexibleExit = options?.scheduleType === "flexible" && manual?.entryISO && readings.length === 1
      && readings[0]?.direction === "exit" && Date.parse(readings[0].accessTime) > Date.parse(manual.entryISO)
      ? readings[0].accessTime : null;
    const lastISO = manual?.exitISO ?? singleFlexibleExit ?? (readings.length > 1 ? readings[readings.length - 1]?.accessTime ?? null : null);
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
