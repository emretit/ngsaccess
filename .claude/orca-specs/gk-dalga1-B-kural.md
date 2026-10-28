# Geçiş Kontrol Dalga 1 — B: Kural sihirbazı, gönderim etiketi, şablon onayı (01-H1, 02-O8, 01-H2 metin, 02-O7)

## Hedef
Kural sihirbazında seçili zaman kaynağı ve seçilen şablon açıkça görünür; hiçbir cihaza gitmeyen gönderim "Kısmi sonuç" değil "Gönderilemedi" görünür; şablon onayı yalnız saat değişince gönderim sözü verir.

## Ownership (yalnız bunlar)
- src/components/access-control/unified/components/TimeSchedule.tsx
- src/components/access-control/unified/CreateRuleDialog.tsx
- src/components/access-control/unified/lib/presentation.ts
- src/components/access-control/unified/SyncRuns.tsx (+ SyncRuns.test.tsx)
- src/components/access-control/unified/status/RunNotice.tsx (+ RunNotice.test.tsx)
- src/components/access-control/unified/templates/TemplateEditor.tsx, templates/model.ts (+ templates.test.tsx, schedule.test.ts)
- ilgili yeni/var olan test dosyaları bu klasörlerde
Kapsam dışı: convex/ (backend değişmez; `convex/lib/deviceSyncRun.ts` RunStatus aynı kalır), status/ altındaki diğer dosyalar, TemplatePicker.tsx (Dalga 2'de), door-plans/.

## İstenenler
1. **01-H1:** TimeSchedule "Özel saat" / "Şablon kullan": seçili olan görsel olarak dolu (`variant="default"` veya ToggleGroup tek seçim, A2 stiliyle), seçili olmayan outline; `aria-pressed` korunur.
2. **02-O8:** CreateRuleDialog alt özet satırı: şablon modunda şablon seçilmemişse "Zaman şablonu seçilmedi" (uyarı tonu), seçiliyse şablonun adı. Ad için `api.accessScheduleTemplates.list` sonucunu kullan (TemplatePicker'ın kullandığı sorgu; Convex aynı aboneliği paylaşır). Aynı satırda "panel" → "cihaz", "açık kapı seçimi" → "kapı" (ör. "1 kişi · 2 cihaz / 3 kapı · Pzt–Cum tüm gün").
3. **01-H2 metin:** presentation.ts'e `runDisplay(status, counts)` ekle → `{label, tone}`; `status === "partial"` ve `counts.sent + counts.verified === 0` ise label "Gönderilemedi", tone "danger"; diğer durumlar mevcut `runLabels`/`runTone`. SyncRuns.tsx (2 yer) ve RunNotice.tsx bunu kullansın. Çevrimdışı nedeniyle atlanan hedefte (`target.reason` = "Cihaz çevrimdışı") altına "Cihaz bağlanınca yeniden gönderin." ipucu ekle.
4. **02-O7:** Şablon onayı (TemplateEditor ImpactConfirm): haftalık saatler değişmediyse (yalnız ad/açıklama) "Geçiş saatleri değişmedi; cihaza gönderim gerekmiyor." de, "20 sn içinde gönderim" deme. Saat değiştiyse mevcut metin kalır ama sade: "N kural ve N cihaz güncellenecek; cihaz gönderimi yaklaşık 20 saniye içinde başlar." Backend kuralı: `convex/accessScheduleTemplates.ts:129` gönderimi yalnız `week` değişince planlar — buna uy (okumak serbest, değiştirmek yasak). Gerekirse `model.ts` saveMode kararına "week değişti mi" girdisi ekle; saat değişmediyse önizleme adımını atlamak da kabul.

## Kabul
- Test: TimeSchedule'da seçili düğmenin sınıfı/variant'ı diğerinden farklı.
- Test: şablon modunda seçim yokken özet "Zaman şablonu seçilmedi".
- Test: `runDisplay("partial", {sent:0,verified:0,skipped:2,...})` → "Gönderilemedi"; `sent:1` → "Kısmi sonuç".
- Test: yalnız ad değişen şablonda onay metninde "20" geçmez.
- Var olan SyncRuns/RunNotice/templates/CreateRuleDialog testleri yeşil (metin değiştiyse güncelle).
