# Cihazlar sayfası — son audit planı (2026-10-27)

## DURUM (2026-10-27 15:38) — BİTTİ
- CANLI: d2530e68 (Convex dev --once 15:37:47 + Netlify deploy 6ae09b259917edc78db82d5a 15:38, bundle index-CS8YjY6p.js; export /tmp/ngs-pub-d2530e68). 78557c85 + cead1059 de bu yayınla çıktı. Kapılar export'ta: tsc 0/0, node-leak temiz, vitest 444/444 · 5078/5078.
- C3 yapıldı 15:34: NGS0001 okuyucu rd7b36h1… "Kapı 1"→"Giriş", NGS0002 okuyucu rd7d5dj1… "Kapı 1"→"Çıkış" (readers.update, yalnız ad).

## Eski durum (15:15)
- Orca run `run_e748bcb00ca5`, 3 Codex worker (gpt-6.1-sol medium) bitti ve kapatıldı (reclaimable 0).
- Koordinatör doğrulaması: tsc app 0 hata, convex tsc 0, eslint temiz, TAM vitest 449/449 dosya · 5113/5113 test; Orca turu: başlıkta "Zorunlu alanlar" yok, Bağlantı kartında yalnız "Gateway", Tip filtresi "Tümü (2) | Parmak İzi Okuyucu (1) | Erişim Terminali (1)", 2 cihazda sayfalama gizli.
- COMMIT'Lİ (2026-10-27): 3479ceb8 (A+B web) + d2530e68 (C convex). Push/yayın YOK. Dosyalar:
  src/components/devices/DeviceAddMenu.tsx src/components/devices/DeviceAudit.test.tsx src/components/devices/DeviceConnectionSection.tsx src/components/devices/DeviceDetailsPanel.tsx src/components/devices/DeviceFilters.tsx src/components/devices/DevicesContent.tsx src/components/shared/PaginationBar.tsx src/components/shared/PaginationBar.test.tsx convex/doors.ts convex/doorRenameReaders.test.ts
- Sıradaki (Emre onayıyla): 1) ~~commit~~ BİTTİ 2) C4 Convex + web yayını (`npx convex dev --once` + Netlify `deploy --prod --no-build`, git archive export; bkz. memory web_deploy_manual) 3) C3: canlıda NGS0001/NGS0002 kapılarının "Kapı 1" okuyucularını ağaç menüsünden yeniden adlandır (yeni kod yalnız SONRAKİ kapı adı değişikliklerinde çalışır; mevcut 2 okuyucu otomatik düzelmez).
- Not: `doors.update` artık `name`'i trim'liyor (worker ekledi, zararsız).

## Checklist

### Faz A — Web, küçük düzeltmeler (~20 dk, yalnız web yayını)
- [x] A1 (bulgu 2) Yeni/Düzenle başlığındaki "Zorunlu alanlar * ile işaretlidir." kaldır — `DeviceDetailsPanel.tsx:148`
- [x] A2 (bulgu 7) İşlemler › Bağlantı kartından tekrar eden durum + marka rozetini kaldır, "Gateway" kalsın — `DeviceConnectionSection.tsx:26,35-49`
- [x] A3 (bulgu 8) "Havuzdan ata" açıklaması: "Sistemde kayıtlı cihazı bu projeye bağla" — `DeviceAddMenu.tsx:45`
- [x] A4 (bulgu 6) Tip filtresine de sayı ekle: "Tümü (2)", "Kart Okuyucu (1)" — `DeviceFilters.tsx:42`, sayım `DevicesContent.tsx:88`
- [x] A5 Kapılar: tsc + eslint + `vitest run src/components/devices` + Orca turu

### Faz B — Ortak sayfalama (~20 dk, 9 liste birlikte değişir)
- [x] B1 (bulgu 5) Tek sayfa varken Önceki/Sonraki gizle; toplam ≤ en küçük sayfa boyutuysa "25 / sayfa" seçicisini de gizle, özet kalır — `src/components/shared/PaginationBar.tsx`
- [x] B2 Kapılar: tam `vitest run` (9 liste) + Orca'da Cihazlar ve bir uzun liste

### Faz C — Okuyucu adı kapıyla birlikte (~40 dk, Convex yayını gerekir)
- [x] C1 (bulgu 1) `doors.update` ad değişince, adı eski kapı adıyla başlayan okuyucuları ("Kapı 1", "Kapı 1 Giriş/Çıkış") yeni adla güncelle; elle adlandırılmış okuyucuya dokunma — `convex/doors.ts:254+`
- [x] C2 Convex testi: yeniden adlandırma, elle ad korunur, Giriş/Çıkış soneki korunur
- [x] C3 Mevcut veri: NGS0001 ve NGS0002'nin "Kapı 1" okuyucularını yeniden adlandır (ağaçtaki okuyucu menüsü → Düzenle; canlı veri, Emre onayı)
- [x] C4 Convex + web yayını (Emre onayı)

### Yapılmayacak (gerekçeli)
- Bulgu 4 — "Cihaz seçerek toplu işlem…" satırı bilinçli: sabit yükseklikli yuva, seçim yapılınca toplu işlem çubuğu aynı yere geliyor, tablo zıplamıyor (`DeviceList.tsx:103`). Kaldırmak zıplama getirir.
- Bulgu 3 — mobilde arama/filtre 36 px: WCAG 2.2 AA'yı (24 px) geçiyor; kaynak ortak `FilterBar` (13 sayfa). İstenirse ayrı "tüm sayfalar" işi.

## Audit sonucu (bulgu → doğrulama)
1. Okuyucu adı — DOĞRULANDI. Okuyucular 4 yerde kapı adıyla açılıyor (`convex/lib/deviceHelpers.ts:216,283`, `convex/doors.ts:239`, `convex/readers.ts:102`); `doors.update` ad değişince okuyuculara dokunmuyor. Hik terminalde (1 kapı, 1 okuyucu) kapı "Giriş" olunca okuyucu "Kapı 1" kalıyor.
2. "Zorunlu alanlar *" — DOĞRULANDI. Formlarda yıldız mekanizması yok. Aynı cümle Kişiler panelinde de var (`SlideOverPanel.tsx:76`, kapsam dışı).
3. Mobil 36 px — KISMEN. AA'yı geçiyor; sorun yalnız formlarla (44 px) tutarsızlık; ortak bileşen.
4. Toplu işlem satırı — BİLİNÇLİ TASARIM (bkz. yukarı).
5. Tek sayfada sayfalama — DOĞRULANDI. Ortak `PaginationBar`, 9 listede aynı.
6. Filtre sayıları — DOĞRULANDI. Sayımlar istemcide hesaplanıyor; Tip'e eklemek ucuz.
7. Çift "Çevrimiçi" — DOĞRULANDI. Başlık 15 sn'lik saatle, kart `deviceCenter.getOverview` ile hesaplıyor; kısa süre farklı durum gösterebilir. Marka da iki yerde.
8. Menü açıklaması — DOĞRULANDI. `DeviceAddMenu.tsx:45` başlığı tekrarlıyor.

Dosya sahipliği: listedeki dosyaların hiçbirinde commit'lenmemiş başka oturum değişikliği yok (2026-10-27 kontrol).
