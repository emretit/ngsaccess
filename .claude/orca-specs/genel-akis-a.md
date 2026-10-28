# GENEL AKIŞ AUDIT — GRUP A: Kişi yaşam döngüsü + erişim (SALT-OKUMA)

ÖNCE oku ve uy: `/Users/emreaydin/ngsaccess/.claude/orca-specs/genel-akis-ortak.md` (yasaklar, yöntem, etiketler, rapor biçimi).
Rapor: `/Users/emreaydin/ngsaccess/docs/genel-akis-audit/A-kisi-erisim.md` (YALNIZ bu dosyayı yaz).

## Akışlar
A1. **Çalışan ekleme:** tekli form + Excel içe aktarma → kart no / parmak izi kaydı (Hik gateway) → fotoğraf/yüz (KVKK: erişim için mi PDKS için mi?) → hangi cihazlara gider.
A2. **Erişim yetkisi verme:** grup/kural/erişim zaman şablonu (W4.1) → kapı seçimi (çok kapılı Hik cihazı, W4.0) → cihaza senkron (Hik gateway/ISAPI, IDE MQTT, ESP32 bulut kararı, Windows köprü) → yetki durumu ekranı (W4.2) "Etkin/Bekliyor/Hata" → hata olunca yönetici ne yapar (yeniden dağıt).
A3. **Günlük geçiş:** kart/parmak okutma → izin/ret kararı (cihazda mı bulutta mı) → olay Convex'e düşer → geçiş kaydı + PDKS'e aktarım noktası (Grup B'ye devir noktasını işaretle, PDKS hesabına girme) · web/mobil uzaktan kapı açma.
A4. **Değişiklik:** kart değiştirme/kaybetme, grup değiştirme, kural silme → cihazdan eski yetki kalkıyor mu (sızan erişim = en kritik risk).
A5. **Erişim sonu:** hesap dondurma / erişim bitiş tarihi (W3b) · işten ayrılma (W2, ileri tarihli) · KVKK silme → cihazlardan kişi/kart/parmak izi siliniyor mu, her cihaz tipinde.
A6. **Ziyaretçi:** kayıt → geçici erişim → süre bitiminde kapanış (cron) → cihazdan silinme.

## Odak
- Erişim sızıntısı (silinmesi gereken yetkinin cihazda kalması) ve fail-open yollar en yüksek öncelik.
- Cihaz tipleri arası eşitsizlik (bir tipte çalışıp diğerinde çalışmayan adım).
- Kullanıcıya senkron hatasının görünürlüğü.
Kapsam dışı: PDKS hesapları, raporlar (Grup B); cihaz ekleme/provizyon, alarm (Grup C).
