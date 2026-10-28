# Refaktör W2 — PDKS Kayıtları sayfası (PDKSRecords)

Hedef: `src/pages/PDKSRecords.tsx` (502 satır, 11 useState) sayfa dosyası ~150 satır altı bir kompozisyona iner; türetilmiş hesaplar ve yan paneller ayrı dosyalara taşınır; davranış birebir aynı kalır ve `src/components/pdks/auditPage.test.tsx` yeşil kalır.

Ownership (yalnız bunlara yaz):
- src/pages/PDKSRecords.tsx
- YENİ dosyalar yalnız src/components/pdks/records/ altında (klasör yoksa oluştur; ör. usePdksRecordsView.ts, PdksCounters.tsx, PdksAssistantSheet.tsx, PdksWarningsSheet.tsx, PdksDatesSheet.tsx, PdksPeriodSwitcher.tsx)
- src/components/pdks/auditPage.test.tsx: YALNIZ import yolu kırılırsa import satırı
- DOKUNMA: src/components/pdks/dashboard/PDKSEnhancedExportPanel.tsx (başka oturumun commit'siz işi var), usePdksTableData ve diğer mevcut pdks bileşenleri.

Önerilen yapı:
1. Türetilmiş durum: smart preset filtresi, `scope` anahtarı, `selectedIds` (scope uyuşmazsa boş küme), `detail`, `summary`, `exportRows`, `hasFilters`, `filterSummary`, `passive()`/`inProgress`/`counters` hesapları → saf fonksiyon(lar) + ince hook. Saf kısım için küçük birim testi ekle (ör. scope değişince seçim sıfırlanır; future sayacından inProgress düşülür).
2. Üç Sheet (Asistan, Uyarılar, Tarih ve kayıtlı görünümler) ayrı bileşenler; open/onOpenChange davranışı (datesOpen'ın onOpenChange içindeki ek mantığı dahil) AYNEN.
3. Dönem seçici (Günlük/Haftalık/Aylık, dateRange sıfırlama) ve sayaç şeridi ayrı bileşen.
4. `detailTrigger` odak-geri-verme mantığı (document.activeElement) korunur.
5. Default export ve route kullanım şekli değişmez.

Kapsam dışı: backend, export paneli, metin/tasarım değişikliği, R8 PDKS hesap farkları.

Vitest: `node_modules/.bin/vitest run src/components/pdks src/pages` (auditPage + yeni testler yeşil; başka oturumların yarım işinden gelen alakasız kırmızı varsa dosya adıyla raporla, düzeltme)
Rapor yolu: /tmp/refaktor-w2-rapor.md
