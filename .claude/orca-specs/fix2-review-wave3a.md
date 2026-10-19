# Denetim — UI Audit 2 düzeltmeleri, Dalga 3a: 10 İzinler + 13 Ayarlar (salt-okuma)

## Hedef
Codex worker'larının yazdığı commit'lenmemiş Dalga 3a değişikliklerini (10 İzinler, 13 Ayarlar + admin kullanıcı yönetimi) denetle ve `docs/ui-audit-2/review-wave3a.md` raporunu yaz.
Kapsam dosya listesi: `.claude/orca-specs/fix2-wave3a-paths.txt` (yalnız bunlar; `git diff -- <yol>`, yeni dosyalar için `cat`; yalnız listedeki dosyalar).
İlgili bulgu raporları + "Kararlar (Emre)": `docs/ui-audit-2/{10,13}-*.md`; sayfa spec'leri `.claude/orca-specs/fix2-{10,13}.md`; worker raporları `docs/ui-audit-2/fix-10-izinler-rapor.md`, `docs/ui-audit-2/fix-13-ayarlar-rapor.md`.
Koordinatörün `convex/schema.ts` değişiklikleri: leaves `by_project_type_end`, `by_project_employee_end`, `by_project_employee_type_end` (10-H1) — doğru kullanıldığını kontrol et. `leaves.source` alanı ve `attendanceCorrections`/`alarmSettings` tabloları BAŞKA oturumun işi (kapsam dışı).

DİKKAT: Aynı ağaçta başka oturumlar çalışıyor (Hik-Connect kıyas: alarm, Kişiler Excel, izin başvuru backend'i `convex/leaveRequests.ts`/`attendanceCorrections.ts`; paralel PDKS/Raporlar worker'ları `src/components/settings/sections/components/OvertimeSettingsForm.tsx`, `convex/settings.ts`, `convex/lib/pdks*`, `src/lib/reports/**`). Bunlar kapsam DIŞI; tsc'de onların yarım dosyaları kırmızı olabilir — dosya adını yaz, bulgu sayma.
Önceki denetim örnekleri: `docs/ui-audit-2/review-wave1.md`, `review-wave2.md` (biçim ve derinlik aynı olsun).

## Neye bak (önem sırasıyla)
1. Doğruluk hataları ve gerilemeler: yanlış koşul, kırılan davranış, yarış, `null`/0 karışıklığı, saat dilimi (Europe/Istanbul) hataları, ortak bileşenlerin diğer tüketicileri (`grep -rn`).
2. Backend (`convex/{accessRules,visitors,shifts,auditLog}.ts`, `convex/lib/*`): yetki/proje kapsamı korunuyor mu; filtreler GERÇEKTEN sunucuda ve sayfalamadan ÖNCE mi (sayfa alındıktan sonra süzme = eksik sonuç); index kullanımı; okuma sayısı/kota (Convex Free plan, function-call bütçesi önemli). **Süzgeçsiz yol taraması**: değişen her public query/mutation için proje/rol filtresi atlanan bir yol var mı.
3. Kararlara uyum: her raporun "Kararlar (Emre)" bölümü; 10: yalnız tam gün izin, örtüşen onaylı izin engeli, eski pending/rejected salt okunur korunmuş mu, izin onay/ret iş kuralları değişmemiş mi; 10-O6 PDKS bağlantısı `employeeId` ile mi; 13: bildirim anahtarları ve eski SGK/resmi raporlar korunmuş mu, 13-O5 derin bağlantı (`/settings?tab=reports&report=...`) çalışıyor mu, kullanıcı yönetiminde rol/yetki yükseltme açığı var mı (admin olmayan kendine/başkasına rol verebiliyor mu), `convex/users.ts` liste filtresi proje kapsamlı mı, 06-O5 ziyaretçi KVKK metni yazımı `adminMutation` + URL doğrulaması.
4. Görsel/erişilebilirlik: Orca tarayıcısında kendi sekmeni aç (`orca tab create --url http://localhost:8081/home --worktree current --json`, HER komutta `--page <id>`; oturum açık). /leaves (liste + kişi/tür/dönem filtresi + sayaç + yeni izin formu aç-Escape + bir izin ayrıntısı), /settings (her sekme: Genel, Çalışma ve bordro, Bildirimler, Raporlar — `?tab=reports&report=...` derin bağlantısı dahil —, Gizlilik, Entegrasyonlar; Kullanıcılar/admin paneli + kullanıcı formu aç-Escape) sayfalarını aç (rota adları farklıysa sidebar'dan bul), ekran görüntüsü al (`orca screenshot --page <id> --json` → base64 PNG → `docs/ui-audit-2/review-wave3a/` altına), konsol hatası var mı bak (`orca eval`). Dev sunucu yoksa ya da Convex fonksiyonu canlıda yoksa (yeni fonksiyonlar henüz deploy EDİLMEDİ) bunu rapora "doğrulanamadı + neden" diye yaz, kendin deploy etme. İş bitince sekmeyi kapat.
5. Test kalitesi: yeni testler davranışı gerçekten doğruluyor mu (boş/aldatıcı test var mı).

## Kapı (kendin koş, sonucu rapora yaz)
- `node_modules/.bin/vitest run src/components/leaves src/components/settings src/components/admin convex/lib/leaveValidation.test.ts convex/privacyRetention.settings.test.ts convex/users.settings.test.ts` → sonuç sayıları.

## Yasak
Kod DEĞİŞTİRME (yalnız rapor + ekran görüntüleri). commit/push/deploy/`npx convex` YOK. Tarayıcıda Kaydet/Sil/Gönder/Ata/Kapı aç YOK (aç-incele-Escape).

## Rapor biçimi (Türkçe, sade)
Üstte 2-3 cümle sonuç + sayı (Engel / Düzeltilmeli / Not). Sonra tablo: ID (R3-E1, R3-D1, R3-N1) | önem | dosya:satır | sorun | öneri.
"Engel" = commit'ten önce düzeltilmesi şart. Kanıtsız bulgu yazma.

## worker_done
≤10 satır: Engel ve Düzeltilmeli bulguların tek satırlık listesi + rapor yolu (`--report-path`).
