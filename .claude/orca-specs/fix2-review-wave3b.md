# Denetim — UI Audit 2 düzeltmeleri, Dalga 3b: 08 PDKS + 4A Raporlar + 4B gece vardiyası (salt-okuma)

## Hedef
Codex worker'larının yazdığı commit'lenmemiş değişiklikleri denetle ve `docs/ui-audit-2/review-wave3b.md` raporunu yaz.
Kapsam dosya listesi: `.claude/orca-specs/fix2-wave3b-paths.txt` (yalnız bunlar; `git diff -- <yol>`, yeni dosyalar için `cat`). `convex/cardReadings.ts`'te Dalga 1 (canlı izleme) değişiklikleri de var — onları Dalga 1 denetimi (`review-wave1.md`) gördü; sen PDKS fonksiyonlarına, `listReportTransactions`'a ve `getMonthlyPayrollSheet`'e odaklan.
Bulgu raporları + "Kararlar (Emre)": `docs/ui-audit-2/{08,11,13,09}-*.md` (13-H1 ek kararı dahil); spec'ler `.claude/orca-specs/fix2-{08,11,gece}.md`; worker raporu `docs/ui-audit-2/fix-08-pdks-rapor.md`.
Koordinatör kararları (spec dışında iletilen): ilk geçerli okuma = artan sırada `.take(20)` içinde ilk PDKS-geçerli, yoksa aralıktaki ilk geçerli (öncesi noData); gece çarpanı birleşimi AYARLANABİLİR (`overtimeRates.nightCombineMode` max|multiply|additive, boş=max), YALNIZ gece penceresindeki fazla mesaiye; normal gece çalışmasına prim YOK.
DİKKAT: Aynı ağaçta başka oturumlar çalışıyor (Hik-Connect kıyas: `convex/alarms.ts`, `employeeImport`, `leaveRequests`, `attendanceCorrections`, `src/lib/employees/**`). Kapsam DIŞI; tsc'de onların yarım dosyaları kırmızıysa dosya adını yaz, bulgu sayma.
Önceki denetim örnekleri: `docs/ui-audit-2/review-wave1.md`, `review-wave2.md` (biçim ve derinlik aynı olsun).

## Neye bak (önem sırasıyla)
1. **Hesap doğruluğu (en önemli — bordro/ücret verisi):** `computePdksDay` tek hesap yolu mu (tablo, kişi detayı, aylık bordro, rapor yükleyicisi hepsi onu mu çağırıyor; kalan ikinci yol var mı `grep -rn`); gece vardiyası iş günü gruplaması (`convex/lib/pdksWorkDay.ts`) — ay/dönem sınırında (ayın son günü 22:00 → ertesi ayın 1'i 06:00) okuma kayboluyor ya da iki kez sayılıyor mu; ertesi günü okuyan sorgular aralığı doğru genişletiyor mu; vardiyasız kişide eski takvim günü davranışı aynı mı; mola kuralı; fazla mesai ≤ toplam; gece dakikası penceresi (22–06) gece yarısını doğru geçiyor mu; üç çarpan modu + boş=max; "Veri yok"/"Henüz gelmedi"/ilk kayıt öncesi "—" sayaçlara girmiyor mu; 08-O3 belirsiz kaynak PDKS dışı; saat dilimi (Europe/Istanbul, `todayInTurkey`).
2. Backend yetki/kapsam: değişen her public query/mutation proje + rol kapsamlı mı (`getPdksTableData`, `getMonthlyPayrollSheet`, `getEmployeeAttendanceDetail`, `listReportTransactions` departmentId doğrulaması, `pdksRecords.upsertManual`/`bulkUpsertManual`, `settings` saveOvertime, 08-O4 CSV içe aktarma yalnız aktif proje + admin). Ücret alanları `payVisibility` kurallarına uyuyor mu (project_user ücret görmez). **Süzgeçsiz yol taraması** (grep tabanlı).
3. Okuma maliyeti / kota (Convex Free, function-call ve okuma bütçesi): ilk kayıt araması kişi başı sınırlı mı, sayfalama öncesi süzme `filterWith` + `maximumRowsRead`, ertesi gün genişletmesi okuma sayısını ne kadar artırıyor; reaktif aboneliklerde gereksiz tam tarama var mı.
4. Kararlara uyum: 08 + 11 + 13-H1 kararları; Raporlar frontend'i Ayarlar dosyalarına dokunmamış mı (13-O5 anahtarları `ReportsSettings.tsx`'ten okunuyor mu); Canlı İzleme sorguları değişmemiş mi.
5. Görsel/erişilebilirlik: Orca tarayıcısında kendi sekmeni aç (`orca tab create --url http://localhost:8081/home --worktree current --json`, HER komutta `--page <id>`; oturum açık). /pdks-records (tablo, kişi detay çekmecesi, manuel düzeltme formu aç-Escape, `?employeeId=` bağlantısı), /reports (hub, bir günlük, bir aylık rapor, Ham Okutmalar kişi/departman filtresi, Resmi → derin bağlantı), /settings?tab=work (Mesai ve tatil: gece çarpanı seçici) sayfalarını aç (rota adları farklıysa sidebar'dan bul), ekran görüntüsü al (`orca screenshot --page <id> --json` → base64 PNG → `docs/ui-audit-2/review-wave3b/` altına), konsol hatası var mı bak (`orca eval`). Yeni Convex fonksiyonları canlıda YOK (deploy edilmedi): hata görürsen "deploy bekliyor" diye yaz, kendin deploy etme. İş bitince sekmeyi kapat.
6. Test kalitesi: yeni testler davranışı gerçekten doğruluyor mu (özellikle `pdksNight.handlers.test.ts`, üç yol eşitliği testi, `reportTransactions.backend.test.ts`).

## Kapı (kendin koş, sonucu rapora yaz)
- `node_modules/.bin/vitest run convex src/components/pdks src/lib/reports src/components/reports src/components/settings` → sonuç sayıları.
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → hata sayısı (kapsam dışı dosyaları ayır).

## Yasak
Kod DEĞİŞTİRME (yalnız rapor + ekran görüntüleri). commit/push/deploy/`npx convex` YOK. Tarayıcıda Kaydet/Sil/Gönder/Ata/İçe aktar YOK (aç-incele-Escape).

## Rapor biçimi (Türkçe, sade)
Üstte 2-3 cümle sonuç + sayı (Engel / Düzeltilmeli / Not). Sonra tablo: ID (R3B-E1, R3B-D1, R3B-N1) | önem | dosya:satır | sorun | öneri.
"Engel" = commit'ten önce düzeltilmesi şart (yanlış ücret/süre hesabı Engel'dir). Kanıtsız bulgu yazma; hesap hatası iddiasını somut girdi → beklenen/gerçek çıktı ile göster.

## worker_done
≤10 satır: Engel ve Düzeltilmeli bulguların tek satırlık listesi + rapor yolu (`--report-path`).
