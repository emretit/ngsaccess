# Geçiş Kontrol Dalga 2 — B: Zaman Şablonları + Yetki Durumu metin, sayaç kapsamı

## Hedef
Zaman Şablonları ve Yetki Durumu sekmelerinde teknik dil kalkar, boş şablon listesi ne işe yaradığını anlatır, ve Yetki Durumu sayaçlarının neyi saydığı (sabit özet) ile listenin filtre sonucu ayrı ayrı yazılır.

## Ownership (yalnız bunlar; testleri dahil)
- src/components/access-control/unified/templates/TemplatesPage.tsx, TemplateEditor.tsx, WeekPreview.tsx (+ templates.test.tsx)
- src/components/access-control/unified/status/StatusPage.tsx, StatusViews.tsx, StatusResults.tsx (+ StatusResults.test.tsx), StatusCounters.tsx, StatusFilters.tsx, RedistributeControls.tsx, model.ts (+ status.test.tsx)
- convex/accessGrantStatus.ts (+ convex/accessGrantStatus.test.ts) — YALNIZ 03-O2 kişi sayısı backend'de yoksa; dönüş tipini yalnız genişlet (alan ekle), mevcut alanları değiştirme
Kapsam dışı: TemplatePicker.tsx, RunNotice.tsx, SyncRuns.tsx, presentation.ts (A), door-plans/, door-dialog/ (C).

## İstenenler
1. **02-O1:** Boş şablon listesine iki cümle: "Kişilerin geçebileceği gün ve saatleri bir kez tanımlayın, sonra Kurallar'da bir kurala bağlayın. Kapının herkes için açık ya da kilitli kalma saatleri Kapı Planları'nda ayarlanır." (Hazır taslaklar Dalga 4 — yapma.)
2. **02-O5:** Editör önizlemesi "Birleştirilmiş önizleme" → "Haftalık geçiş saatleri". Kapasite satırı ("Hik: gün başına en çok 1 aralık ✓(8) · IDE: 2 izin kaydı ✓(8)") → "Cihaz uyumluluğu" başlığı altında sade: ör. "Hikvision: günde en fazla 8 aralık — bu şablonda en çok 1 ✓" / "IDE: en fazla 8 izin kaydı — bu şablon 2 kullanıyor ✓". Sınır aşılırsa sade çözüm cümlesi ("Aralıkları birleştirin ya da azaltın").
3. **03-D1:** "Hik" → "Hikvision"; "kural kapsamından türetilir", "kişi×cihaz", "indeks sırası" gibi ifadeler sade Türkçe; "Bu özellik açılmadan önceki dağıtımlar 'Bilinmiyor' görünür…" notu yalnız Bilinmiyor sayısı > 0 iken; Şablon "—" / "Şablon yok" yerine kural kendi saatini kullanıyorsa "Kuralın kendi saati".
4. **03-O2 sayaç kapsamı:** Rozetler (filtre düğmeleri, Dalga 1 davranışı korunur) yanında sabit kapsam metni: "Proje özeti · N kişi–cihaz kaydı · M kişi" (departman seçiliyse "Departman özeti"). Listenin hemen üstünde ayrıca "Filtre sonucu: K kayıt". "Hik kapı bilgisi… Sayaçlar proje/departman kapsamındadır…" teknik paragrafları bu iki satırla değiştir. M kişi sayısı mevcut veriden türetilemiyorsa convex/accessGrantStatus.ts counts'a ekle (test ekle); türetilebiliyorsa backend'e dokunma.
5. **Rozet erişilebilirliği:** Durum rozetlerine seçili durum için `aria-pressed` (turda null görüldü).
6. **Sekme başlıkları:** Zaman Şablonları ve Yetki Durumu için ortak kalıp (H1 + açıklama). Yetki Durumu H1'i zaten var; açıklamayı ekle, "Son yenileme" satırı kalabilir.

## Kabul
- Test: boş şablon listesinde açıklama cümleleri.
- Test: editör önizleme başlığı "Haftalık geçiş saatleri", kapasite metni "Hik:" içermez.
- Test: Bilinmiyor 0 iken eski dağıtım notu görünmez; > 0 iken görünür.
- Test: kapsam metni ve "Filtre sonucu: K kayıt" (arama ile K değişir, özet değişmez); rozetlerde aria-pressed.
- Convex'e dokunduysan `vitest run convex/accessGrantStatus.test.ts` + convex tsc yeşil.
