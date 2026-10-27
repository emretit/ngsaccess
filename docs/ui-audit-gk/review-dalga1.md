# Dalga 1 çapraz denetim (A kapı, B kural, D yetki)

**Karar: Geçti** (Engel yok; 3 Önemli + 4 Küçük not, hepsi Dalga 2'ye bırakılabilir).

Kapılar (kendi koşumum): `vitest run src/components/access-control convex/accessGrantStatus.test.ts` → 22 dosya / 190 test yeşil. `eslint` (kapsam + DoorPlanImpactSummary.tsx) → 0 hata/uyarı. `any`, `!`, snake_case yok.

## Spec maddeleri
Tümü yapılmış: 04-H1a (boş gönderim → "Değişiklik yok" bilgisi, `allDoorPlansApplied` boş dizide false), 04-H1b (kalıcı "Cihaza tekrar gönder"), 04-H2 (düğme + etki özeti), 01-H1, 02-O8, 01-H2 (`runDisplay`), 02-O7, 03-H2 (rozet = filtre = sayaç). Kabul testlerinin hepsi var.

## Bulgular
| ID | Önem | Dosya:satır | Sorun | Öneri |
|---|---|---|---|---|
| R1 | Önemli | DoorPlanDialog.tsx:~151 | `plansPending`/`hikPlanApplyError` dolu ama kapıda kayıtlı etkin plan yoksa (`persistedKeys` boş) ve değişiklik de yoksa Kaydet "Değişiklik yok; cihaza bir şey gönderilmedi" der; bekleyen bayrak temizlenmez. Banner da görünür kalır ama tekrar gönder düğmesi çıkmaz (`retryKeys` boş). Kullanıcı takılı kalır. | Bu durumda banner metnini "Gönderilecek plan yok" yap veya bayrağı temizleyen bir yol sun. Test ekle. |
| R2 | Önemli | DoorPlanDialog.tsx:~249 | Banner `failedKeys` doluyken `result.error` boş/undefined ise "Son gönderim başarısız: " boş biter. | Hata yoksa "Cihaza gönderilemedi" varsayılanı. |
| R3 | Önemli | DoorPlanDialog.tsx:~246 | Açıklamadan `door.doorName · door.deviceName` kalktı; cihaz adı artık dialogda hiçbir yerde yok (özet yalnız kapı adı, yalnız değişiklik varken). Aynı adlı kapılar ayırt edilemez. | Başlığa ya da özete cihaz adını ekle (spec açıklama metnini ayrı satır olarak tutup ad satırını koruyabilir). |
| R4 | Küçük | DoorPlanDialog.tsx:~168 | `retryAction` başarısında `onSuccess()` çağrılıyor ama dialog kapanmıyor ve `saved` false kalabilir; kullanıcıya "Kapat" yerine "İptal"/"Kaydet ve cihaza gönder" görünür. | Başarıda `setSaved(true)` veya dialogu kapat. |
| R5 | Küçük | DoorPlanImpactSummary.tsx (statusOpen satırı) | "Sürekli açık aralıklar içerir" son eki, metin zaten "sürekli açık" içermiyorsa ekleniyor; `weeklySummary` 180 karakterde "Haftalık · N aralık"a düşünce uyarı bu son ekle kalıyor — kasıtlı, ama `includes` kontrolü kırılgan. | Koşulu `statusOpen && truncated` gibi açık yap. |
| R6 | Küçük | TemplateEditor.tsx:143 | `weekChanged` UI'da `inspectSchedule(...).week` karşılaştırıyor; backend `normalizeWeek` ile karşılaştırıyor (`accessScheduleTemplates.ts:129`). Normalizasyon farkı olursa UI "değişmedi" derken backend gönderim planlayabilir (ya da tersi). Test yalnız state slot'larıyla statik render. | İki tarafın aynı normalize fonksiyonunu kullandığını doğrula (inspectSchedule içinde normalizeWeek varsa sorun yok). |
| R7 | Küçük | CreateRuleDialog.tsx:~52 | `includeArchived: true` ile ayrı abonelik; TemplatePicker aynı argümanı kullanmıyorsa "paylaşılan abonelik" varsayımı geçersiz (fazladan sorgu). Silinmiş/arşiv şablon adı da özette görünür. | TemplatePicker args'ıyla aynı yap ya da yalnız aktifleri iste. |

## Tutarlılık notları (sorun değil)
- `accessGrantStatus` tüketicileri (`model.ts`, `StatusPage`, `useStatusData`, `useRedistribution`) yalnız `state`/`counts`/`redistribute` kullanıyor; `doorUnresolved` eklenmesi dönüş tipini genişletiyor, kırıcı değil. `byEmployee` sentetik satırda `failed` yerine `unknown` + `doorUnresolved` — testle sınanıyor (unknown/pending/failed/removed).
- `grantBadge` teknik `door_io_unresolved` metnini gizliyor; `ideSync.ts`/`ideGatewayDevice.ts` içindeki aynı kod yalnız backend/log tarafı, kullanıcıya sızmıyor.
- Türkçe metinler tutarlı ("cihaz" terimi; "panel" kalmadı bu dosyalarda).
- Testler davranışı sınıyor (TimeSchedule `bg-primary` farkı, DoorPlanDialog tekrar-gönder çağrısı, convex filtre/sayaç/redistribute). DoorPlanDialog "sürekli açık" özetini ayrı `DoorPlanImpactSummary.test.tsx` sınıyor, dialog içine takıldığına dair entegrasyon testi yok (küçük boşluk).
