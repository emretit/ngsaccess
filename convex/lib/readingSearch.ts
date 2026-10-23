// Canlı İzleme araması: sunucu (listFiltered) ve tarayıcı (bugünün canlı satırları) aynı kuralı kullanır.

/** Okuma araması: boşluklar sadeleşir, 8 sözcük/100 karakterle sınırlanır; boşsa arama yok. */
export function readingSearchTerm(search?: string): string | undefined {
  // Convex arama dizini en fazla 16 terim kabul eder.
  const term = search?.trim().split(/\s+/).slice(0, 8).join(" ").slice(0, 100);
  return term || undefined;
}

/** Arama dizini sözcüklerden herhangi birine uyanı döndürür; burada her sözcük ad/soyad sözcüklerinden birinin başı olmalı. */
export function matchesPersonSearch(person: { firstName?: string; lastName?: string }, term: string): boolean {
  const words = `${person.firstName ?? ""} ${person.lastName ?? ""}`.toLocaleLowerCase("tr-TR").split(/\s+/).filter(Boolean);
  return term.toLocaleLowerCase("tr-TR").split(" ").every(token => words.some(word => word.startsWith(token)));
}

/** Okuma araması: tam kart numarası ya da kişi adı/soyadı sözcük başı. */
export function matchesReadingSearch(reading: { cardNo: string; employeeName?: string }, term: string): boolean {
  return reading.cardNo === term || matchesPersonSearch({ firstName: reading.employeeName }, term);
}
