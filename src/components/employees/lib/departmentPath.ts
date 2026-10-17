export function departmentPath(
  id: string,
  departments: readonly {
    _id: string;
    name: string;
    parentId?: string | null;
  }[],
): string {
  const parts: string[] = [];
  const seen = new Set<string>();
  let current: string | undefined = id;
  while (current && !seen.has(current)) {
    seen.add(current);
    const department = departments.find((item) => item._id === current);
    if (!department) break;
    parts.unshift(department.name);
    current = department.parentId ?? undefined;
  }
  return parts.join(" / ");
}
