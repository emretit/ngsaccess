# Plan — Geçiş Kontrol sadeleştirme + Zaman Şablonları kaldırma (2026-10-27)

Kaynak: `docs/ui-audit-gk/sadelestirme/00_OZET.md` + `kurallar.md`, `yetki-durumu.md`, `kapi-planlari.md`.
Toplam süre tahmini: ~3,5-4 saat (worker'lar paralel çalışırsa).

## Checklist
Devam: `.claude/handoff-gk-sadelestirme.md`


### Adım 0 — Zemin temizliği (~30-45 dk)
- [x] Faz 1: Zaman Şablonları sekmesi + kural formundaki "Şablon kullan" kaldırıldı (bu oturum, commit yok)
- [x] Kuralın son gönderimi: `latestForRule` + satır içi kart (bu oturum, commit yok, Convex yayını yok)
- [x] Dalga 3'ün 3 Önemli düzeltmesi (C1-1, C1-2, D-1) — `.claude/handoff-gk-audit.md` en üst
- [x] Commit 2a7a057c: Dalga 3 + bu oturumun değişiklikleri (ortak dosyalar: `SyncRuns.test.tsx`, `UnifiedAccessControl.tsx`, `UnifiedAccessControl.test.tsx`) — Emre onayı

### Adım 1 — Koordinatör hazırlığı (~20 dk, devredilmez)
- [x] `src/lib/pastAttempt.ts`: `pastAttemptText(at, reason)` → "Son deneme 22.10 13:09 · Cihaz çevrimdışıydı" + test (3 sekme bunu kullanır)
- [x] `CollapsibleFilters`: masaüstünde de katlanabilir olması için isteğe bağlı prop (ör. `collapseOn="all"`); varsayılan davranış aynı kalır, 4 mevcut kullanıcı etkilenmez
- [x] Veri teyidi (salt okuma): `accessScheduleTemplates` 0 satır, `accessRules.scheduleTemplateId` 0, `doors.hikDoorStatusTemplateId` 0, `deviceSyncRuns` içinde `template_sync` 0
- [x] S0/S1 spec dosyaları `.claude/orca-specs/sade-*.md`

### Dalga S0 — Zaman şablonlarını tamamen kaldır (2 paralel worker, ~45-60 dk)
- [x] **S0-web** (Codex `gpt-6.1-sol medium`)
- [x] **S0-convex** (Codex `gpt-6-astra high`; senkron kodu)
- [x] Kapılar (5149/5149, tsc 0, eslint 0, leak temiz) · [x] denetim GEÇTİ (review-S0.md)

### Dalga S1 — 3 sekme sadeleştirme (3 paralel worker, ~45-60 dk)
- [x] **S1-kurallar** (Codex `gpt-6.1-sol medium`)
- [x] **S1-yetki** (Codex `gpt-6.1-sol medium`)
- [x] **S1-kapi** (Codex `gpt-6.1-sol medium`; küçük backend)
- [x] Kapılar (5160/5160, tsc 0, eslint 0, leak temiz) · [x] denetim GEÇTİ (review-S1.md)

### Kapanış (~30 dk)
- [x] Tarayıcı turu (Orca, localhost:8081/access-control; Kaydet/Gönder YOK)
- [x] simplify-sonnet (koordinatörün dokunduğu dosyalar)
- [x] Commit cbfbeccf (Emre onayı, pathspec)
- [x] Yayın: Convex 18:57:23 → web 18:58:05 (2026-10-27)

---

## Ortak kurallar (her worker spec'ine girer)
- Worktree YOK, `--worktree current`. Ownership dışındaki dosyaya yazma.
- `git add`, `git commit`, `git stash`, `git checkout`, `git reset` YASAK. Push/deploy YOK.
- `npx convex dev`, `npx convex deploy`, `npx convex run`, DB'ye yazan her komut YASAK. Supabase MCP kullanma.
- `any` / `as any` yasak; Convex alanları camelCase (CLAUDE.md).
- Kullanıcıya görünen metin Türkçe, kısa, sade.
- Kapılar (worker kendi koşar, koordinatör tekrar koşar):
  - `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0
  - `node_modules/.bin/eslint <ownership dosyaları>` → error 0
  - `node_modules/.bin/vitest run <ilgili klasör>` → yeşil
- Rapor: `worker_done` ≤10 satır, file:line, `--files-modified` gerçek liste.

## S0-web — şablon arayüzünü sil
**Hedef:** `src` içinde zaman şablonuna (accessScheduleTemplates) referans kalmaz; kapı planı yalnız kendi saatleriyle çalışır.
**Ownership:**
- Sil: `src/components/access-control/unified/templates/` (TemplatesPage, TemplateEditor, TemplatePicker, RuleScheduleSummary, model.ts, testleri). `schedule.ts` başka yerde kullanılıyorsa taşı, kullanılmıyorsa sil.
- Düzenle: `unified/hooks/useRuleForm.ts`, `unified/hooks/useAccessRuleSchema.ts` (scheduleMode/scheduleTemplateId kalkar), `unified/rules-list/RuleRow.tsx`, `unified/AccessRuleDetails.tsx` (şablon adı gösterimi), `door-plans/DoorPlanDialog.tsx` ("Zaman şablonu kullan" + TemplatePicker), `door-plans/CopyDoorPlansDialog.tsx` ("Zaman şablonu (durum planı)" seçeneği), `door-plans/DoorPlanImpactSummary.tsx`, `door-plans/bulk.ts`, `door-dialog/DoorStatusPlanSection.tsx` ("Kurallar ve Zaman Şablonları'nda" metni → "Kurallar'da"), `unified/status/*` içindeki şablon filtre/etiketleri, `src/hooks/access-rules/useComplexAccessRuleMutations.ts`, `src/types/access-control.ts`, ilgili testler.
- Dikkat: "Ziyaretçi şablonu" (visitor kural tipi) zaman şablonu DEĞİL, dokunma.
**Kapsam dışı:** `convex/` (S0-convex'in). Sadeleştirme önerileri (S1'in).
**Ek kapı:** `grep -rnE "accessScheduleTemplates|scheduleTemplateId|hikDoorStatusTemplateId|TemplatePicker" src` → 0 (test dosyaları dahil).

## S0-convex — şablon backend'ini sil
**Hedef:** `convex` içinde zaman şablonu tablosu, alanları ve dalları kalmaz; kural ve kapı planı senkronu davranışı (şablonsuz yol) değişmez.
**Ownership:** `convex/accessScheduleTemplates.ts` (sil; `scheduleRuleDevices`, `boundedScheduleRows`, `ideScheduleImpact`, `readTemplate` gibi başka yerde kullanılan yardımcıları `convex/lib/` altına taşı), `convex/schema.ts` (`accessScheduleTemplates` tablosu, `accessRules.scheduleTemplateId` + `by_template`, `doors.hikDoorStatusTemplateId/UpdatedAt`, `deviceSyncRuns.templateId` + `template_sync` kind), `convex/deviceSyncRuns.ts` (template_sync yolu, `latestForRule` içindeki şablon dalı), `convex/accessRules.ts`, `convex/doors.ts`, `convex/ideSync.ts`, `convex/hikvisionSync.ts`, `convex/accessGrantStatus.ts`, `convex/lib/{accessSchedule,ruleSchedule,accessRuleWrite,accessRuleUx,grantStatus,mobileAccess,hikSync,hikSyncEmployee,cardReadingProcess,adminGuards}.ts`, `convex/actions/hikQueueWorker.ts`, ilgili `*.test.ts`.
- Dikkat: `fingerprintEnrollment.ts`, `actions/hikFingerprint.ts` içindeki "template" parmak izi şablonudur, DOKUNMA.
- `effectiveSchedule(rule, template)` → `effectiveSchedule(rule)`; şablonsuz sonuç bugünküyle birebir aynı kalmalı (mevcut testler bunu kanıtlar).
**Kapsam dışı:** `src/` (S0-web'in), `convex/_generated` (codegen koordinatörde).
**Ek kapılar:** `grep -rnE "accessScheduleTemplates|scheduleTemplateId|hikDoorStatusTemplate|template_sync" convex --exclude-dir=_generated` → 0; `node scripts/find-node-leak.mjs` temiz; `node_modules/.bin/vitest run convex` yeşil.

## S1-kurallar
**Hedef:** Kurallar sekmesi ilk bakışta yalnız kural, kapsam, saat ve gereken aksiyonu gösterir; eski gönderim hatası tarihli görünür.
**Ownership:** `unified/AccessRulesList.tsx`, `unified/rules-list/*`, `unified/AccessRuleDetails.tsx`, `unified/CreateRuleDialog.tsx`, `unified/components/RuleBasicInfo.tsx`, `unified/SyncRuns.tsx`, `unified/lib/presentation.ts` + testleri.
**İşler:**
1. Son gönderim kartındaki sorunlu cihaz satırı `pastAttemptText` ile tarihli (`SyncRuns.tsx:159`); "Cihaz bağlanınca yeniden gönderin" kalkar.
2. Kural ayrıntısında kişi ve kapı listeleri "Kişileri göster (N)" / "Kapıları göster (N)" ile açılır; bağlantısız kapı uyarısı açık kalır (`AccessRuleDetails.tsx:87`).
3. "Tüm proje cihazlarına gönder" ikincil menüye ("Diğer işlemler"); onay dialogu aynen kalır (`AccessRulesList.tsx:45`).
4. Filtreler: arama açık, Durum + Tür `CollapsibleFilters` (masaüstü dahil) içinde, aktif filtre sayısıyla (`RulesFilters.tsx:35`).
5. Sihirbaz: 1. adım (ad + açıklama) 2. adımla birleşir, açıklama "Açıklama ekle" ile açılır; üst açıklama tek cümle (`CreateRuleDialog.tsx:134,144`).
6. Alt özet sayacı: cihaz tamamı seçiliyse "0 kapı" yerine "NGS0001 tüm kapılar" gibi doğru özet (`CreateRuleDialog.tsx:274`, `selectionHelpers.ts:61` okunur).
7. Liste: Tür sütunu kural adının yanında küçük etikete; "Aktif" sütun başlığı "Kural durumu" (`RuleRow.tsx:96,130`).
8. Proje gönderim onayında marka dağılımı kalkar, yalnız cihaz sayısı + kapsam (`SyncRuns.tsx:198`).
**Kapsam dışı:** Bölge→cihaz→kapı ağacının yeniden tasarımı (rapor #9, ayrı karar). `convex/`.

## S1-yetki
**Hedef:** Yetki Durumu ilk bakışta kişi, cihaz/kapı, tek durum mesajı ve tek aksiyon gösterir; eski hata tarihli görünür.
**Ownership:** `src/components/access-control/unified/status/*` + testleri. Gerekirse `convex/accessGrantStatus.ts` yalnız `updatedAt` döndürmek için (dönmüyorsa).
**İşler:**
1. Satır/kart: kişi, cihaz/kapı, durum, tek aksiyon; departman, kural, ayrıntılı tarihler kişi çekmecesine (`StatusViews.tsx:45,68,151`).
2. Hata: kısa neden + `pastAttemptText(updatedAt, …)`; ham hata "Hata ayrıntısı" altında (`model.ts:70`, `StatusViews.tsx:30`).
3. Rozetler tek ana mesaja: "Yeniden gönderilmeli" / "Kapı seçimi düzeltilmeli" (`StatusViews.tsx:18-25`).
4. 6 sayaç + Durum seçicisi → tek durum kontrolü; sıfır değerli ikincil durumlar açılır listede, Bilinmiyor > 0 ise görünür (`StatusCounters.tsx:21`, `StatusFilters.tsx:109`).
5. Filtreler masaüstünde de `CollapsibleFilters` içinde; arama açık (`StatusFilters.tsx:65`).
6. Seçim yokken gönderim düğmeleri gizli; proje geneli işlemler "Diğer gönderim işlemleri" altında (`RedistributeControls.tsx:48,61`).
7. "Son yenileme" → "Liste okundu: 27.10 17:20" (tam tarih) (`StatusPage.tsx:77,257`).
8. Cihaz görünümünde iç satırlarda tekrar eden cihaz adı kalkar (`StatusResults.tsx:116,144`).
9. Gönderim sonrası iki bildirim tek bildirimde (`StatusPage.tsx:82`, `RunNotice.tsx:31`); onay metni kısalır (`RedistributeControls.tsx:116`).
10. Çekmecede yetkisiz kapı listesi "Kural dışında kalan N kapı" özeti + aç (`StatusViews.tsx:197`).
**Kapsam dışı:** Güncellik hesabının (stale) backend'de yeniden tasarımı (rapor risk #3, ayrı karar). Hikvision "Tüm kapılar (cihaz)" etiketinin doğruluğu (cihazda canlı doğrulama gerekir).

## S1-kapi
**Hedef:** Kapı Planları listesi kapı, kısa plan ve gönderim durumunu gösterir; geçmiş hata tarihli; kopyalama sonucu doğru.
**Ownership:** `src/components/access-control/door-plans/*`, `src/components/access-control/door-dialog/{DoorStatusPlanSection,DoorVerifyPlanSection,DoorVerifyPlanEditor}.tsx`, `src/components/access-control/DoorStatusPlanEditor.tsx` + testleri; backend: `convex/doors.ts` (`recordPlanResult` hata zamanı + liste sorgusunun döndürmesi), `convex/schema.ts` yalnız `hikPlanResults.*.failedAt` opsiyonel alanı.
**İşler:**
1. `recordPlanResult` hatada `failedAt` kaydeder; liste "Son gönderim başarısız · 22.10 13:09" + ham hata açılırda; cihaz şu an çevrimiçiyse yanında belirtilir (`DoorPlansTab.tsx:249`, `convex/doors.ts:692`).
2. Kopyalama sonucu: "Gönderildi" / "Değişiklik yok, gönderilmedi" / "Gönderilemedi" ayrı; üstte toplam, hatalılar açık (`bulk.ts:81,103`, `CopyDoorPlansDialog.tsx:367`).
3. Liste satırı: kapı adı + küçük cihaz adı + tek satır plan özeti + durum; bölge ve tüm aralıklar satır ayrıntısında (`DoorPlansTab.tsx:58,216,236`).
4. Editörler: "Plan düzeni" + "Hafta içi" + Pazartesiyi kopyala → tek seçim "Her gün / Hafta içi / Günlere göre" (`DoorStatusPlanEditor.tsx:114,149`, `DoorVerifyPlanEditor.tsx:122`). Dalga 3 C1-1 düzeltmesiyle uyumlu kalmalı (çok aralıklı haftayı onaysız silme).
5. Yardım metinleri tek cümleye; ayrıntı "Plan nasıl çalışır?" altında; "TR saati" editör başında bir kez; saniye alanı yalnız saniyeli kayıt varsa (`DoorStatusPlanEditor.tsx:37,43,169,272`, `DoorVerifyPlanEditor.tsx:37,286`).
6. Tatil: ilk 10 tarih yerine "N tatil aralığı" özeti + tümünü aç; destek açıklaması yalnız tatil açılınca (`DoorPlanDialog.tsx:397,414,425`).
7. Etki özeti başlığı "Gönderilecek değişiklik"; plan kapalıyken "Kapı normal çalışır" yerine "Durum planı kapatılacak" (`DoorPlanImpactSummary.tsx:35,57`).
8. Seçim yokken toplu işlem çubuğu gizli (`DoorPlansTab.tsx:114`).
9. Kopya dialogunda tekrar eden kaynak/hedef bilgisi tek "N hedef kapı — listeyi aç" (`CopyDoorPlansDialog.tsx:209,290,312`).
**Kapsam dışı:** Tatil takvimi sürüm izleme (rapor risk #4, backend tasarım). Açık dialogun canlı güncellenmesi (risk #3).

## Denetim (her dalga sonrası)
- Claude `sonnet medium`, salt okuma, `git diff` + kendi koştuğu kapılar. Rapor `docs/ui-audit-gk/sadelestirme/review-S0.md` / `review-S1.md`: Engel / Önemli / Küçük.
- Engel/Önemli → aynı worker'a takip (aynı thread); 2 zayıf tur → koordinatör devralır.

## Sonraya kalanlar (ayrı karar)
- Kural "son gönderim" kartının güncel kural kapsamıyla eşleştirilmesi (kurallar #2) ve `latestForRule` 20 kayıt sınırı.
- Bölge→cihaz→kapı ağacında tek kapılı cihazı düz satır yapma (kurallar #9).
- Yetki Durumu güncellik (stale) hesabının üyelik/silinen kural değişikliklerini kapsaması.
- Kapı Planları tatil takvimi sürüm izleme + açık dialogun canlı güncellenmesi.
