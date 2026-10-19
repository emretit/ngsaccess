# UI taraması (Faz B) — sentez, 2026-10-17

13 sayfa tarandı; her sayfada `pages/NN-slug/REPORT.md` (bulgular + yeni tasarım + backend + efor) ve `mockup.html` (A2 dilinde,
etkileşimli) var. Galeri: `pages/index.html`. Uygulama planı: `PLAN.md`. Tasarım dili: `DESIGN_DIRECTION.md`.

## 1. Sayfa tablosu
| # | Sayfa | Bulgu (yüksek) | Frontend | Backend (Faz C'de) | Dalga |
|---|---|---|---|---|---|
| 01 | Ana Sayfa + kabuk | 21 (4) | L 24–32 s | B5 `getStats` aralık/aggregate 8–16 s | C1 |
| 02 | Kişiler | 18 (11) | L 40–56 s | kişi bazlı senkron + son geçişler 12–20 s | C2a |
| 03 | Cihazlar | 18 (7) | L 18–26 s | — | C2a |
| 04 | Sanal Okuyucular | 16 (10) | S ~1 s (durum ekranı) | B1 kapsam dışı | C2a |
| 05 | Geçiş Kontrol | 18 (8) | L 24–32 s | gönderim run + sonuç geçmişi ~8–16 s | C2b |
| 06 | Ziyaretçiler | 20 (9) | L 24–36 s | asgari liste/ayrıntı + cursor (dahil) | C2b |
| 07 | Canlı İzleme | 17 (6) | L 32–44 s | kaynak sınıflama, watermark, güvenli kart atama (dahil) | C2b |
| 08 | PDKS Kayıtları | 21 (14) | L 36–48 s | proje kapsamı, gün durumu, biyometri ayrımı 16–32+ s | C2a |
| 09 | Vardiyalar | 20 (10) | L 32–44 s | toplu atama önizleme + bounded sorgu 8–16 s | C2b |
| 10 | İzinler | 17 (8) | M 20–28 s | `leaves.update`, tarih/çakışma doğrulama, cursor 12–20 s | C2c |
| 11 | Denetim Kaydı | 18 (4) | M 14–20 s | tarihsel aktör + Sistem filtresi 6–10 s | C2c |
| 12 | Admin | 22 (9) | L 28–38 s | sunucu arama/cursor 12–20 s | C2c |
| 13 | Ayarlar | 21 (9) | L 28–40 s | — (tema taşıma ürün kararına bağlı) | C2c |

**Toplam:** 247 bulgu · frontend ~320–445 insan-saati · Faz C backend ~80–150 insan-saati. Worker'larla duvar saati
tahmini: C1 4–6 sa · C2a/C2b/C2c 5–7 sa/dalga · C3 2–3 sa → **~20–30 sa ≈ 4–5 iş günü** (koordinatör + onay turları dahil).

## 2. Sayfalar arası tekrar eden sorunlar (örnek sayfalar raporların özetinden)
1. **Mobil kabuk** (01, 02, 05, 06, 09, 13): 390px'te kalıcı sidebar içeriği daraltıyor; işlemler kesiliyor → C1'deki mobil Sheet ortak çözüm.
2. **Kart/istatistik kalabalığı** (03, 05, 08): renkli ikon kutulu kartlar, kart içinde kart, bağlamsız stat kartları → StatInline + 42px tablo.
3. **Kapsam belirsizliği** (02, 08, 11, 13): başlıkta proje/dönem yok; sayfalanmış N kayıttan "toplam" türetiliyor; filtreyi temizlemek kapsamı da değiştiriyor.
4. **Eksik/yarım akış** (02 ayrıntı açılmıyor, 07 bilinmeyen kart, 08 manuel düzeltme, 09 toplu atama, 10 düzenleme yok, 12 pasife alma yok).
5. **Sorgu ölçeği** (02, 06, 08, 09, 10, 12): `.collect()` ile tam liste + istemci sayfalama; doğru sayaç için sunucu cursor + ayrı sayaç gerekli.
6. **Cihaz sonucu dürüstlüğü** (02, 05, 06): kuyruğa yazmak "cihazda uygulandı" gibi okunuyor; Hik "done" teslim kanıtı değil.

## 3. Ortak bileşenler (C1'de bir kez yapılır, 13 sayfa tüketir)
| Bileşen | Tüketen | Not |
|---|---|---|
| Kabuk: Sidebar 216px, üst çubuk 64px, mobil Sheet, ⌘K palet, proje seçici, hesap menüsü | 13 | `Layout.tsx`, `layout/**`, `routeMeta.ts`, `capabilities.ts` |
| PageHeader (h1 + kapsam satırı + tek birincil eylem) | 13 | |
| StatInline ("Toplam 10 · Aktif 8 · Pasif 2") | 13 | mevcut StatCard yalnız gerektiği yerde kalır |
| FilterBar (arama + 1-3 select + temizle; temizle kapsamı korur) | 13 | |
| DataTable yoğunluğu (42/36px, tabular-nums, "⋯" satır menüsü) | 13 | shadcn table üzerine sınıf + yardımcı |
| BulkBar (seçim çubuğu) | 13 | |
| StatusBadge / EmptyState / ErrorState / SectionSkeleton → A2 | 13 | mevcut API geriye uyumlu |
| Sheet (ayrıntı / form yan paneli) | 13 | shadcn sheet A2 stilinde |
| SaveBar + UnsavedChangesDialog bağlantısı | 13, 02, 06, 09, 10 | guard bugün hiçbir formda bağlı değil |
| DatePicker / tarih aralığı | 08, 10, 11 | `ui/date-picker.tsx` ortak dosya — C1 sahibi |

## 4. Dosya çakışma haritası (dalga ve sahiplik bunlara göre)
- `convex/cardReadings.ts` → 08 (C2a) sahibi; 07 C2b'de; 02 son geçişler için **yeni dosya**; 10 yalnız okur.
- `src/pages/Settings.tsx` + `components/settings/**` → 13 sahibi (C2c). 09 (C2b) yalnız vardiya tanım dosyalarını Vardiyalar'a taşır; 12 `AdminUsersPanel`'in sahibi, 13 tüketir.
- `components/access-control/**` → 03 (ağaç/okuyucu, C2a) · 05 (`unified/**`, C2b) · 07 (`CardReadings*`, C2b).
- `src/components/sync/DeviceSyncStatusBanner.tsx` → 05 sahibi; 03 tüketir.
- `convex/users.ts` → 12; 11 tarihsel aktörü `auditLog.ts` içinde çözer. `convex/settings.ts` → 13.
- `convex/schema.ts`, `convex/lib/customFunctions.ts`, `ui/date-picker.tsx` → koordinatör / C1.

## 5. Ürün soruları
Toplam 43 soru (04'ün 4 sorusu B1 kapsam dışı olduğu için ertelendi). Raporlardaki önerilen varsayılan uygulanır; aşağıdaki
4'ü kapsamı ve backend efor tahminini değiştirdiği için kullanıcıya soruldu (cevap PLAN.md'ye işlenir).

**Kullanıcıya soruldu — CEVAPLANDI 2026-10-17:** gerekçe zorunlu · onaylı kart atama var · toplu gönderim projedeki tüm cihazlara (Hik + IDE) · dışa aktarma yok
1. 08 — Manuel PDKS düzeltmesinde gerekçe zorunlu mu? (öneri: zorunlu)
2. 07 — Bilinmeyen kart Canlı İzleme'den kişiye atanabilsin mi? (öneri: evet, yetkili + onay + atomik kontrol)
3. 05 — Toplu "cihazlara gönder" IDE Smart'ı da kapsasın mı? (öneri: önce Hikvision etiketiyle dürüst, IDE ikinci adım)
4. 11 — Denetim kaydı dışa aktarma gerekli mi? (öneri: şimdilik yok)

**Varsayılanla ilerlenir (itiraz edilirse değişir)**
- 01: otomatik ilk proje seçimi korunur · üye dashboard'u mevcut yetkiyle · "Bugünkü kart okumaları" adı dürüst kalır
- 02: departman filtresi yalnız doğrudan bağlı kişiler · departman yazma yetkisi mevcut backend gibi · biyometri eylemi detayda kapalı · personel içe aktarma Faz C dışı
- 03: ayrıntı varsayılan "Genel bakış" · konum ağacı sheet (sabitlenebilir mod yok) · QR cihaz ekleme Cihazlar'da kalır
- 05: kalıcı gönderim sonuç geçmişi Faz C'de VAR (backend kararı gereği)
- 06: bölge değişimi = yeni ziyaret (yerinde değişim yok) · pasif ev sahibi seçilemez · `visitor_kvkk` metni hukuki karar → ayrı
- 07: canlı görünüm = bugün + sınırlı tampon · yeni kapı/kişi filtreleri backend'le birlikte
- 08: dönem durum filtresi "en az bir eşleşen günü olan çalışan" · bordro cetveli proje/ay kapsamı
- 09: vardiya tanımları Vardiyalar sayfasında (Sheet) · tek gün istisnası Faz C dışı · çakışanları atla + kalıcı kısmi sonuç · tanım değişikliği etki özeti (sürümleme yok)
- 10: eski pending/rejected kayıtlar salt okunur · örtüşen onaylı izin engellenir · yalnız tam gün
- 11: "Filtreleri temizle" kapsamı korur · tarihsel aktör + Sistem filtresi dahil
- 12: super_admin kullanıcıları Admin'den yönetir, proje yöneticisi Ayarlar'dan davet eder (tek bileşen) · pasif proje yalnız seçiciden kalkar · IDE kurulumu UX-2 sonrası görünür
- 13: tema kişisel tercih → Profil (geriye uyumlu) · iki bildirim alanı birleştirilmez · günlük rapor Ayarlar'da kalır · kurulum sihirbazı yok

## 6. Faz C'de dikkat
- C1 tek başına canlıya çıkıyor (kademeli karar) → eski 12 sayfa yeni token'la okunur olmalı; 13 sayfa × 1440/390 ekran kontrolü kapı.
- 08 en büyük ve hukuki riskli iş (biyometri PDKS dışı, KVKK 2026/921); 08 backend'i C2a'nın ilk worker'ı.
- 04 sabit örnekler üretimde yayında — C2a'da hemen kaldırılır.
- Worker spec'i = ilgili REPORT.md + mockup.html + ilgili `docs/ux-audit` 3b bulguları + bu dosyanın §4 sahiplik satırı.
