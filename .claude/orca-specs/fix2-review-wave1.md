# Denetim — UI Audit 2 düzeltmeleri, Adım 0 + Dalga 1 (salt-okuma)

## Hedef
Codex worker'larının yazdığı commit'lenmemiş değişiklikleri denetle ve `docs/ui-audit-2/review-wave1.md` raporunu yaz.
Kapsam dosya listesi: `.claude/orca-specs/fix2-wave1-paths.txt` (yalnız bunlar; `git diff -- <yol>` ve yeni dosyalar için `cat`).
İlgili bulgu raporları + "Kararlar (Emre)": `docs/ui-audit-2/{01,02,03,04,07}-*.md`; ortak düzeltmeler spec'i `.claude/orca-specs/fix2-00-ortak.md`;
sayfa spec'leri `.claude/orca-specs/fix2-{01-04,02,03,07}.md`; worker raporları `docs/ui-audit-2/fix-0{2,3}-*-rapor.md`, `docs/ui-audit-2/07-kapi-esleme-arastirma.md`.

## Neye bak (önem sırasıyla)
1. Doğruluk hataları ve gerilemeler: yanlış koşul, kırılan davranış, yarış, `null`/0 karışıklığı, eski API'ye uyumsuzluk (ortak bileşenlerin diğer tüketicileri: `grep -rn` ile kontrol et).
2. Backend (`convex/cardReadings.ts`): yetki/proje kapsamı korunuyor mu; yeni kaynak filtresi GERÇEKTEN sunucuda ve sayfalamadan ÖNCE mi (sayfa alındıktan sonra süzme = 06-H1 türü hata); index kullanımı; okuma sayısı/kota. **Süzgeçsiz yol taraması**: değişen her public query/mutation için proje/rol filtresi atlanan bir yol var mı (grep tabanlı).
3. Kararlara uyum: 02-O5/02-D5 dokunulmamış mı, 03-O9 sırlar backend'de aynen mi, 03-O1 komutlar aktif + uyarı mı, 07-O3 tarih yalnız Geçmiş'te mi, cihaza komut gönderen kodun davranışı değişmemiş mi.
4. Görsel/erişilebilirlik: Orca tarayıcısında kendi sekmeni aç (`orca tab create --url http://localhost:8081/home --worktree current --json`, HER komutta `--page <id>`; oturum açık). /home, /virtual-readers, /employees (bir kişinin ayrıntısı), /devices (bir cihazın ayrıntısı), /live-monitoring (Canlı + Geçmiş + kaynak filtresi) sayfalarını aç, ekran görüntüsü al (`orca screenshot --page <id> --json` → base64 PNG → `docs/ui-audit-2/review-wave1/` altına), konsol hatası var mı bak (`orca eval`). İş bitince sekmeyi kapat.
5. Test kalitesi: yeni testler davranışı gerçekten doğruluyor mu (boş/aldatıcı test var mı).

## Yasak
Kod DEĞİŞTİRME (yalnız rapor + ekran görüntüleri). commit/push/deploy/`npx convex` YOK. Tarayıcıda Kaydet/Sil/Gönder/Ata/Kapı aç YOK (aç-incele-Escape).

## Rapor biçimi (Türkçe, sade)
Üstte 2-3 cümle sonuç + sayı (Engel / Düzeltilmeli / Not). Sonra tablo: ID (R1-E1, R1-D1, R1-N1) | önem | dosya:satır | sorun | öneri.
"Engel" = commit'ten önce düzeltilmesi şart. Kanıtsız bulgu yazma.

## worker_done
≤10 satır: Engel ve Düzeltilmeli bulguların tek satırlık listesi + rapor yolu (`--report-path`).
