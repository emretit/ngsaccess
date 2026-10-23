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

export function pairPdksPunches(readings: readonly PunchReading[], minIntervalMinutes = 1) {
  const pairs: PunchPair[] = [];
  let open: string | undefined;
  let missingEntry = false;
  for (const punch of resolvePdksPunches(readings, minIntervalMinutes)) {
    if (punch.direction === "entry") open ??= punch.accessTime;
    else if (!open) missingEntry = true;
    else if (Date.parse(punch.accessTime) > Date.parse(open)) {
      pairs.push({ entryISO: open, exitISO: punch.accessTime });
      open = undefined;
    }
  }
  return { pairs, totalMinutes: Math.floor(pairs.reduce((sum, pair) => sum + (Date.parse(pair.exitISO) - Date.parse(pair.entryISO)) / 60000, 0)), missingEntry, missingExit: open !== undefined };
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
