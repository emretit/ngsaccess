# Geçiş Kontrol Dalga 2 — çapraz denetim

**Karar: Geçti (küçük düzeltmelerle).** Engel yok. 1 Önemli, 5 Küçük bulgu; hepsi commit'i bloklamaz, Önemli olan (GK-1) commit öncesi düzeltilmesi önerilir.

## Kapılar (denetçi koşumu)
| Kapı | Sonuç |
|---|---|
| `tsc --noEmit -p tsconfig.app.json` | 0 hata |
| `tsc --noEmit -p convex/tsconfig.json` | 0 hata |
| `eslint src/components/access-control convex/accessGrantStatus.ts` | 0 hata/uyarı |
| `vitest run src/components/access-control convex/accessGrantStatus.test.ts` | 25 dosya, 219 test geçti |

Koordinatörün sonradan eklediği `StatusCounters.tsx:18-19` `personCount` guard'ı + "eski Convex sürümü" testi de denetlendi: doğru (sayı değilse kişi kısmı hiç yazılmıyor, "undefined" çıkmıyor).

## Madde madde doğrulama
- **A:** 01-O4 (SyncRuns açıklaması, onay metni, sihirbaz alt özeti `ruleDaysSummary`), 01-O8 (panel→cihaz, AccessRuleDetails/ZoneDeviceTree/accessRulesListModel), 01-D2 (sayaç + `onCount` zinciri tamamen kalktı), 01-D3 (iç başlıklar kalktı, `role="group"` + aria-label korundu), TemplatePicker boş durumu, Kurallar başlığı → hepsi yapılmış.
- **B:** 02-O1, 02-O5, 03-D1 (Bilinmiyor notu yalnız >0; "Kuralın kendi saati"), 03-O2 (kapsam satırı + "Filtre sonucu: K kayıt"), rozet `aria-pressed`, iki sekme başlığı → hepsi yapılmış.
- **C:** 04-O2 (Plan etkin değil, Sürekli açık/kilitli), 04-O3 (Tatil takvimini aç + ilk 10 tarih + "ve N tarih daha"), DoorSaveResults `saved` koşulu, Kapı Planları başlığı → yapılmış. Tatil bağlantısı `PDKS_SETTINGS_PATH` = `/pdks-records/settings` (App.tsx:79, `HolidayCalendarManager` orada render ediliyor) ve `guard.requestClose` üzerinden → doğru rota, guard'dan geçiyor.
- **Dört sekme başlığı** aynı kalıpta (H1 `text-xl font-semibold` + `text-sm text-muted-foreground` açıklama, spec metinleri birebir).
- **Dalga 1 korunmuş:** Kaydet ve cihaza gönder, etki özeti, Cihaza tekrar gönder, rozet=filtre=sayaç testleri yeşil; R4 testi `onSuccess` çağrılmamasını da sınıyor.
- **TemplatePicker 3 çağıran:** CreateRuleDialog (TimeSchedule `onEditTemplate`) ve DoorPlanDialog (`guard.requestClose`) onayı atlamıyor. CopyDoorPlansDialog `onEdit` vermiyor (bkz. GK-4).
- **`convex/accessGrantStatus.ts` `personCount`:** yalnız alan ekleme; ek `db` okuması/tarama yok (Set, zaten okunan satır ve zaten dönülen graph çiftleri üzerinde). Tüketici yalnız `status/model.ts` (`FunctionReturnType`) + `StatusPage.tsx` `counts` çağrıları; tip genişlemesi olduğu için kırılma yok. Test benzersiz kişi, arama bağımsızlığı, departman, cihaz kapsamını sınıyor.
- **CLAUDE.md:** yeni kodda `any`/`!` yok, alan adları camelCase.

## Bulgular
| ID | Önem | Dosya:satır | Sorun | Öneri |
|---|---|---|---|---|
| GK-1 | Önemli | `door-plans/DoorPlanDialog.tsx:134-135`, `door-dialog/DoorSaveResults.tsx` | Diyalog açılışında kayıtlı `hikPlanApplyError` varken (planResults boş) banner artık yalnız "Son gönderim başarısız" yazıyor; hata nedeni diyalogda hiçbir yerde görünmüyor (sonuç kutusu `planResults.length > 0` ile açılıyor). Önceden neden metni banner'daydı. Yinelenen hata çözülürken kalıcı hata ayrıntısı kayboldu. | Yalnız `failedKeys.length === 0 && door.hikPlanApplyError` durumunda nedeni banner'a ekle (`errorMessage(door.hikPlanApplyError)`); planResults varken tekrar yazma. Test: kayıtlı hata + planResults boş → neden görünür. |
| GK-2 | Küçük | `unified/templates/TemplatePicker.tsx:34,45-` | Yalnız arşivli şablon varken "Bu projede henüz zaman şablonu yok." yazıyor (testte bilinçli ama metin kısmen yanlış). Boş durumda `aria-invalid`/hata bağı da düşüyor (select yok). | Metni "Seçilebilir zaman şablonu yok." yap ya da arşivli varsa farklı cümle; zorunlu-alan hatası boş durumda başka yerde görünüyor mu kontrol et. |
| GK-3 | Küçük | `access-control/MoveReaderDialog.tsx:119` | Kullanıcıya görünen "Bu panelde taşınabilecek boş kapı yok." kaldı (grep'te tek kullanıcı metni). Kapsam dışı dosya. | "Bu cihazda…" yap (sonraki dalga/ayrı küçük düzeltme). |
| GK-4 | Küçük | `door-plans/CopyDoorPlansDialog.tsx:148` | `TemplatePicker` `onEdit` olmadan → "Zaman şablonu oluştur" doğrudan `tab=templates`'e gider; diyalogdaki seçili kapı/şablon seçimi sessizce kaybolur (kaydedilmemiş değişiklik onayı yok). Spec yalnız metin değişikliğine izin veriyordu. | Dalga 3: `onEdit` ile guard bağla veya diyalogu kapatıp git. |
| GK-5 | Küçük | `unified/status/RedistributeControls.tsx:112` | "kaydedilme sırasıyla" ifadesi eski "indeks sırasıyla"nın sade çevirisi olarak kesin doğru olmayabilir (sıra by_project_state indeksine göre). | "Hatalı kayıtlar sırayla gönderilir (her seferinde en fazla 100)" gibi sıra iddiası olmayan cümle. |
| GK-6 | Küçük | `unified/AccessRulesList.tsx:38-58` | `PageHeader` yerine elle başlık: proje adı/"Erişim kuralları" kapsam satırı kalktı (yalnız açıklama var). Spec bunu istiyor; başka sekmelerle tutarlı. Not: PageHeader'ın sağladığı mobil/ortak davranış (varsa) elle çoğaltıldı. | Bilgi; aksiyon gerekmez. |

## Testler (davranış sınıyor mu)
- Güçlü: TemplatePicker (onEdit çağrısı, URL param temizliği, canManage, arşivli/yükleniyor), DoorPlanDialog (guard çağrısı + navigate sonrası, 11 tarih → 10 li + "ve 1 tarih daha", `saved=false` iken "veritabanına kaydedildi" yok, hata metni 1 kez), status (özet arama/durum filtresiyle değişmez, aria-pressed sayısı 6), convex (benzersiz kişi, arama bağımsızlığı).
- Zayıf/yalnız metin: `DoorPlanDialog.test` 04-H1 artık hata nedenini aramıyor (GK-1'i gizliyor); `RulesHeader.test` ve `AccessRuleDetails` testi metin düzeyinde (kabul için yeterli).
- Eksik: CopyDoorPlansDialog + TemplatePicker (onEdit'siz) testi yok (GK-4).

## Kalan "panel" sınıflaması
Kullanıcı metni: yalnız `MoveReaderDialog.tsx:119` (GK-3). Geri kalanı kod adı/yorum/değişken (`rule.panels`, `panel.label`, `ReadingDetailPanel`, `selectionHelpers.ts` yorumu, `useRuleForm.ts` yorumu, `EditReaderDialog` yorumları).
