# Denetim — UI Audit 2 düzeltmeleri, Dalga 2 (salt-okuma)

## Hedef
Codex worker'larının yazdığı commit'lenmemiş Dalga 2 değişikliklerini (05 Geçiş Kontrol, 06 Ziyaretçiler, 09 Vardiyalar, 12 Denetim Kaydı) denetle ve `docs/ui-audit-2/review-wave2.md` raporunu yaz.
Kapsam dosya listesi: `.claude/orca-specs/fix2-wave2-paths.txt` (yalnız bunlar; `git diff -- <yol>`, yeni dosyalar için `cat`; "(SİLİNDİ)" işaretliler için `git show HEAD:<yol>` ile hâlâ import eden var mı `grep -rn`).
İlgili bulgu raporları + "Kararlar (Emre)": `docs/ui-audit-2/{05,06,09,12}-*.md`; sayfa spec'leri `.claude/orca-specs/fix2-{05,06,09,12}.md`; worker raporu `docs/ui-audit-2/fix-06-ziyaretciler-rapor.md`.
Koordinatörün `convex/schema.ts` değişiklikleri (yeni index'ler: employees `by_project_visitor_expiry`, `by_project_visitor_status_expiry`; accessRules `by_project_targetType`, `by_project_targetType_isActive`, search_name filterFields+targetType; projectPrivacySettings.visitorKvkkUrl/visitorKvkkVersion; employeeConsents.documentVersion) — bu index'lerin doğru kullanıldığını kontrol et.

DİKKAT: Aynı ağaçta başka bir oturum ölü kod temizliği yaptı (kullanılmayan import/fonksiyon silmeleri). Listede bu tür küçük silmeler görürsen bulgu sayma; yalnız davranışı etkiliyorsa yaz.
Önceki denetim örneği: `docs/ui-audit-2/review-wave1.md` (biçim ve derinlik aynı olsun).

## Neye bak (önem sırasıyla)
1. Doğruluk hataları ve gerilemeler: yanlış koşul, kırılan davranış, yarış, `null`/0 karışıklığı, saat dilimi (Europe/Istanbul) hataları, ortak bileşenlerin diğer tüketicileri (`grep -rn`).
2. Backend (`convex/{accessRules,visitors,shifts,auditLog}.ts`, `convex/lib/*`): yetki/proje kapsamı korunuyor mu; filtreler GERÇEKTEN sunucuda ve sayfalamadan ÖNCE mi (sayfa alındıktan sonra süzme = eksik sonuç); index kullanımı; okuma sayısı/kota (Convex Free plan, function-call bütçesi önemli). **Süzgeçsiz yol taraması**: değişen her public query/mutation için proje/rol filtresi atlanan bir yol var mı.
3. Kararlara uyum: her raporun "Kararlar (Emre)" bölümü; 09 kapsam dışı (09-O7, 09-D6, tek gün istisnası) dokunulmamış mı; 12'de denetim kaydı YAZAN kod değişmemiş mi, CSV eklenmemiş mi; 05'te kural kayıt/diff/cihaz gönderim mantığı değişmemiş mi; 06'da kart okutma/cihaza yazma mantığı değişmemiş mi.
4. Görsel/erişilebilirlik: Orca tarayıcısında kendi sekmeni aç (`orca tab create --url http://localhost:8081/home --worktree current --json`, HER komutta `--page <id>`; oturum açık). /access-control (kural listesi + bir kuralın ayrıntısı + sihirbazı aç-Escape), /visitors (liste + filtre + bir ziyaretçinin paneli), /shifts (takvim + atama diyaloğu aç-Escape), /audit-log (filtreler + sonuçlar) sayfalarını aç (rota adları farklıysa sidebar'dan bul), ekran görüntüsü al (`orca screenshot --page <id> --json` → base64 PNG → `docs/ui-audit-2/review-wave2/` altına), konsol hatası var mı bak (`orca eval`). Dev sunucu yoksa ya da Convex fonksiyonu canlıda yoksa (yeni fonksiyonlar henüz deploy EDİLMEDİ) bunu rapora "doğrulanamadı + neden" diye yaz, kendin deploy etme. İş bitince sekmeyi kapat.
5. Test kalitesi: yeni testler davranışı gerçekten doğruluyor mu (boş/aldatıcı test var mı).

## Kapı (kendin koş, sonucu rapora yaz)
- `node_modules/.bin/vitest run src/components/access-control src/components/visitors src/components/shifts src/components/audit convex/lib` → sonuç sayıları.

## Yasak
Kod DEĞİŞTİRME (yalnız rapor + ekran görüntüleri). commit/push/deploy/`npx convex` YOK. Tarayıcıda Kaydet/Sil/Gönder/Ata/Kapı aç YOK (aç-incele-Escape).

## Rapor biçimi (Türkçe, sade)
Üstte 2-3 cümle sonuç + sayı (Engel / Düzeltilmeli / Not). Sonra tablo: ID (R2-E1, R2-D1, R2-N1) | önem | dosya:satır | sorun | öneri.
"Engel" = commit'ten önce düzeltilmesi şart. Kanıtsız bulgu yazma.

## worker_done
≤10 satır: Engel ve Düzeltilmeli bulguların tek satırlık listesi + rapor yolu (`--report-path`).
