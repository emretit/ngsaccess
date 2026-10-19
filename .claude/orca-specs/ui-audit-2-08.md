# UI Audit 2 — sayfa 08 PDKS Kayıtları (/pdks-records)

## Hedef
NGS Plus web uygulamasının **PDKS Kayıtları** sayfası (http://localhost:8081/pdks-records) için UI/UX denetim raporunu
`docs/ui-audit-2/08-pdks-kayitlari.md` dosyasına yaz. Rapor yazılıp kanıtları eklendiğinde iş biter.

## Bağlam
- A2 yeniden tasarımı (sade nötr + bordo sidebar) 2026-10-18'de canlıya çıktı. Bu tur, yeni arayüzün gerçek ekrandaki halini denetler.
- Önceki tarama (A2 öncesi): `docs/ui-scan/pages/08-pdks-kayitlari/REPORT.md` (yoksa geç). Eski bulguları tekrar yazma; hâlâ açık olanları "hâlâ açık (eski ID)" diye işaretle.
- Tasarım dili: `docs/ui-scan/DESIGN_DIRECTION.md` + `docs/ux-audit/DESIGN_SYSTEM.md` ("A2 bileşenleri" bölümü).
- Sayfa giriş noktası: `src/pages/PDKSRecords.tsx`, `src/components/pdks/**` (dashboard/, lib/, ManualPdksEditDialog, AI bileşenleri), ilgili Convex (`convex/pdks*.ts`, `convex/cardReadings.ts` PDKS kısmı). Bileşenleri buradan izle.
- Kapsam: dönem/tarih seçimi, çalışan-gün tablosu, durum filtresi, gün ayrıntısı, manuel düzeltme diyaloğu (aç, gerekçe zorunluluğunu incele, KAYDETME), bordro cetveli/dışa aktarma görünümü, AI özet/sohbet bileşenleri (görünümü incele).
- ÖZELLİKLE YASAK: manuel düzeltme kaydı, AI sohbetine mesaj gönderme (maliyet + kayıt), dışa aktarma dosyası indirme serbest DEĞİL (gerekirse yalnız butonu incele).
- Hukuki bağlam: KVKK 2026/921 — mesai takibinde yüz/parmak izi (biyometrik) açık rızayla bile yasak. Biyometrik olaylar PDKS hesabına girmemeli ve ekranda PDKS kaydı gibi gösterilmemeli; buna aykırı görünüm/kod varsa Yüksek yaz.
- Tarih/saat: tüm saatler UTC+3 (Europe/Istanbul); gece yarısını geçen vardiya ve gün sınırı hesaplarını ekranda/kodda kontrol et.
- Bilinen sorun türleri: sayfa içi filtre (06-H1), veri yokken sahte 0 (01-O1), "İleri/Kaydet" aynı buton (05-H1).
- Kabuk 01'de denetlendi; yalnız bu sayfaya özgü sorunları yaz.

## Tarayıcı (Orca gömülü tarayıcı; oturum açık)
- Kendi sekmeni aç, kullanıcının sekmesine DOKUNMA:
  `orca tab create --url http://localhost:8081/pdks-records --worktree current --json` → dönen `browserPageId`.
  Masaüstü için bir sekme, mobil için ikinci sekme aç; mobil sekmede `orca set device --page <id> --name "iPhone 12"` (390px).
- HER orca komutunda `--page <id>` ver (vermezsen kullanıcının aktif sekmesine gider).
- Ekran görüntüsü: `orca screenshot --page <id> --json` → `result.data` base64 PNG → `docs/ui-audit-2/08-pdks-kayitlari/` altına kaydet, Read ile bak.
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
2. Bulgular tablosu, önemliler önce, en fazla 20: `ID (08-H1, 08-O1, 08-D1)` | önem | kategori (görsel/etkileşim/içerik/erişilebilirlik/performans/hata) | ne görülüyor | neden sorun | öneri | kanıt (`file:line` veya ekran görüntüsü dosyası).
   Kanıtı olmayan bulgu yazma. Tahmin ise "doğrulanmadı" de.
3. "Hızlı düzeltmeler" (her biri ≤30 dk) listesi.
4. "Ürün kararı gereken" sorular (varsa, en fazla 3).

## worker_done
≤10 satır: Yüksek bulguların tek satırlık listesi + rapor yolu. `--report-path docs/ui-audit-2/08-pdks-kayitlari.md`.
