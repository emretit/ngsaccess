export type ChatPerson = { employeeId?: string; employeeName?: string | null; name?: string | null };

/** Aynı veri kümesinde aynı kişi aynı etiketi alır. Kimlik yoksa normalize ad kullanılır. */
export function maskChatNames<T extends ChatPerson>(rows: readonly T[], enabled = true): T[] {
  if (!enabled) return rows.map(row => ({ ...row }));
  const labels = new Map<string, string>();
  return rows.map(row => {
    const name = row.employeeName?.trim() || row.name?.trim();
    if (!name) return { ...row };
    const key = row.employeeId || name.toLocaleLowerCase("tr-TR").replace(/\s+/g, " ");
    let label = labels.get(key);
    if (!label) { label = `Personel ${labels.size + 1}`; labels.set(key, label); }
    return {
      ...row,
      ...("employeeName" in row ? { employeeName: label } : {}),
      ...("name" in row ? { name: label } : {}),
    };
  });
}
