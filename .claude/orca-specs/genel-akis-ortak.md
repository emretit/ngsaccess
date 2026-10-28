# GENEL AKIŞ AUDIT — ORTAK KURALLAR (her grup spec'i bunu içerir)

Çalışma dizini: `/Users/emreaydin/ngsaccess` (main, `4e2d565`). Worktree AÇMA.

## Amaç
ngsaccess'in uçtan uca iş akışlarını (bir müşterinin/yöneticinin/çalışanın gerçek günlük kullanımı) adım adım izle; her adımda
"çalışıyor mu, kopuk mu, eksik mi" sorusunu KODDAN kanıtla ve Hik-Connect'in aynı akışıyla kıyasla. Hedef: Emre'nin (teknik
olmayan karar verici) okuyup "sırada ne yapmalıyız" diyebileceği bir tablo. Özellik listesi DEĞİL, AKIŞ: bir adımın çıktısı bir
sonrakinin girdisi mi, arada kullanıcı takılıyor mu, veri kayboluyor mu, iki modül birbirini görmüyor mu.

## Girdiler
- Hik-Connect tersine mühendislik: `docs/HIKCONNECT_BIRLESIK.md` (§2-§4 Hik sayfa/akışları, §6 kıyas, §7, §8 yol haritası, §10 bilinmeyenler),
  `docs/hikconnect-audit/{HIKCONNECT_SAYFALAR,KIYAS,NGSACCESS_ENVANTER}.md`, `docs/hikconnect-reports/README.md`.
- DİKKAT: bu dokümanlar 2026-10-19/21 tarihli ve ESKİ. O tarihten sonra main'e girenler (kodda doğrula, dokümana güvenme):
  W1 talepler ekranı, W2 işten ayrılma, W3b hesap dondurma/erişim bitişi/7 gün oturum, W4.0 Hik kapı kapsamı + bulut saat kontrolü,
  W4.1 erişim zaman şablonları, W4.2 cihaz başı yetki durumu, W5 PDKS kural sürümleri/check point/esnek vardiya/export kolon seçici,
  W6 denetim Excel/vardiya toplu temizle/haftalık kapı planı/cihaz bağlantı geçmişi, parmak izi kaydı (Hik gateway), cihazlar drawer,
  KVKK biyometrik PDKS yasağı (Faz 1). `git log --oneline -60` ile bak.
- Kod: `convex/**` (backend), `src/**` (web), `mobile/**` (Flutter çalışan/yönetici uygulaması — yalnız OKU), `src/App.tsx` + routeMeta (sayfalar).

## YASAK
Rapor dosyası dışında HİÇBİR dosya yazma/düzenleme · commit/push/deploy · `npx convex *` / `convex` CLI · DB okuma/yazma ·
Supabase MCP (bu proje Convex; Supabase araçları Pafta'nın canlı DB'si — DOKUNMA) · cihazlara/ağa istek · paket kurma · tarayıcı.

## Yöntem
1. Grubundaki her akışı 5-12 adıma böl (ör. "yönetici çalışanı ekler → kart tanımlar → kapı yetkisi verir → cihaza gider → çalışan kartı okutur → geçiş PDKS'e düşer").
2. Her adım için kodda giriş noktasını bul (sayfa/bileşen → Convex fn → cihaz/senkron yolu) ve file:line ver.
3. Adımlar arası BAĞLANTIYI kontrol et: veri bir sonraki adıma doğru alanla ulaşıyor mu; hata olunca kullanıcı görüyor mu; yetki (super_admin / project_admin / project_user) her adımda tutarlı mı; çok projeli (multi-tenant) sızıntı var mı; cihaz tipine göre (Hik gateway/ISAPI, IDE MQTT, ESP32 bulut, Windows köprü) dallar eşit mi.
4. Hik-Connect'te aynı akış nasıl (RE dokümanından); bizde eksik/fazla ne.
5. Emin olmadığın yerde "TEYİT GEREK (canlı/cihaz)" yaz; tahmini bulgu gibi sunma.

## Durum etiketleri
- **TAMAM** — uçtan uca çalışır, kanıt var.
- **YARIM** — çalışır ama bir dal/cihaz tipi/rol eksik ya da kullanıcı takılır.
- **KOPUK** — iki adım arasında veri/kontrol kayboluyor; kullanıcı işi bitiremez veya yanlış sonuç alır.
- **EKSİK** — Hik-Connect'te var, bizde yok (ve akış için gerekli).
- **FAZLA** — bizde var, kimse kullanamıyor / ölü yol.

## Rapor (dosya yolu grup spec'inde)
Türkçe, SADE dil (jargonu parantezde açıkla). Bölümler:
1. **Sonuç (2-3 cümle):** bu grupta genel durum.
2. **Akış tabloları:** her akış için tablo: `# | Adım (kullanıcı gözünden) | Bizde (file:line) | Hik-Connect | Durum | Kullanıcı ne yaşar | Öneri (+ kaba emek: S ≤2 sa / M ≤1 gün / L >1 gün)`.
3. **En önemli 5 bulgu** (öncelik sırası; her biri: neden önemli, kanıt file:line, öneri, emek).
4. **TEYİT GEREK listesi** (canlı sistemde/cihazda bakılması gerekenler).
5. **Kapsam dışı bıraktıkların.**
Rapor ≤ 400 satır. `worker_done` özetinde ≤10 satır + rapor yolu.
