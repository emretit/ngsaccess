SALT-OKUMA UI + KOD DENETİMİ (Claude). Kod/dosya yazma YOK (yalnız rapor dosyası), commit/push/deploy/`npx convex *`/DB yazma YOK.

## Hedef
`http://localhost:8081/devices` sayfasındaki drawer'ları (cihaz detay paneli ve içindeki her sekme/bölüm) ayrıntılı incele; sorunları, eksikleri ve iyileştirmeleri önceliklendirilmiş rapor olarak yaz.

## Kapsam
- Kod: `src/pages/Devices.tsx`, `src/components/devices/DeviceDetailsPanel.tsx`, `src/components/devices/DeviceCommandCenter.tsx` ve bunların import ettiği `src/components/devices/**` bileşenleri + çağırdıkları Convex fonksiyonları (`convex/devices.ts`, `convex/doors.ts`, `convex/readers.ts` vb. — yalnız okuma).
- Canlı arayüz: Orca gömülü tarayıcı. Emre'nin sekmesine DOKUNMA; kendi sekmeni aç: `orca tab create --url "http://localhost:8081/devices" --json` → dönen `browserPageId`'yi HER komutta `--page <id>` ile kullan. Ekran: `orca screenshot --page <id> --json` (result.data base64 PNG → dosyaya yaz, Read ile bak). Durum: `orca eval --page <id> --expression "..."`. Bitince sekmeyi kapat: `orca tab close --page <id>`.
- Her cihaz türü için drawer'ı aç (Hik gateway, Hik localBridge, IDE Smart — listede ne varsa), tüm sekmeleri/bölümleri gez; 1440 px ve dar (≈390 px, `orca eval` ile pencere değil drawer davranışına bak) görünümü değerlendir.

## KESİN YASAK (canlı cihazlara komut gider)
"Kapıyı aç", "Yeniden başlat", "Senkronla/Gönder", "Kaydet", "Sil", "Serbest bırak", "Saat eşitle", parametre yazma, kart/kişi gönderme gibi DURUM DEĞİŞTİREN hiçbir butona/menü öğesine tıklama, form gönderme. Yalnız drawer aç/kapat, sekme değiştir, kaydır, hover. Bir buton ne yapar belirsizse TIKLAMA, koddan oku.

## Bakılacaklar
1. İşlev: her bölüm doğru veriyi gösteriyor mu, boş/yükleniyor/hata durumları, cihaz çevrimdışıyken davranış, rol (super_admin / project_admin / project_user) farkları koddan.
2. Tutarlılık: başlık/etiket/terimler (Türkçe, sade), tarih-saat İstanbul saati, aynı bilginin iki yerde farklı gösterilmesi, A2 tasarım diline uyum (diğer sayfalardaki drawer'larla kıyas: Kişiler detay paneli).
3. Güvenlik/yanlış işlem riski: tehlikeli butonlarda onay diyaloğu var mı, yetkisiz rol görüyor mu, sır alanları (şifre/token) maskeli mi.
4. Erişilebilirlik: odak yönetimi, ESC ile kapanma, klavye, aria etiketleri, kontrast.
5. Kod kalitesi: 677 satırlık DeviceCommandCenter — ölü kod, tekrar, gereksiz Convex aboneliği/sorgu (Convex Free kotası aşılmış durumda: drawer açıkken kaç reaktif sorgu çalışıyor).

## Çıktı
- Rapor dosyası: `docs/ui-audit-devices-drawer/RAPOR.md` (Türkçe, sade). Üstte 3 cümle özet; sonra bulgular tablosu: ID · Öncelik (Yüksek/Orta/Düşük) · Bölüm · Sorun · Kanıt (file:line ve/veya ekran görüntüsü yolu) · Öneri. Sonunda "Hızlı kazanımlar (≤30 dk)" listesi.
- Ekran görüntüleri: `docs/ui-audit-devices-drawer/shots/*.png`.
- `worker_done` ≤10 satır: bulgu sayıları (Y/O/D), en kritik 3 bulgu, rapor yolu.
