# Geçiş Kontrol sadeleştirme — özet (2026-10-27)

Kaynak: `kurallar.md` (12), `yetki-durumu.md` (11), `kapi-planlari.md` (11). Codex salt-okuma, run `run_000b6e02e935`.
Zaman Şablonları sekmesi kaldırıldı (Faz 1); şablon kodunun kalanı Faz 2 (Dalga 3 commit'inden sonra).

## Önce (Yüksek)
- [ ] **1. Eski hata güncel gibi görünüyor (3 sekme):** hata metni tarihsiz/bağlamsız. Ortak biçim: "Son deneme 22.10 13:09 · o an cihaz çevrimdışıydı", ham hata açılırda.
  `unified/SyncRuns.tsx:159` · `unified/status/model.ts:70`, `StatusViews.tsx:30` · `door-plans/DoorPlansTab.tsx:249`, `convex/doors.ts:692` (deneme zamanı kaydedilmiyor)
- [ ] **2. Plan kopyalama gönderilmeyene "Başarılı" diyor:** "Gönderildi / Değişiklik yok / Gönderilemedi" ayrımı. `door-plans/bulk.ts:81,103`, `CopyDoorPlansDialog.tsx:367`
- [ ] **3. Satırlar kalabalık:** Yetki Durumu 8 alan → kişi, cihaz/kapı, durum, tek aksiyon (`StatusViews.tsx:45`); Kapı Planları → kapı, kısa plan, durum (`DoorPlansTab.tsx:216`); kural ayrıntısında kişi/kapı listeleri açılır (`AccessRuleDetails.tsx:87`).
- [ ] **4. Filtre kalabalığı:** Yetki Durumu 6 sayaç + ayrı Durum seçicisi → tek kontrol (`StatusCounters.tsx:21`); Kurallar ve Yetki Durumu'nda arama açık, gerisi "Filtreler" panelinde (`RulesFilters.tsx:35`, `StatusFilters.tsx:65`).
- [ ] **5. Toplu gönderim butonları öne çıkmış:** "Tüm proje cihazlarına gönder" ve Yetki Durumu'nda seçim yokken görünen gönderim düğmeleri ikincil menüye (`AccessRulesList.tsx:45`, `RedistributeControls.tsx:48`).

## Sonra (Orta)
- [ ] Sihirbaz 1. adımı (ad + açıklama) kişi adımıyla birleşsin (`CreateRuleDialog.tsx:144`).
- [ ] Yetki Durumu rozetleri (Etkin + Güncel değil + Kapı eşleşmedi) tek mesaja (`StatusViews.tsx:18`).
- [ ] Plan editörlerinde "Plan düzeni" + "Hafta içi" + kopyala → tek "Her gün / Hafta içi / Günlere göre" (`DoorStatusPlanEditor.tsx:114`, `DoorVerifyPlanEditor.tsx:122`).
- [ ] Sürekli yardım metinleri, saniyeli saat alanları, her etikette "TR saati" kısalsın (`DoorStatusPlanEditor.tsx:37,169`).
- [ ] Gönderim onaylarındaki marka dağılımı/uzun açıklama kısalsın (`SyncRuns.tsx:198`, `RedistributeControls.tsx:116`).

## Bilinen sınırlar (kuralın son gönderimi, bu oturumun değişikliği)
- `latestForRule` proje gönderimini son 20 kayıtta arıyor; ortak gönderim anında kuralın aktif olduğu doğrulanmıyor (`convex/deviceSyncRuns.ts:406`).

## Çakışma notu
Önce 3-5 maddeleri Dalga 3'ün commit'lenmemiş dosyalarına dokunuyor (status/*, door-plans/*, RulesFilters). Uygulama Dalga 3 commit'inden sonra.
