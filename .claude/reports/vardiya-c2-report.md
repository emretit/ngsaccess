# Vardiya C2 — PDKS sunumu

- `src/components/pdks/lib/presentation.ts:10`: API'den türeyen segment tipi, birleşik vardiya adı, İstanbul saat biçimi, erişilebilir hücre etiketi; karar/plan çözümlemesi yok.
- `src/components/pdks/dashboard/PdksPlanSummary.tsx:5`: birleşik ad + N vardiya rozeti veya mevcut hafta tatili tonunda Boş gün (döngü).
- `src/components/pdks/dashboard/PdksDaySegments.tsx:5`: segment başına plan/gerçek saatler, toplam, geç/erken süreleri, Geldi/Gelmedi/İncelenecek ve manuel düzeltme notu.
- `src/components/pdks/dashboard/PDKSTableView.tsx:154`, `PDKSMobileCardList.tsx:50`, `PDKSHeatmapView.tsx:110`: günlük plan özeti; toplu dönem satırına tek gün planı uygulanmaz, sunucunun mevcut ilk/son saatleri ve durumları korunur.
- `src/components/pdks/dashboard/PDKSEmployeeDetailDrawer.tsx:142`: plan özeti ve segment detayı; çoklu/boş günde eski çalışan vardiya başlığını gizler.
- `src/components/pdks/dashboard/shiftPlans.test.tsx:40`: 6 yeni test; üç görünüm, üç karar, süreler, rest, eski çıktı, dönem ve İstanbul saatleri.

Doğrulama: `tsc --noEmit -p tsconfig.app.json` 0 hata; `eslint src` 0 hata/uyarı; `vitest run src` 190 dosya / 1234 test başarılı.

Export değişmedi: mevcut katalogda vardiya sütunu yok; koordinatörün C2 sorusuna yanıtıyla bu madde kapsamdan çıkarıldı ve ileride ayrı iş olacak.
B DTO'sunda eksik bulunmadı; statusMeta ve Convex değiştirilmedi; açık soru yok; tarayıcı/dev server açılmadı.
