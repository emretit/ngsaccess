# Kalıcı taşıma (K-02 kişi, C-02 IDE panel) — sentez (2026-10-26)
Kaynak: TASIMA tasarımları `tasima-tasarim-claude.md` (Claude opus) + `tasima-tasarim-codex.md` (Codex astra), birbirini görmeden.

## İkisinin AYNI dediği (karar gerekmez)
- Durum makinesi: `requested → revoking → revoked → provisioning → done` + `stuck` / `cancelled`. Kalıcı `accessTransfers` + hedef başına `accessTransferTargets` tablosu.
- Eski cihazların HEPSİ silmeyi onaylamadan (IDE ACK success/not_found, Hik gerçek silme sonucu) yeni projede erişim açılmaz.
- Hik `protectCurrentCredential` "superseded" ve kuyruk "dismissed" silme kanıtı DEĞİL → hedef `stuck`.
- Cihaz kaldırma cascade'i kuyruk işlerini siliyor (`lib/deviceHelpers.ts:55-70`) → taşıma kaydı bundan bağımsız tutulmalı.
- Taşıma sürerken kart değişimi / kişi silme / yeniden taşıma kilitli. Başlangıçta çevrimdışı hedef varsa taşıma başlamaz (MVP).
- Genel `employees.update` proje değişimi engeli kalıcı; taşıma ayrı API/sihirbaz.

## Ayrıştıkları yer → Emre kararı
1. Kişi modeli: Claude = B'de yeni kayıt, A kaydı "taşındı" kapanır (geçmiş A'da, rapor/bordro bugünkü haliyle doğru kalır). Codex = aynı kayıt + `employeeProjectPeriods` dönem tarihçesi (rapor/PDKS/bordro okuyucuları yeniden yazılır, 8-15+ gün ek); MVP'si "geçmişsiz kişiler" = pratikte hiç kimse. → Koordinatör önerisi: Claude modeli.
2. Zorla tamamla: Claude = Faz 2'de gerekçeli+audit'li; Codex = hiç (yazılım onayı eski kapıyı kapatmaz). → Öneri: MVP'de yok; kalıcı bozuk cihaz için "cihazı projeden kaldır = hedef kapandı (audit'li)" çıkışı.
3. IDE tam temizlik: Claude = MVP'de DB roster'ına göre tek tek sil, Faz 2'de get_data ile boş kanıt. Codex = DB roster kanıt değil (ACK'i kaybolan/LAN'dan yazılan kartlar kaçar); `delete_all_data user/permission/scenario` doğrulanmış firmware'de + boş readback. → Öneri: Codex haklı; ama yedek panelde canlı test şart.

## Önerilen sıra
1. K-02 MVP (ortak altyapı + kişi taşıma, tüm hedefler çevrimiçiyken; IDE tek tek deleteUser zaten canlıda kullanılıyor) — L, ~2 worker dalgası + denetim.
2. C-02 MVP (panel devri) — yedek panelde `delete_all_data` + `get_data` kabul testinden SONRA; köprüye clearUsers/readUsers op'ları.
3. Faz 2: çevrimdışı bekleyip devam, legacy kimlik, eski permission/senaryo temizliği.
