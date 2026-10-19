# UI Audit 2 — sayfa 12 Denetim Kaydı (/audit-log)

## Hedef
NGS Plus web uygulamasının **Denetim Kaydı** sayfası (http://localhost:8081/audit-log) için UI/UX denetim raporunu
`docs/ui-audit-2/12-denetim-kaydi.md` dosyasına yaz. Rapor yazılıp kanıtları eklendiğinde iş biter.

## Bağlam
- A2 yeniden tasarımı (sade nötr + bordo sidebar) 2026-10-18'de canlıya çıktı. Bu tur, yeni arayüzün gerçek ekrandaki halini denetler.
- Önceki tarama (A2 öncesi): `docs/ui-scan/pages/11-denetim-kaydi/REPORT.md` (yoksa geç). Eski bulguları tekrar yazma; hâlâ açık olanları "hâlâ açık (eski ID)" diye işaretle.
- Tasarım dili: `docs/ui-scan/DESIGN_DIRECTION.md` + `docs/ux-audit/DESIGN_SYSTEM.md` ("A2 bileşenleri" bölümü).
- Sayfa giriş noktası: `src/pages/AuditLog.tsx`, `src/components/audit/**`, ilgili Convex (`convex/auditLog.ts`). Bileşenleri buradan izle.
- Kapsam: kayıt listesi, filtreler (aktör, eylem, varlık, tarih aralığı, "Sistem" filtresi), tarihsel aktör gösterimi, kayıt ayrıntısı (önce/sonra farkı), sayfalama, boş durumlar. Bugün yapılan denetimler sırasında kayıt oluşmuş olabilir; en yeni kayıtlarda tutarlılığı kontrol et.
- Kararlar (C-fazı): "Filtreleri temizle" proje kapsamını korur; denetim CSV dışa aktarma şimdilik YOK.
- Gizlilik: ayrıntıda sır (şifre/token/anahtar) veya gereksiz kişisel veri (T.C. no, ücret) açık görünüyorsa Yüksek yaz; değeri rapora yazma.
- Bilinen sorun türleri: sayfa içi filtre (06-H1/10-H1), ISO tarih (09-O3), tarayıcı saat dilimine bağlı tarih (08-O2), ham teknik anahtarların kullanıcıya gösterilmesi (05-O2).
- Kabuk 01'de denetlendi; yalnız bu sayfaya özgü sorunları yaz.

## Tarayıcı (Orca gömülü tarayıcı; oturum açık)
- Kendi sekmeni aç, kullanıcının sekmesine DOKUNMA:
  `orca tab create --url http://localhost:8081/audit-log --worktree current --json` → dönen `browserPageId`.
  Masaüstü için bir sekme, mobil için ikinci sekme aç; mobil sekmede `orca set device --page <id> --name "iPhone 12"` (390px).
- HER orca komutunda `--page <id>` ver (vermezsen kullanıcının aktif sekmesine gider).
- Ekran görüntüsü: `orca screenshot --page <id> --json` → `result.data` base64 PNG → `docs/ui-audit-2/12-denetim-kaydi/` altına kaydet, Read ile bak.
- Mobil ekran görüntüsü bilinen sorun: emülasyonda görüntü dikeyde 3 kez tekrar eder; yalnız ÜST parça gerçektir (~312 CSS px yükseklik).
  Üst parçayı kırp (`python3 -c` + PIL varsa; yoksa `sips --cropOffset 0 0 --cropToHeightWidth <h> <w>`), main'i ~280px adımlarla kaydırıp her adımda çek.
- Sayfa `main` elemanı içinde kayar: `orca eval --page <id> --expression "document.querySelector('main').scrollTop=800"`.
- Diğer komutlar: `orca snapshot --page <id>` (erişilebilirlik ağacı + @e ref), `orca click --page <id> --element @eN`, `orca keypress --page <id> --key Escape|Tab`.
- İş bitince açtığın sekmeleri kapat: `orca tab close --page <id> --json`.

## Kontrol listesi
1. Ekran: masaüstü ve 390px mobil, sayfayı baştan sona kaydırarak. Hiza, boşluk, tipografi, kontrast, A2 tutarlılığı, taşma/kesilme, boş/yükleme/hata durumları.
2. Etkileşim: her buton/link/menü/filtre/sekme ne yapıyor, çalışıyor mu; modal/sheet açılıp kapanıyor mu; klavye (Tab/Escape) ve odak halkası.
3. İçerik: Türkçe metinler (yazım, tutarlılık, anlaşılırlık), sayı doğruluğu (ekrandaki sayı = sorgunun anlamı mı), tarih/saat Türkiye formatı ve UTC+3.
4. Kod: ilgili bileşenler + çağırdığı Convex sorguları. UI hataları, aktif proje kapsamı, erişilebilirlik (aria-label, rol), gereksiz/ağır sorgu, tutarsız bileşen kullanımı.

## Yasaklar
- Kod/dosya DEĞİŞTİRME (yalnız rapor + ekran görüntüleri yazılır). commit/push/deploy YOK. Convex mutation / DB yazma YOK.
- Kaydet / Sil / Onayla / "Cihazlara gönder" / cihaza komut gönderen ya da veri değiştiren butonlara BASMA. Modal/form açmak serbest, sonra İptal veya Escape.
- Aktif proje seçicisini değiştirme. Şifre girme. Dev sunucusunu yeniden başlatma.

## Rapor biçimi (Türkçe, sade dil; jargonu parantezle açıkla)
1. Üstte 2-3 cümle özet + sayı tablosu (Yüksek / Orta / Düşük).
2. Bulgular tablosu, önemliler önce, en fazla 20: `ID (12-H1, 12-O1, 12-D1)` | önem | kategori (görsel/etkileşim/içerik/erişilebilirlik/performans/hata) | ne görülüyor | neden sorun | öneri | kanıt (`file:line` veya ekran görüntüsü dosyası).
   Kanıtı olmayan bulgu yazma. Tahmin ise "doğrulanmadı" de.
3. "Hızlı düzeltmeler" (her biri ≤30 dk) listesi.
4. "Ürün kararı gereken" sorular (varsa, en fazla 3).

## worker_done
≤10 satır: Yüksek bulguların tek satırlık listesi + rapor yolu. `--report-path docs/ui-audit-2/12-denetim-kaydi.md`.
