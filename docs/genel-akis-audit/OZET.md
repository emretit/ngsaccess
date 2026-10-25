# Genel akış audit'i — özet ve plan taslağı (2026-10-22)

## Plan taslağı (checklist — Emre onayı bekliyor)

### Faz 1 — Yetki açıklarını kapat (P0, ~1,5-2 gün)
- [ ] 1.1 Erişim kuralı yazma/silme yalnız yönetici (`convex/accessRules.ts:674/709/798/871` `authedMutation` → yönetici kontrolü)
- [ ] 1.2 Bölge/kapı/okuyucu yazma yalnız yönetici + kapıya bağlanan cihaz aynı projede mi kontrolü (`convex/doors.ts:247-295`, `zones.ts:34`, `readers.ts:114`)
- [ ] 1.3 Tatil okuma/yazmada proje kontrolü (`convex/holidays.ts:14/60/96/113`)
- [ ] 1.4 Çalışan PDKS denetim geçmişinde proje + çalışan kontrolü (`convex/auditLog.ts:22-70`)
- [ ] 1.5 Kart olayını yalnız cihazın projesindeki kişiyle eşleştir; toplu kart atamada projeler arası çakışma (`convex/cardReadings.ts:1001/1067`, `employeeImport.ts:109`)
- [ ] 1.6 Her biri için "başka proje / düşük rol reddedilir" testleri

### Faz 2 — Erişimi geri almayı güvenilir yap (P0, ~2-3 gün + cihaz testi)
- [ ] 2.1 Kart değişince eski kartı Hik cihazından da sil (`convex/lib/employeeCardChange.ts:13-22`; Hik'te kişi = kart no)
- [ ] 2.2 Kural silinince eski cihazlardan yetkiyi kaldır (`accessRules.ts:846/858`, `hikvisionSync.ts:128`)
- [ ] 2.3 Kişi silindikten sonra başarısız cihaz silmesi yeniden denenebilsin; "kaldırma bekliyor" listesi (`hikQueueWorker.ts:127`, `deviceSyncRuns.ts:714`)
- [ ] 2.4 Ziyaretçi bitiş saatini cihaza da yaz (Hik bitişi şu an 2037) (`gateway/persons.ts:74/95`, `visitors.ts`)
- [ ] 2.5 Cihazda test: eski kart, silinen kural, çevrimdışı silme, ziyaretçi bitişi

### Faz 3 — Puantaj doğruluğu (P0/P1, ~3-4 gün)
- [ ] 3.1 Eski kurallı projede fazla mesai formülü (ay boyu saat − tek hafta 45 sa) (`convex/reports.ts:119`)
- [ ] 3.2 SGK özet/APHB tek ortak hesaptan; manuel düzeltmeler dahil; "taslak/örnek biçim" etiketi (`sgkExport.ts:65/105`, `sgkCodes.ts:80`)
- [ ] 3.3 Kişiye atanan vardiya günü (weekPattern) puantajın iş günü/tatil ayrımına geçsin (`pdksHelpers.ts:172`)
- [ ] 3.4 Çift yönlü okuyucuda gece vardiyası çıkışı gece yarısı "giriş"e dönmesin (`cardReadingProcess.ts:55/72`) — önce canlıda `both` cihaz var mı bak

### Faz 4 — Çalışan talep döngüsü (P1, mobil ekip, ~2-3 gün)
- [ ] 4.1 Mobilde izin + PDKS düzeltme talebi aç / geri çek / sonucu gör (backend hazır, mobil çağırmıyor)
- [ ] 4.2 Onay/red sonrası çalışana bildirim

### Faz 5 — Kurulum, cihaz sağlığı, alarm (P1, ~3-5 gün)
- [ ] 5.1 Windows köprüsü (DS-K2804) — KARAR: ürün olarak devam mı? Roster yolu 419ac2b'de kota yüzünden kaldırıldı, köprü kaynağı hâlâ eski yolu çağırıyor
- [ ] 5.2 Alarm: cihaz çevrimdışı → alarm bağı; e-posta hatası görünür + tekrar deneme; tek bildirim ayarı
- [ ] 5.3 Yeni müşteri kurulum kontrol listesi (yönetici → cihaz → kişi/kart → yetki → ilk geçiş); K1T804 model kataloğuna

### Paralel/bağımsız
- [ ] W3–W6 yayını (CEO, Emre "yayın onay") — Faz 1 açıkları ZATEN canlıda var; yayını bekletmek gerekmiyor

## Sonuç (sade)

Ekranlar ve özellikler büyük ölçüde var; sorun **akışların uçlarında**. Üç ana tema:

1. **Yetki açıkları:** birkaç yerde ekran butonu gizliyor ama sunucu engellemiyor; bazı yerlerde proje (müşteri) ayrımı kontrol edilmiyor. Bunlar müşteri verisi sızıntısı ve yetkisiz erişim riski.
2. **Erişimi geri alma:** yetki VERME iyi çalışıyor, GERİ ALMA (kart kaybı, kural silme, kişi silme, ziyaretçi bitişi) Hik cihazlarında eksik. Sonuç: kaybolan kart kapıyı açmaya devam edebilir.
3. **Puantaj ve çalışan döngüsü:** eski kurallı projede SGK/fazla mesai hesabı yanlış olabilir; çalışan talep açamıyor (mobil ekranı yok).

İnceleme kapsamı: ~150 akış adımı (A 48, B ~45, C ~60). Kabaca: ~46 tamam, ~74 yarım, ~23 kopuk. "Tamam" = kod bağlantısı var; cihazda denenmedi.

## Koordinatörün kodda doğruladığı bulgular (6/6 gerçek)

| # | Bulgu | Kanıt |
|---|---|---|
| A1 | Kart değişiminde eski kart yalnız IDE'den siliniyor; Hik'te kişi = kart no, eski kişi cihazda kalıyor | `convex/lib/employeeCardChange.ts:13-22`, `actions/hikvisionSync.ts:276` |
| A2 | project_user erişim kuralı ekleyip silebiliyor | `convex/accessRules.ts:674` `authedMutation`, rol kontrolü yok |
| B1 | Eski kurallı projede ay boyu saatten tek hafta (45 sa) düşülüyor → fazla mesai şişiyor | `convex/reports.ts:119` |
| B2 | Tatil listesi proje vermeden tüm tabloyu döndürüyor; yazmada proje kontrolü yok | `convex/holidays.ts:14-19`, `:60` |
| C1 | Kapı güncellemede rol yok + `deviceId` başka projeden olabilir | `convex/doors.ts:247`, `:252`, `:295` |
| C2 | Çalışan denetim geçmişi global son 500 kayıttan, başka projenin toplu kayıtları dahil | `convex/auditLog.ts:22-60` |

Not: project_user'ın web'den kapı açabilmesi (A raporu bulgu 2'nin ikinci yarısı) bilinçli karar (59282e5, "project_user yalnız kapı açar"); Faz 1'e alınmadı.

## Raporlar
- [A-kisi-erisim.md](A-kisi-erisim.md) — kişi ekleme → yetki → cihaz → geçiş → geri alma (48 adım, 10 cihaz teyidi)
- [B-pdks-rapor.md](B-pdks-rapor.md) — vardiya → puantaj → talep → rapor/SGK, Hik 19 rapor ↔ bizim 16
- [C-kurulum-cihaz-yonetim.md](C-kurulum-cihaz-yonetim.md) — yeni müşteri kurulumu, cihaz tipleri, alarm, kullanıcı yönetimi, KVKK
- Yöntem: 3 Codex (gpt-6-astra high) salt-okuma worker, Orca run `run_dcd866cf8b77`; spec `.claude/orca-specs/genel-akis-*.md`
