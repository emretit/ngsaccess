export function assertDepartmentAncestors(departmentId: string, ancestorIds: readonly string[], truncated = false): void {
  if (ancestorIds.includes(departmentId)) {
    throw new Error("Departman kendi alt departmanının altına taşınamaz");
  }
  if (new Set(ancestorIds).size !== ancestorIds.length || truncated) {
    throw new Error("Departman hiyerarşisi doğrulanamadı (döngü veya 50 adım sınırı)");
  }
}
