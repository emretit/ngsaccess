# GENEL AKIŞ AUDIT — GRUP C: Müşteri kurulumu + cihaz + alarm + yönetim (SALT-OKUMA)

ÖNCE oku ve uy: `/Users/emreaydin/ngsaccess/.claude/orca-specs/genel-akis-ortak.md` (yasaklar, yöntem, etiketler, rapor biçimi).
Rapor: `/Users/emreaydin/ngsaccess/docs/genel-akis-audit/C-kurulum-cihaz-yonetim.md` (YALNIZ bu dosyayı yaz).

## Akışlar
C1. **Yeni müşteri kurulumu (sıfırdan ilk geçişe):** super_admin proje oluşturur → proje yöneticisi davet/giriş → bölge/kapı tanımı → cihaz ekleme → ilk çalışan → ilk başarılı geçiş. Her adımda kullanıcı "sırada ne var"ı biliyor mu (boş durum ekranları, yönlendirme)? Kaç ekran dolaşılıyor?
C2. **Cihaz ekleme/provizyon, tip tip:** Hik gateway (ISUP, K1T804/K1T807), Hik ISAPI/köprü (Windows bridge, DS-K2804 SDK), IDE Smart (MQTT, "Broker'a Al"), ESP32 kart okuyucu (Hetzner köprü). Hangi tip web'den uçtan uca eklenebiliyor, hangisi geliştirici/terminal adımı istiyor?
C3. **Cihaz sağlığı:** bağlantı durumu, çevrimdışı tespiti (W6 bağlantı geçmişi; Hik gateway yalnız kart okutunca sinyal verir), komut kuyruğu, yeniden deneme, cihaz kapı planı (W6 haftalık).
C4. **Alarm/olay:** olay → alarm merkezi (alarm/arıza) → e-posta bildirimi → onay (acknowledge) → denetim kaydı. Hik-Connect Event Notification/alarm kuralı ile kıyas.
C5. **Kullanıcı ve yetki yönetimi:** roller (super_admin/project_admin/project_user), davet, dondurma/erişim bitişi (W3b), 7 gün oturum, çok projeli kullanıcı, proje değiştirme, sistem admin sayfası, denetim kaydı + Excel (W6).
C6. **KVKK/ayarlar:** rıza (consents), veri saklama/silme, firma ayarları, bildirim ayarları.

## Odak
- C1 "ilk günden ilk geçişe" sürtünmesi: ürünün satılabilirliği için kritik — adım sayısı, takıldığı yer, geliştirici gerektiren adım.
- Çok kiracılı (multi-tenant) yetki sızıntısı.
- Convex Free kota riski (polling, reaktif sorgu) — geçmiş olaylar: IDE poll, Hik köprü roster poll (hafızada); yeni polling var mı.
Kapsam dışı: kişi yetki senkronu (Grup A); PDKS/rapor (Grup B).
