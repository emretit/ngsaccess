### Koordinatörün cardReadings.ts entegrasyonu (bu worker dosyaya yazmadı)
1. `convex/cardReadings.ts:5` kaynak import'una `countExcludedUnknownPdksReadings` ekle.
2. `:492` ve `:1333` öncesinde, ilgili handler kapsamında aşağıdaki satırı ekle (bordro :678'e gerek yok):
```ts
const sourceReadings = readings;
```
`filterPdksReadings` yeni array döndürür; ham referans korunur.
3. Tablo `:557` tableWorkDate tanımından sonra:
```ts
const tablePeriodDates = new Set(periodDateKeys);
const sourceReadingsByEmployee = buildPdksEmployeeReadingMap({
  employees,
  readings: sourceReadings.filter(r => tablePeriodDates.has(tableWorkDate(r))),
});
```
4. Tablo `:576` içindeki `return computePdksTableRow({...});` yerine `const row = computePdksTableRow({...});` yap ve çağrı sonrasına (yaklaşık :609) ekle:
```ts
return {
  ...row,
  excludedUnknownReadings: countExcludedUnknownPdksReadings(
    sourceReadingsByEmployee.get(empKey) ?? [],
    employee?.projectId,
  ),
};
```
5. Detay `:1387` detailWorkDate sonrasında:
```ts
const detailPeriodDates = new Set(periodDateKeys);
const excludedUnknownReadings = countExcludedUnknownPdksReadings(
  sourceReadings.filter(r => detailPeriodDates.has(detailWorkDate(r))),
  employee.projectId,
);
```
6. Detay `:1410` employee alanından önce, return object üst seviyesine `excludedUnknownReadings,` ekle. UI contract ÜST SEVİYE alanı bekler (summary/days içinde değil).

Bu entegrasyonun çalışma günü süzgeci önemlidir: sorgu ertesi takvim gününü de okur; o günün ayrı vardiyasını sayıya dahil etmemeli. Ham diziler handler'ın mevcut yetki/proje/çalışan kapsamından gelir; kaynak sınıflandırması/devamsız kararı değişmez.
