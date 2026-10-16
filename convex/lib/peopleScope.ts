export function assertPeopleProject(projectId: string | undefined, relatedProjectId: string | undefined, label: string): void {
  if (!projectId || projectId !== relatedProjectId) {
    throw new Error(`${label} aynı projede olmalıdır`);
  }
}

export function assertUploadOwner(ownerId: string | undefined, userId: string): void {
  if (ownerId !== userId) throw new Error("Bu fotoğrafa yalnız yükleyen kullanıcı erişebilir");
}

export function assertEmployeePhotoClaim(ownerId: string | undefined, userId: string, linkedEmployeeId?: string, employeeId?: string): void {
  if (ownerId !== undefined) assertUploadOwner(ownerId, userId);
  else if (!employeeId || linkedEmployeeId !== employeeId) throw new Error("Fotoğraf yükleme sahipliği doğrulanamadı");
  if (linkedEmployeeId && linkedEmployeeId !== employeeId) throw new Error("Fotoğraf başka bir personele bağlı");
}
