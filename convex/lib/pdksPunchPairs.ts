export type PunchReading = { accessTime: string; direction?: string };
export type PunchPair = { entryISO: string; exitISO: string };
type DirectedPunch = { accessTime: string; direction: "entry" | "exit" };
const byTime = (a: PunchReading, b: PunchReading) => Date.parse(a.accessTime) - Date.parse(b.accessTime);

/** Input directions have already been resolved by the shared PDKS source filter.
 * Opposite explicit directions are never debounced: even a short visit is real.
 * Repeats are debounced against the last accepted punch; undirected punches alternate against the current state. */
function resolvePdksPunches(readings: readonly PunchReading[], minIntervalMinutes: number): DirectedPunch[] {
  const resolved: DirectedPunch[] = [];
  let openTime: number | undefined;
  let accepted: PunchReading | undefined;
  for (const reading of readings) {
    const time = Date.parse(reading.accessTime);
    if (!Number.isFinite(time)) continue;
    const directed = reading.direction === "entry" || reading.direction === "exit";
    const acceptedDirected = accepted?.direction === "entry" || accepted?.direction === "exit";
    const repeat = accepted && (reading.direction === accepted.direction || (!directed && !acceptedDirected));
    const delta = accepted ? time - Date.parse(accepted.accessTime) : Infinity;
    if (repeat && delta >= 0 && delta < minIntervalMinutes * 60000) continue;
    accepted = reading;
    const direction = reading.direction === "entry" || reading.direction === "exit" ? reading.direction : openTime !== undefined ? "exit" : "entry";
    resolved.push({ accessTime: reading.accessTime, direction });
    if (direction === "entry") openTime ??= time;
    else if (openTime !== undefined && time > openTime) openTime = undefined;
  }
  return resolved;
}

/** Single state machine for entry/exit matching; a missing side is null. Shared by the calculation
 * (pairPdksPunches) and the display (pdksPunchSegments) so the two cannot drift apart. */
function visitsOf(readings: readonly PunchReading[], minIntervalMinutes: number) {
  const visits: Array<{ entryISO: string | null; exitISO: string | null }> = [];
  let open: string | undefined;
  for (const punch of resolvePdksPunches(readings, minIntervalMinutes)) {
    if (punch.direction === "entry") open ??= punch.accessTime;
    else if (!open) visits.push({ entryISO: null, exitISO: punch.accessTime });
    else if (Date.parse(punch.accessTime) > Date.parse(open)) {
      visits.push({ entryISO: open, exitISO: punch.accessTime });
      open = undefined;
    }
  }
  if (open) visits.push({ entryISO: open, exitISO: null });
  return visits;
}
const completeVisits = (visits: ReturnType<typeof visitsOf>): PunchPair[] =>
  visits.flatMap(({ entryISO, exitISO }) => entryISO && exitISO ? [{ entryISO, exitISO }] : []);

export function pairPdksPunches(readings: readonly PunchReading[], minIntervalMinutes = 1) {
  const visits = visitsOf(readings, minIntervalMinutes);
  const pairs = completeVisits(visits);
  return {
    pairs,
    totalMinutes: Math.floor(pairs.reduce((sum, pair) => sum + (Date.parse(pair.exitISO) - Date.parse(pair.entryISO)) / 60000, 0)),
    missingEntry: visits.some(visit => !visit.entryISO),
    missingExit: visits.some(visit => !visit.exitISO),
  };
}

/** A manual side replaces that endpoint, preserving interior punches. Directions are resolved before the
 * manual exit is applied, so an undirected last punch that opens a visit is kept and closed by it. */
export function pdksPairReadings(readings: readonly PunchReading[], manual?: { entryISO?: string; exitISO?: string }, minIntervalMinutes = 1): PunchReading[] {
  const sorted = [...readings].sort(byTime);
  const withExit = (raw: readonly PunchReading[]): DirectedPunch[] => {
    const resolved = resolvePdksPunches(raw, minIntervalMinutes);
    if (!manual?.exitISO) return resolved;
    if (resolved[resolved.length - 1]?.direction === "exit") resolved.pop();
    return [...resolved, { accessTime: manual.exitISO, direction: "exit" as const }].sort(byTime);
  };
  if (!manual?.entryISO) return withExit(sorted);
  const entry = { accessTime: manual.entryISO, direction: "entry" as const };
  const replaced = withExit([entry, ...(sorted[0]?.direction === "exit" ? sorted : sorted.slice(1))].sort(byTime));
  if (sorted[0] === undefined || sorted[0].direction === "entry" || sorted[0].direction === "exit") return replaced;
  // An undirected first punch is either the corrected entry or the first exit after a forgotten entry:
  // keep it only when that leaves fewer unmatched sides (ties keep the replacement).
  const added = withExit([entry, ...sorted].sort(byTime));
  const unmatched = (punches: DirectedPunch[]) => {
    const result = pairPdksPunches(punches, minIntervalMinutes);
    return Number(result.missingEntry) + Number(result.missingExit);
  };
  return unmatched(added) < unmatched(replaced) ? added : replaced;
}

/** Display-only visits retain missing sides; breaks span consecutive complete visits, so a stray
 * one-sided punch between two visits does not hide the break around it. */
export function pdksPunchSegments(readings: readonly PunchReading[], minIntervalMinutes = 1) {
  const pairs = visitsOf(readings, minIntervalMinutes);
  const complete = completeVisits(pairs);
  const breaks = complete.flatMap((next, i) => {
    const previous = complete[i - 1];
    const minutes = previous ? Math.floor((Date.parse(next.entryISO) - Date.parse(previous.exitISO)) / 60000) : 0;
    return previous && minutes > 0 ? [{ startISO: previous.exitISO, endISO: next.entryISO, minutes }] : [];
  });
  return { pairs, breaks, breakMinutes: breaks.reduce((sum, gap) => sum + gap.minutes, 0) };
}
