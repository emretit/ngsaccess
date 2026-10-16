/** Kapatma yalnız görünürlüğü etkiler; başarısızlık sayımı değişmez. */
export function summarizeSyncRows(
  rows: ReadonlyArray<{ status: string; dismissedAt?: number }>,
) {
  return {
    inFlight: rows.filter((row) => ["pending", "sent", "processing"].includes(row.status)).length,
    failed: rows.filter((row) => row.status === "failed").length,
    dismissedFailed: rows.filter((row) => row.status === "failed" && row.dismissedAt !== undefined).length,
  };
}

export function decideSyncStatus(
  ide: ReturnType<typeof summarizeSyncRows>,
  hik: ReturnType<typeof summarizeSyncRows>,
  unknown: boolean,
  lastVerifiedAt: number | null,
) {
  const inFlight = ide.inFlight + hik.inFlight;
  const failed = ide.failed + hik.failed;
  return {
    ide, hik, inFlight, failed,
    dismissedFailed: ide.dismissedFailed + hik.dismissedFailed,
    hasMore: unknown,
    unknown,
    lastVerifiedAt,
    upToDate: !unknown && inFlight === 0 && failed === 0 && lastVerifiedAt !== null,
  };
}

/** Sınır her proje/status index aralığına uygulanır; eski kayıtlarda kapsam cihazdan çözülür. */
export async function scanSyncScope<P extends string, S extends string, R extends { projectId?: P }>(
  projectIds: P[],
  statuses: readonly S[],
  read: (projectId: P | undefined, status: S, limit: number) => Promise<R[]>,
  resolveLegacyProject: (row: R) => Promise<P | undefined>,
  limit = 200,
) {
  const rows: R[] = [];
  let hasMore = false;
  let unknown = false;
  for (const projectId of [...projectIds, undefined]) {
    for (const status of statuses) {
      const batch = await read(projectId, status, limit + 1);
      hasMore ||= batch.length > limit;
      for (const row of batch.slice(0, limit)) {
        if (projectId !== undefined) {
          rows.push(row);
          continue;
        }
        const resolved = await resolveLegacyProject(row);
        if (resolved === undefined) unknown = true;
        else if (projectIds.includes(resolved)) rows.push({ ...row, projectId: resolved });
      }
    }
  }
  return { rows, hasMore, unknown: unknown || hasMore };
}

export function syncDismissPatch<T extends string>(userId: T, now: number) {
  return { dismissedAt: now, dismissedBy: userId };
}

export function canRetrySync(status: string) {
  return status === "failed";
}
