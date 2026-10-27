# S1 denetimi — Geçiş Kontrol 3 sekme sadeleştirme

**Karar: Geçti** (Engel/Önemli bulgu yok; 3 küçük not).

Kapılar (kendi koşum): `vitest run src/components/access-control src/lib/pastAttempt.test.ts convex/doorPlans.test.ts convex/doorPlanModels.test.ts` → 30 dosya / 194 test yeşil. `tsc --noEmit -p tsconfig.app.json` → bu dosyalarda 0 hata. `eslint` (S1 dosyaları + convex/doors.ts) → error 0. `as any`/`!`/Doc filtre sorunu yok.

Doğrulananlar:
- Geçmiş hata: `pastAttemptText` SyncRuns.tsx:65,183 · StatusViews.tsx:27,188 · DoorPlansTab.tsx:263 · DoorPlanDialog.tsx:151'de kullanılıyor; "Cihaz bağlanınca yeniden gönderin" kalmadı.
- `failedAt`: şemada opsiyonel (schema.ts:338-339), eski satırlar doğrulamayı bozmaz; hata yolunda yazılıyor (doors.ts:672,679), başarıda yazılmıyor (kayıt `{revision, appliedAt}` olarak yeniden kuruluyor); `listPlanTargets` döndürüyor (doors.ts:642). Eski satırda zaman yoksa yardımcı "Son denemede: …" der.
- Düzen seçici: Pazartesi dışı farklı gün / çok aralıklı hafta Her gün/Hafta içi'ne geçerken `confirm` ile onay istiyor (DoorStatusPlanEditor.tsx ~190); kaydedilen plan şekli (`weekly` / düz) aynı.
- Yetki sayaçları: Tümü/Etkin/Bekliyor/Hata seçilebilir; Kaldırıldı/Bilinmiyor yalnız >0 iken görünür (StatusCounters.tsx:23-26).
- Proje geneli gönderim ve yeniden dağıtım işlemleri menüde, onay dialogları korunuyor (RedistributeControls.tsx, SyncRuns.tsx).
- Toplu işlem çubuğu yalnız seçimle görünür (DoorPlansTab.tsx:115).

| # | Önem | file:line | Sorun | Öneri |
|---|------|-----------|-------|-------|
| 1 | Küçük | StatusCounters.tsx:30 | "Bilinmiyor" düğmesi görünür ama `disabled` (S1 öncesi de böyleydi; Durum seçicisi kalkınca tek yol sayaç oldu). Bilinmiyor kayıtları listede süzülemiyor. | Sonraki dalgada süzmeyi etkinleştir ya da düğmeyi düz metin yap. |
| 2 | Küçük | DoorStatusPlanEditor.tsx:166, DoorVerifyPlanEditor.tsx:167 | "Pazartesiye en az bir aralık ekleyin" için `globalThis.alert` (yerel tarayıcı uyarısı, erişilebilir ama diğer onaylardan farklı görünür). | Satır içi `role="alert"` mesajı. |
| 3 | Küçük | DoorStatusPlanEditor.tsx ~118-131 | Pazartesi–Cuma aynı, hafta sonu boş mevcut plan "Hafta içi" olarak açılır; bu düzende düzenleme 5 güne birden yazılır (kasıtlı), ama kullanıcı "Günlere göre"ye geçip dönünce `customLayout` sıfırlanır. | Davranış kabul edilebilir; yalnız bilgi. |
