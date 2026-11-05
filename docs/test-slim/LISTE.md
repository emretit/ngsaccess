# Test sadeleştirme listesi — 2026-11-04

## Durum
- [x] Envanter: 584 dosya (convex 239 · web src 266 · mobil 79)
- [x] Süre ölçümü: vitest 5.573 case / 17 dk · flutter 867 case / 21 dk (4 ajan aynı anda çalışırken ölçüldü, süreler şişik)
- [x] Codex (web: astra high, mobil: sol medium) ve Claude (web: opus high, mobil: sonnet medium) birbirini görmeden listeledi
- [x] Sentez (bu dosya). Ham raporlar: `raw/`
- [x] Emre kararı soru 2: CSS/Tailwind sınıf testleri silinsin → EVET (2026-11-05)
- [x] Faz 1 uygulandı (Codex ×2) + Claude denetimi (0 yüksek / 2 orta) → `raw/faz1-*.md`
  - Denetim sonrası geri konan: `mobile/test/widgets/responsive_container_test.dart` (davranış, CSS değil), `deviceLabels` uuidHelp metni (IDE UUID olayı koruması)
  - Kapılar: tam vitest 488 dosya / 5.532 case 0 fail (60 sn) · tam flutter test 69 dosya / 861 case 0 fail (55 sn) · flutter analyze temiz · tsc app+convex 0
  - Commit pathspec: `.claude/pathspec-test-slim-faz1.txt` (başka oturumun Employees/continueEmployee/todo.md değişiklikleri HARİÇ)
- [x] Faz 1 commit 1d2becb4 (2026-11-05)
- [x] Faz 2 uygulandı (Codex ×2) + Claude denetimi (0 yüksek / 0 orta / 3 düşük) → `raw/faz2-*.md`
  - Web: DeviceCommandCenter 3 dosya → 1, readFilters → `lib/readings.test.ts`, 9 kopya `expectLabel` → `src/test-utils/filterLabel.ts` (case silinmedi)
  - Mobil: test→test import 0 (12 + `qr_fakes` ortak yardımcı `test/helpers/`), görsel matris daraltma 863 → 799
  - Koordinatör düzeltmesi: `screenshot_test` import'ları helpers'a (Faz 2 kırmıştı), 3 artık re-export silindi, `LeaveAudit` son sınıf assertion'ı
  - Kapılar: tam vitest 488 / 5.543 0 fail (50 sn) · flutter test 799 0 fail (31 sn) · `flutter analyze` (screenshot_test dahil) temiz · tsc 0
- [ ] Kalan sorular 1, 3, 4, 5 → Faz 2/3

## DÜZELTME (2026-11-05, Faz 1 sonrası yüksüz ölçüm)
İlk ölçüm 4 ajan aynı anda çalışırken alındı ve **yanıltıcıydı**. Yüksüz makinede:
- Tam vitest **60 sn** (5.532 case, 0 fail) · tam flutter test **55 sn** (861 case, 0 fail). İlk ölçümdeki 63 + 1 kırmızı tamamen yük kaynaklı zaman aşımıydı.
- En yavaş dosya `convex/hikRevocation.test.ts` 35 sn, `accessGrantStatus` 16 sn; paralel koşuda duvar saatinin kuyruğunu bunlar belirliyor.
- Sonuç: Faz 2 (N küçült) kazancı dakikalar değil **~20-30 sn**. Öncelik düştü.

## Ana bulgu (ilk ölçüm — süre rakamları yük altında, yukarıdaki düzeltmeye bak)
Silinecek case sayısı az (~%2). Asıl kazanç **süre**:
- Web: `convex/hikRevocation.test.ts` (600 sn) + `convex/accessGrantStatus.test.ts` (201 sn) = toplam test süresinin **%35'i**.
  Sebep: 500 / 1.200 / 1.500 kayıtlı ölçek testleri. Kırmızı çıkan 63 case'in hepsi zaman aşımı (`STACK_TRACE_ERROR`), çoğu bu ölçek testleri.
- Mobil: görsel matrisler (tema × dil × genişlik × ölçek). Tek başına `d1/ui_kit_test.dart` 101 case / 221 sn.
  `d3b/turkey_time_test.dart` alt süreçte `flutter test` açıyor: 3 case / 217 sn, bu koşuda zaman aşımına düştü.

Tahmini kazanç (Faz 1+2): web ~55 case / ~22 dosya / ~%40 süre · mobil ~70 case / ~9 dosya.

---

## A. İkisinin de önerdiği (güçlü aday)

### Web
| Eylem | Dosya | Case | Not |
|---|---|---|---|
| SİL | `src/lib/statusTone.test.ts` | 5 | Yalnız CSS sınıfı sözlüğü kopyası |
| SİL | `src/lib/deviceBrand.test.ts` | 7 | Sabit marka etiketi (Claude: tek `toEqual`a indir, Codex: sil) |
| SİL | `src/components/devices/DeviceForm.fix1.test.tsx` | 1 | Yalnız `sticky bottom-0` + buton metni, 5 mock |
| SİL | `src/components/employees/EmployeeBulkActions.test.tsx` | 1 | Yalnız Tailwind kırmızı sınıfı |
| SİL / BİRLEŞTİR→`shellAudit` | `src/components/layout/AppSidebarNav.audit.test.tsx` | 1 | Aynı iddia 3 dosyada (`shellAudit:68`, `routeMeta:13`) |
| SİL (case) | `deviceLabels.test.ts:4` · `pdks/dashboard/auditFixes.test.tsx:100` · `shifts/lib/auditFixes.test.tsx:116` · `visitorAudit.test.tsx:62` · `shellAudit.test.tsx:52` | 5 | Yalnız sınıf/sabit metin case'leri; dosyaların geri kalanı (yetki, PDKS, redaction) KORU |
| BİRLEŞTİR → tek `it.each` dosyası | Boş tablo testleri: `CardReadingsTable`, `AuditTable`, `VisitorTable`, `ShiftCalendarGrid`, `ProjectsTable`, `RulesPage` (+ Claude: `StatusViews`, `EngineeringDepartmentView`, `LeaveList`, `PDKSTableView`) | 27 → ~14 | İkisi de çakışmayı gördü; Claude'un "tek tablo-güdümlü dosya" yolu daha sade (−9 dosya). 2026-10-28 boş-tablo kuralı korunur |
| TAŞI + gerçek fixture | `src/components/leaves/leavesBackend.test.ts`, `src/lib/reports/reportTransactions.backend.test.ts` | 11 | Convex handler testi `src/` altında; mock auth'u bypass ediyor. `convex/`a taşı, gerçek Convex fixture kullan |

### Mobil
| Eylem | Dosya | Case | Not |
|---|---|---|---|
| SİL | `test/theme/color_scheme_contract_test.dart` | 2 | 46 rengin hex'ini kopyalıyor; kontrast testi `app_theme_test` içinde zaten var |
| BİRLEŞTİR → `d1/ui_kit_test.dart` | `d1/fix1_test.dart`, `d1/d2_review_test.dart`, `d1/date_range_field_test.dart` | 0-1 | Sprint adlı. **Önce** `mount` yardımcısını `test/helpers/` altına taşı (5 dosya import ediyor) |
| BİRLEŞTİR | `d1/kit_d3_additions_test.dart` → `metric_row_layout` + `ui_kit` | −1 | 200% dikey metrik case'i iki dosyada |
| BİRLEŞTİR → `widgets/requests_screen_test.dart` | `d3a/request_behavior_test.dart` | −1 | İlk geçersiz alan akışı ana testte var |
| BİRLEŞTİR → `login_screen_test` + `app_bottom_navigation_test` | `d5/feedback_test.dart` | 0 | Küçük, konu dosyalarına dağıt |
| MATRİS DARALT | `d2b/splash_screen_test.dart` (4→2), `d3a/layout_states_test.dart` (16→8), `d2a/layout_states_test.dart` (10→6), `d3b/visitor_layout_test.dart` (8→6) | −16 | Uç kombinasyonlar kalsın: light/390/100% + dark/320/200%. Davranış case'leri aynen kalır |

## B. Tek tarafın önerdiği (kontrol ettim)

| Kaynak | Eylem | Dosya | Case | Durum |
|---|---|---|---|---|
| Claude | SİL + **kaynağı da sil** | `convex/lib/pdksChart.test.ts` (+ `pdksChart.ts`) | 7 | ✅ Doğruladım: `pdksChart` yalnız kendi testinden import ediliyor. Codex "ölü kod yok" demişti, bunu kaçırmış |
| Claude | SİL + **kaynağı da sil** | `src/components/pdks/lib/analysis.test.ts` (+ `analysis.ts`) | 4 | ✅ `analyzePdksRows` yalnız 3 test dosyasında kullanılıyor, uygulamada hiç yok. `statusMeta.test.tsx` ve `overtimeSettlement.test.ts` de onu yardımcı olarak kullanıyor, ikisi de düzeltilmeli |
| Claude | **N KÜÇÜLT** | `convex/hikRevocation.test.ts:372` (4 tür × 500 üye) | 4 | En büyük süre kazancı (~9 dk). 1 tür tam ölçekte kalsın, 3'ü küçük N. Orta risk |
| Claude | **N KÜÇÜLT** | `convex/accessGrantStatus.test.ts:567` (1.200 çift), `:610` (1.500 grant) | 2 | `GRANT_LIMIT=1000` (`convex/lib/grantStatus.ts:11`) enjekte edilebilir olursa ~3 dk. Orta risk |
| Claude | N KÜÇÜLT | `ideRoster.audit` (600), `doorTarget` (600), `w5aFix2:11` (20.002 okuma), `shiftPlans` (300), `fixF2Cards:56` (200) | 5 | Her biri 20-26 sn |
| Claude | BİRLEŞTİR → `DeviceCommandCenter.test.tsx` | `DeviceCommandCenter.audit`, `DeviceOfflineConfirmation`, `DeviceAudit:187` | ~1 | Aynı bileşen 3 dosyada, 3 ayrı mock |
| Codex | SİL | `shared/MasterDetailListLayout.test.tsx` (3), `unified/components/TimeSchedule.test.tsx` (1), `unified/UnifiedAccessControl.test.tsx` (1), `public/ProductShot.test.tsx` (1) | 6 | HTML dizgesi / sekme sayısı / sabit boyut kontrolü |
| Codex | SADELEŞTİR (CSS case'leri) | `SettingsSection`, `FormActions`, `DetailFieldList`, `EmployeeTable`, `auditAudit`, `settings/auditFixes`, `CreateRuleDialog` | ~9 | Yalnız sınıf/kopya case'i çıkar, ARIA/yetki/pending kalır |
| Codex | **MATRİS DARALT** | `mobile/test/ui_redesign/d1/ui_kit_test.dart` (23 bileşen × 4 → × 2) | **−46** | Standart koşuda 221 sn. Mobilde en büyük tek kazanç. 9 davranış testi aynen kalır |
| Codex | MATRİS DARALT | `mobile/screenshot_test/screens_screenshot_test.dart` (336 → 56) | −280 | ⚠️ Claude haklı: bu klasör standart `flutter test` içinde yok (README'de elle koşuluyor). Süre kazancı yok, yalnız golden bakımı azalır. Düşük öncelik |
| Claude | SADELEŞTİR | `mobile/test/integration/app_composition_test.dart` | ? | 320 sn. Dil döngüsünü tek dile indir. Router testiyle çakışan 4 senaryo var ("muhtemel", kontrol gerek). Oturum bitişi KORU |
| Claude | SİL | `mobile/test/widgets/responsive_container_test.dart` (2), `visitor_widgets_test.dart` 320/200% case (1), `core/errors_test.dart` trivial case'ler (~5) | ~8 | Düşük risk |
| Ben | AYRI JOB / TZ ENJEKTE | `mobile/test/ui_redesign/d3b/turkey_time_test.dart` | 3 | Alt süreçte `flutter test` açıyor; 217 sn ve zaman aşımı. Saat dilimi regresyonu KORU, ama her koşuda değil |

## C. Dokunulmayacaklar (ikisi de KORU dedi)
- Sprint adlı convex dosyaları (`fixF*`, `w5a*`, `w53Integration`, `e1w4`, `roles.fix1`, `visitorsAudit2`, `ideRoster.audit`, `*.review`): başka dosyayla çakışmayan gerçek olay regresyonları. İsteğe bağlı: modül adına yeniden adlandır (case değişmez).
- Mobil `d3a/fix1_regression_test.dart`, `d3b/fix1_test.dart`: birleştirilebilir ama case silinmez (UTC gün sınırı, consent gating, hesap değişiminde temizlik).
- Yetki/rol, sır gating, PDKS hesapları, Hik/IDE senkronu, "cihaz kişileri otomatik silinmez", `hikDeviceImport` 3 katmanı.

## D. Karar gereken (Emre)
1. **Ölçek testleri** (500-20.002 kayıt): N küçültülüp her koşuda mı kalsın, yoksa tam ölçek ayrı `npm run test:scale` koşusuna mı? → Öneri: ikisi birden (küçük N her koşuda, tam ölçek yayın öncesi).
2. **CSS/Tailwind sınıf testleri** kabul kriteri mi? → Öneri: hayır, sil (A + B'deki ~20 case).
3. **`screenshot_test/` golden matrisi** hâlâ kullanılıyor mu? Kullanılmıyorsa 280 case'lik daraltma + `acceptance/kit_completion_test` QR toleransı da gider.
4. **Legacy PDKS yolu**: canlıda vardiya sürümü olmayan proje kaldı mı? Kalmadıysa `w5aLegacyEquivalence` + `w53Integration` legacy dalı (~15-20 case) kodla birlikte gider.
5. **`vi.mock("react")` kullanan 40 dosya** (hook sırasına bağlı, kırılgan): jsdom + Testing Library ile yeniden yazılsın mı? Ayrı iş, ~1-2 gün, case sayısı aynı kalır.

## Uygulama sırası
- **Faz 1 — düşük risk (~1 sa, 1 worker):** A tablosu + B'deki ölü kaynak + Codex SİL satırları + mobil SİL/BİRLEŞTİR (önce mount helper). Kapı: `tsc` + `eslint` + tam `vitest run` (convex dahil) + `flutter test`.
- **Faz 2 — süre (~1-2 sa):** ölçek testlerinde N küçült (soru 1'e göre) + `ui_kit` ve layout matrislerini daralt. Kapı: aynı + süre karşılaştırması.
- **Faz 3 — karar sonrası:** `app_composition`, `turkey_time`, screenshot matrisi, legacy PDKS, React mock'ları.
