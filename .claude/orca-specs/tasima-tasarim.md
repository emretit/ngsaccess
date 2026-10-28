# TASARIM (SALT OKUMA) — Kalıcı taşıma akışı: kişi proje değişimi (K-02) + IDE panel proje değişimi (C-02)

Çalışma dizini `/Users/emreaydin/ngsaccess` (main). Bu bir TASARIM görevi: HİÇBİR dosyayı düzenleme (rapor dosyası hariç), git komutu (status/log/diff/show dışında) yok,
`npx convex`/deploy/DB/cihaz/ağ isteği yok. Başka worker'lar aynı ağaçta kod yazıyor; onların dosyalarına dokunma.
Bu soruyu başka bir ajan da AYRI çözüyor; bağımsız düşün, kendi gerekçeni yaz.

## Bağlam
- Bulgular: `docs/sistem-audit-2026-10-25/DOGRULAMA.md` + `M1-kisi-erisim.md` (K-02), `M2-cihaz.md` (C-02), `OZET.md` 0.3 ve 2.4.
- Bugünkü GEÇİCİ engel (Faz 0.3, 428382a4): kişi proje değişimi `EMPLOYEE_PROJECT_MOVE_UNSUPPORTED` (`convex/employees.ts:~302`);
  IDE paneli roster'ı varken başka projeye `IDE_DEVICE_MOVE_UNSUPPORTED` (`convex/lib/deviceProvision.ts:62` `assertIdeRosterMovable`, çağıranlar `:133`, `:212`, `lib/deviceAssignment.ts:29`).
  Hik cihaz taşıma: 7e131a49 + `lib/deviceAssignment.ts:113` (engel + online olunca temizlik) — İNCELE, model olarak kullanılabilir.
- Hedef akış (OZET 2.4): "önce eski cihazdan sil → ACK → yeni projede aç". Kuyruklar: Hik `hikvisionSync.ts` (silme işi, `protectCurrentCredential`), IDE `ideSync.ts` (`enqueueIdeOp`, `markAck`, `idePanelUsers` roster).
- Gerçekler: IDE'de kart = kullanıcı kimliği (user.id = kart no); panel çevrimdışı olabilir (saatler/günler); ACK kaybı olur; kişi birden çok cihazda olabilir; kart numarası taşıma sırasında değişebilir; super_admin paneli başka müşteriye verir.

## Cevaplanacak sorular (rapor bu başlıklarla)
1. **Durum makinesi**: taşıma süreci hangi durumlardan geçer (ör. `requested → revoking → revoked → provisioning → done`, `failed/stuck`)? Nerede tutulur (yeni tablo mu, mevcut alan mı)? Şema değişikliği önerisini alan/index düzeyinde yaz.
2. **Kişi taşıma (K-02)**: eski projenin Hik + IDE cihazlarından silme kanıtı (ACK) gelmeden yeni projede erişim açılır mı? Panel çevrimdışıysa ne olur — taşıma bekler mi, zaman aşımında yönetici ne görür, "zorla taşı" olmalı mı (risk: eski kapı açılmaya devam)?
   PDKS/geçmiş kayıtlar, kural üyelikleri, mobil oturum, ziyaret ev sahipliği ne olur?
3. **IDE panel taşıma (C-02)**: panel yeni müşteriye geçerken eski roster nasıl silinir (tam temizlik komutu var mı — `docs/ide-smart/*` OKU — yoksa tek tek deleteUser)? Panel çevrimdışıyken taşıma nasıl görünür? `assertIdeRosterMovable` engeli hangi koşulda kalkar?
4. **Yarışlar**: taşıma sürerken kart değişimi, kişi silme, yeniden taşıma, aynı kartın eski projede başka kişiye verilmesi, gecikmiş ACK.
5. **Asgari uygulanabilir sürüm (MVP)**: en küçük güvenli adım nedir (ör. yalnız "çevrimiçi cihazda sil-ACK-aç", çevrimdışıda engel sürsün)? Sonraki adımlar?
6. **İş tahmini + dosya listesi**: MVP için dokunulacak dosyalar, test listesi, S/M/L.
7. **Emre'ye sorulacak karar soruları** (en fazla 3, her biri seçenekli + önerin).

## Çıktı
Rapor: `{{RAPOR}}` (Türkçe, ≤ 150 satır, file:line kanıtlı). `worker_done` ≤ 10 satır, `--report-path` ile, `--outcome succeeded`.
