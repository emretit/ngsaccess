# S1 denetimi — Geçiş Kontrol 3 sekme sadeleştirme (SALT OKUMA)

## Hedef
S1 değişikliğini (Codex yazdı) bağımsız denetle: 3 sekmede (Kurallar, Yetki Durumu, Kapı Planları) spec'teki iş maddeleri yapıldı mı, mevcut davranış (onay dialogları, kaydedilmemiş değişiklik uyarısı, kaydet/gönder akışı, erişilebilirlik, mobil 44px hedefler) bozuldu mu, geçmiş hata her yerde tarihli mi? Rapor: `docs/ui-audit-gk/sadelestirme/review-S1.md`.

## Bağlam
- Proje /Users/emreaydin/ngsaccess (React + Convex). Kullanıcı geri bildirimi "çok fazla detay veriyoruz"; amaç her ekranda yalnız karar/aksiyon bilgisi, ayrıntı istenince açılır.
- İncelenecek dosyalar: `.claude/pathspec-gk-s1.txt` (her biri için `git diff HEAD -- <dosya>`). Not: S0 (şablon silme) değişiklikleri de aynı dosyalarda commit'siz duruyor ve ayrıca denetlendi (`docs/ui-audit-gk/sadelestirme/review-S0.md`, Geçti); S1'e ait olmayan şablon silme farklarını bulgu yazma. Listede olmayan dosyaları değerlendirme (başka oturumların ilgisiz değişiklikleri var).
- Spec'ler: `.claude/orca-specs/sade-s1-kurallar.md`, `sade-s1-yetki.md`, `sade-s1-kapi.md`. Kaynak öneriler: `docs/ui-audit-gk/sadelestirme/00_OZET.md`.
- Özellikle bak:
  - Geçmiş hata gösterilen her yer `pastAttemptText` (`src/lib/pastAttempt.ts`) kullanıyor mu; "Cihaz bağlanınca yeniden gönderin" gibi şimdiki zaman kipli eski metin kaldı mı.
  - `convex/doors.ts` `recordPlanResult` `failedAt`: başarıda temizleniyor mu, şema alanı opsiyonel mi (`convex/schema.ts`), canlı veride eski satırlar şema doğrulamasını bozmaz mı; liste sorgusu döndürüyor mu.
  - Kapı planı editörü "Her gün / Hafta içi / Günlere göre" seçimi: Dalga 3 C1-1 korunuyor mu (çok aralıklı haftayı onaysız silmemeli); kaydedilen plan şekli öncekiyle aynı mı.
  - Yetki Durumu tek durum kontrolü: hiçbir durum (özellikle Bilinmiyor > 0) seçilemez hale gelmemiş mi; sayılar doğru mu.
  - Gizlenen/menüye taşınan aksiyonlar (proje geneli gönderim, toplu işlem çubuğu) hâlâ erişilebilir ve onaylı mı.
  - `any`/`as any`, `!` non-null, `filter(Boolean)` (CLAUDE.md) yok mu.
- Kendi kapını koş: `node_modules/.bin/vitest run src/components/access-control src/lib/pastAttempt.test.ts convex/doorPlans.test.ts convex/doorPlanModels.test.ts`.

## Rapor biçimi (Türkçe)
En üstte karar: "Geçti" / "Düzeltme gerekli". Tablo: `# | Önem (Engel/Önemli/Küçük) | file:line | Sorun | Öneri`. En fazla 12 satır. Kanıtsız tahmin yazma; kodda doğrula.

## YASAK
Kaynak koda yazma (yalnız rapor dosyası). `git add/commit/stash/checkout/reset/restore` YASAK. `npx convex *` komutları ve DB yazma YASAK.

## worker_done
≤10 satır: karar + Engel/Önemli bulgular (file:line) + rapor yolu; `--report-path docs/ui-audit-gk/sadelestirme/review-S1.md`.
