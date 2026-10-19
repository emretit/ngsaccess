/** Keep the period and unrelated URL state when changing project scope. */
export function projectScopedPdksParams(
  params: URLSearchParams,
  previousProjectId: string | undefined,
  projectId: string | undefined,
): URLSearchParams {
  if (!previousProjectId || previousProjectId === projectId) return params;
  const next = new URLSearchParams(params);
  for (const key of ["company", "dept", "pos", "shift", "person", "employeeId"])
    next.delete(key);
  return next;
}
