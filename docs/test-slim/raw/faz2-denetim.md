# Faz 2 diff denetimi (salt okuma)

Sonuç: kayıp benzersiz davranış assertion'ı YOK, yanlış silinen kaynak YOK. 0 yüksek, 0 orta, 3 düşük bulgu.

## Bulgular

| Önem | Dosya:satır | Ne kayboldu/yanlış | Önerilen düzeltme |
|---|---|---|---|
| düşük | mobile/test/ui_redesign/d1/metric_row_layout_test.dart:31 | `for (final dark in [false])`: 308/200dp geometri case'lerinde dark tamamen düştü (önce 4 case, şimdi 2). Plan (LISTE.md:52-55) metric_row için matris daraltma listelemiyor, yalnız "kit_d3_additions birleştir (−1)" diyor; tema uç değeri bu testte artık yok. Diğer case 900dp/%200 yalnız light. | Ya `[false]` yerine `[width == 308 ? false : true]` benzeri karışım (308 light + 200 dark), ya da bilinçli kabul. |
| düşük | mobile/test/{visitor_provider_test.dart:12, providers/request_provider_test.dart:10, widgets/history_screen_test.dart:17} | Kaynak `_test.dart` dosyaları helper'ı `export` ediyor; sebep `screenshot_test/_harness.dart:23-26` hâlâ bu test dosyalarını import ediyor. "Test başka testi import etmesin" hedefi harness üzerinden dolaylı sürüyor. Davranış kaybı yok. | `_harness.dart` importlarını `test/helpers/*` yoluna çevir (kapsam dışı olduğu için yapılmamış), sonra 3 export satırını sil. |
| düşük | src/components/{admin/components/AdminListParts, alarms/AlarmFilters, devices/DeviceFilters, employees/EmployeeFilters, pdks/dashboard/auditFixes, reports/auditFixes, settings/.../HolidayCalendarManager, visitors/VisitorFilters}.test.tsx | `grid w-full min-w-0 gap-1 text-xs min-[761px]:w-40` / `min-[761px]:w-40` sınıf assertion'ları 8 dosyada silindi (5 satır sayımı + toHaveLength'ler). LISTE.md'de bu dosyalar tek tek listelenmiyor; yalnız genel karar var (LISTE.md:8 "CSS sınıf testleri silinsin → EVET"). Karar kapsamında; tutarsızlık: `src/components/leaves/LeaveAudit.test.tsx:41` aynı tür assertion'ı koruyor. | Bilgi: onaylı karar kapsamında. İstenirse LeaveAudit.test.tsx:41 de silinir. |

## Kontrol edildi, sorun yok

Mobil A
- `git diff -w -U0 -- mobile/test` kaldırılan her satırı (importlar + taşınan yardımcı tanımları) mevcut test+helpers içeriğiyle satır satır karşılaştırdım (`comm`): eşleşmeyen kaldırılan satırlar yalnız (a) göreli `_test.dart` importları ve (b) 3 matris döngü/guard satırı. Hiçbir `test(`/`testWidgets(`/`expect(`/`group(` satırı kaldırılmamış; hiçbir case gövdesi değişmemiş.
- 12 yeni helper dosyasını eski tanımlarla okudum (wrapLogin, app(visitor), app(history/request), RequestFakeRepository/testLeave/testCorrection, MemoryOperationStore/FakeOperationRepository/receipt/scopeA/storedIntent, operationJson, contrast, MockCameraController, RecordingVisitors): kopya birebir, davranış aynı.
- Rapor: dosya başına case sayısı A sonrası 863=863.

Mobil B
- ui_kit: light/%100 + dark/%200 kalıyor; RV ve davranış grupları dokunulmamış.
- d3a/layout_states: `compact in [dark]` → light/390/100 + dark/320/200; filtre kapatma + withdraw iptali case'leri diff'te yok (dokunulmamış).
- d2a/layout_states: `scale in [dark ? 2.0 : 1.0]`; 390→320 genişlik eşlemesi korunmuş (satır ~176); `if (scale==1)` capture guard kaldırıldı = yalnız golden üretimi, assertion değil.
- d3b/visitor_layout: light 390/100 + dark 320/200; d2b/splash: 320×568/%200, TR-light + EN-dark, retry/login callback assertion'ları aynı (EN'in TR matrislere eklenmemesi onaylı).

Web
- DeviceCommandCenter.audit (5 case) + DeviceOfflineConfirmation (1 case) → `DeviceCommandCenter.test.tsx`: project_user (yalnız "Kapıyı aç", 8 etiket yok), doors.open=false, CIH-11 (4 kombinasyon), kuyruk-sınırı, offline wording (3 kombinasyon) birebir var; offline-onay (4 kombinasyon, split length 3 + "komut başarısız olabilir" yok) aynen var; DeviceAudit'ten taşınan "çevrimdışı panelde kapı açma etkin..." case'i tüm 6 assertion'ıyla var. Bölümler artık mock değil gerçek render (daha güçlü). Çalıştırdım: DeviceCommandCenter.test.tsx + DeviceAudit.test.tsx → 22/22 geçti. Not: yeni dosya untracked (commit'e `git add` gerekir), eski ikisi `D`.
- monitoringAudit "source filter URL" case'i → `lib/readings.test.ts` taşındı (assertion'lar aynı, projectId → "project"); readings.test'teki mevcut round-trip case'ine `source: "biometric"` EKLENDİ (güçlendirme). monitoringAudit'te kullanılmayan import'lar temizlenmiş.
- `expectLabel` (9 dosyada kopya) → `src/test-utils/filterLabel.ts`: yeni hali ZAYIF DEĞİL, eskiden güçlü: etiket regex'te `escapeRegExp`, kontrol sayısı tam 1 (`toHaveLength(1)`, eskiden yalnız ilk eşleşme), `aria-labelledby` da yasak, id yoksa throw. Eski assertion'ların hepsi (null değil, aria-label yok, for= sayısı 1) duruyor.
- Planda olmayan case silinmesi: yok (silinenler yalnız yukarıdaki sınıf assertion'ları, onaylı karar kapsamında).
