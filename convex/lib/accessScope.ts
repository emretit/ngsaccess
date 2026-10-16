/** Aynı projeye erişebilmek, projeler arasında ilişki kurma izni değildir. */
export function assertSameAccessProject(
  projectId: string | undefined,
  record: { projectId?: string } | null,
  label: string,
): void {
  if (!projectId) throw new Error("Önce bir proje seçin");
  if (!record) throw new Error(`${label} bulunamadı`);
  if (record.projectId !== projectId) throw new Error(`${label} aynı projede olmalıdır`);
}

export function assertAccessProjectUnchanged(projectId: string | undefined, requested?: string): void {
  if (requested !== undefined && requested !== projectId) {
    throw new Error("Kayıt farklı bir projeye taşınamaz");
  }
}
