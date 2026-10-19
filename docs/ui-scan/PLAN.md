# Yeni arayüz (A2) — uygulama planı (2026-10-17)

Kaynaklar: tasarım dili `DESIGN_DIRECTION.md` · sayfa raporları/mockup'lar `pages/NN-slug/{REPORT.md,mockup.html}` ·
eski UX audit `docs/ux-audit/`. Koordinatör = Claude oturumu, uygulama = Orca Codex worker'ları (~/.claude/rules/agents.md).

## Kararlar (kullanıcı, 2026-10-17)
1. **Canlıya çıkış kademeli:** main'de çalışılır; C0, C1 ve her sayfa bitince commit → (backend varsa) Convex deploy → push.
   Her push tek satır onayla. Sonuç: C1 sonrası eski sayfalar yeni token/kabukla birkaç gün canlıda görünür → C1 kapısı sıkı.
2. **Dalga 3b Faz C'ye katıldı:** DEV-1B, ACC-1B+1C, PPL-1A+1B, ADM-1D, ADM-1A+1B bulguları ilgili sayfa spec'ine eklenir.
3. **Backend işleri sayfayla birlikte:** her sayfa = (gerekirse) backend worker → frontend worker. `schema.ts` koordinatörde;
   şema değişikliği widen-migrate-narrow. Yeni npm paketi (ör. `@convex-dev/aggregate`) ayrıca onay ister.
4. **Sanal Okuyucular:** sabit 6 örnek kalkar → "Henüz kullanıma açılmadı" ekranı. QR/okuyucu modeli (B1) Faz C dışı.
5. **Ürün soruları (2026-10-17):** 08 manuel düzeltmede gerekçe ZORUNLU · 07 bilinmeyen kart Canlı İzleme'den onaylı atanır
   (dar mutation + yarış kontrolü) · 05 toplu gönderim projede kayıtlı HER cihaza (Hikvision + IDE Smart; atlanan/başarısız ayrımı;
   C2b +8-12 s) · 11 dışa aktarma şimdilik YOK. Kalan 39 soru `00_OZET.md` §5 varsayılanıyla.

## Checklist

### Faz B — Tarama (kod değişmez)
- [x] 01 ana-sayfa+kabuk · 02 kişiler · 03 cihazlar · 04 sanal-okuyucular · 05 geçiş-kontrol · 08 pdks-kayıtları
- [x] 06 ziyaretçiler · 07 canlı-izleme · 09 vardiyalar · 10 izinler · 11 denetim-kaydı
- [x] 12 admin · 13 ayarlar
- [x] Sentez `00_OZET.md` (247 bulgu, ortak bileşenler, efor, dosya çakışma haritası) + galeri `pages/index.html`
- [x] **Ürün soruları:** 4'ü cevaplandı (Kararlar §5), 39'u varsayılanla

### Faz C0 — Temiz zemin — BİTTİ 2026-10-17
- [x] Dalga 3a'yı bitir: `src/pages/AccessControl.tsx` legacy `useAccessRulesQuery` + tam ekran spinner guard'ı kaldır
- [x] Kapılar: app+convex tsc 0, eslint 0, vitest 72/656
- [x] Dalga 3a denetimi (2× Claude sonnet) → düzeltildi: denetim maskeleme, aramadan serbest not çıktı, sayfa sınırı key=yol+proje
- [x] 5 commit `2d00c8a..424556c` → Convex deploy 16:47 TR (8 index) → push (Netlify)

### Faz C1 — Temel — BİTTİ 2026-10-17 (commit 7ea0b6e + 84b9663, deploy 17:57 TR, push)
- [x] W-shell (astra high): token'lar `src/index.css` `@theme` + shadcn değişken eşlemesi, Poppins/Google Fonts kalkar,
      bordo sidebar 216px (13 öğe, 3 grup), üst çubuk 64px (proje seçici, ⌘K palet, hesap menüsü), mobil Sheet, skip link,
      ortak bileşenler (PageHeader, StatInline, FilterBar, BulkBar, DataTable yoğunluğu, Sheet, SaveBar, DatePicker, StatusBadge/EmptyState/SectionSkeleton) + 01 Ana Sayfa
- [x] W-dash-api (paralel, sol medium): `convex/dashboard.ts` `getStats` → `by_project_access_time` aralığı, `.collect()` sınırları (B5 ilk adım)
- [x] Kapı: 13 sayfa × 1440/390 ekran görüntüsü — eski sayfalar yeni token'la okunur, kırık yok (canlıya bu haliyle çıkıyor)
- [x] Denetim (Claude) → commit → deploy → push

### Faz C2 — Sayfalar (dalga başına max 4 paralel; backend dosyası çakışanlar ayrı dalgada)
Her sayfa: backend worker (astra high) → frontend worker (sol medium; mockup+rapor = spec) → koordinatör kapı + mockup'la
ekran kıyası → Claude denetim → commit → deploy → push.
- [x] **C2a** (~5-7 sa) — CANLI 2026-10-17: commit d78cbe9..f9ffebd + cd0d85f codegen, Convex deploy 19:08, push
  - [x] 02 Kişiler + B2 (kişi bazlı senkron geçmişi, bounded son geçişler — yeni dosyada, `cardReadings.ts`'e dokunmadan) + PPL-1A/1B
  - [x] 03 Cihazlar (backend yok) + DEV-1B
  - [x] 08 PDKS Kayıtları + B3 (`getPdksTableData` projectId kapsamı, gün durumu sözleşmesi, PDKS kaynak ayrımı = KVKK Faz 1 çekirdeği)
  - [x] 04 Sanal Okuyucular → "Henüz kullanıma açılmadı" (S, ~30 dk)
- [x] **C2b** (~5-7 sa) — CANLI 2026-10-17 20:42 TR: commit 5ab756c..e301c4c + 42c21c5 codegen + 9fb93be fix (Canlı İzleme ayrıntı paneli anında kapanıyordu — ekran kontrolünde bulundu), temiz HEAD kapısı tsc 0/0 · vitest 94/946, Convex deploy (10 yeni index), push cd0d85f..9fb93be
  - [x] 07 Canlı İzleme + kaynak sınıflama/watermark/güvenli kart atama (`cardReadings.ts` 08'den sonra)
  - [x] 05 Geçiş Kontrol + B4 (gönderim run kimliği + sonuç geçmişi, Hikvision + IDE Smart) + ACC-1B/1C; `DeviceSyncStatusBanner` sahibi
  - [x] 06 Ziyaretçiler + asgari liste/ayrıntı + cursor
  - [x] 09 Vardiyalar + ADM-1D + toplu atama önizleme; vardiya tanım dosyalarını Ayarlar'dan Vardiyalar'a taşır
- [x] **C2c** — CANLI 2026-10-18 14:45 TR: commit 95c05b0..1c720b4 + 8c097da codegen + dca4da4 fix (tarayıcı geri tuşu kirli taslak korumasını atlıyordu — ekran kontrolünde bulundu), Convex deploy 14:27 TR (3 leaves index), push dbcb81f..dca4da4. Kapı: tsc 0/0 · eslint 0 · vitest 102/1054 · build OK; 4 sayfa 1440+390 taşma/konsol hatası yok
  - [x] 10 İzinler + `leaves.update`, tarih/çakışma doğrulama, cursor (PDKS etkisi 08'e bağlı)
  - [x] 11 Denetim Kaydı + tarihsel aktör/Sistem filtresi
  - [x] 12 Admin + ADM-1A/1B + sunucu arama/cursor; `AdminUsersPanel` + `convex/users.ts` sahibi
  - [x] 13 Ayarlar; `Settings.tsx` + `components/settings/**` + `convex/settings.ts` sahibi

### Faz C3 — Süpürme + kapanış — CANLI 2026-10-18 23:55 TR (run_4f7e7f7d7b0c): commit bd223be..84ec354 (6) + cb22245 codegen, Convex deploy 23:52 TR (şema değişmedi), push dca4da4..cb22245. Kapı (temiz HEAD): tsc 0/0 · vitest 107/1121; 13 sayfa × 1440+390 = 26 ekran taşma/konsol hatası yok, yerel tarih alanı 0; denetim tarih seçici + kural düzenleyici (6 kişi özeti) çalışıyor. A2 Faz C 13/13 sayfa bitti.
- [x] Kalan useToast→notify, sabit renkler, emoji, ölü CSS (`App.css`; `styles/colors.css` zaten yoktu)
- [ ] B5 kalan: sayaç/aggregate ölçekleme (01/02/08) — kullanıcı ertelemek istemedi; öneri @convex-dev/aggregate (getStats: bugünkü okuma + personel + cihaz) — paket onayı bekliyor
- [x] 05 `accessRules.getDetails` üye/cihaz `.collect()` sınırı (diff kayıt + izlenen gönderim run'ı) — C2b'de BİLEREK ertelendi (eski frontend kırpılmış listeyi kaydedip üye silebilir); eski sekmeler kalktıktan sonra sınırla + updateWithGroups'ta tam liste kontrolü
- [ ] Sonraki (C3 denetiminden, ölçek): kural diff gönderimi kişi başına sıralı — tek kayıtta ~500 kişi 10 dk sınırına takılabilir (batch/schedule); 500+ üyeli kuralda kapsam (cihaz/kapı) değişimi reddediliyor → büyük kurallarda tam startRuleSync'e düş. Düşük: ilgisiz cihaza gereksiz action, IDE-only kuralda her üye eklemede syncRule.
- [x] C2c'den ertelenen: `users.updateRole` üyelik listesini kör ezer (sürüm/diff yok) · Genel ayarlar değişmeyen alanları da yazar (kısmi patch) · `useAuditUrlState` modül düzeyi scope · İzin formunda 'Kişi / Kişi ara' çift etiket · eski SlideOverPanel/DeviceDetailsPanel 'projeyi geri al' kalıbını `useProjectChangeGuard`'a taşı
- [x] 13 sayfa × 1440/390 son tur → push (mockup'la yan yana karşılaştırma yapılmadı; yalnız taşma/konsol/işlev)

### Faz C dışı
- B1 Sanal okuyucu modeli + QR sözleşmesi + mobil entegrasyon (04) — ürün kararı sonra
- Personel içe aktarma (02, +20-32 s) — ürün sorusunda varsayılan "ayrı özellik"
- Windows Hik köprüsü 1.1.0 kurulumu (ayrı iş, handoff'ta)

## Efor (rapor tahminleri, insan-saati)
| Sayfa | Frontend | Backend |
|---|---|---|
| 01 Ana Sayfa + kabuk | L 24–32 s | B5 8–16 s |
| 02 Kişiler | L 40–56 s | B2 12–20 s |
| 03 Cihazlar | L 18–26 s | — |
| 04 Sanal Okuyucular | S ~1 s (durum ekranı) | B1 kapsam dışı |
| 05 Geçiş Kontrol | L 24–32 s | B4 (boyutlanacak) |
| 08 PDKS Kayıtları | L 36–48 s | B3 16–32+ s |
| 06 Ziyaretçiler | L 24–36 s (backend dahil) | — |
| 07 Canlı İzleme | L 32–44 s (backend dahil) | — |
| 09 Vardiyalar | L 32–44 s | 8–16 s |
| 10 İzinler | M 20–28 s | 12–20 s |
| 11 Denetim Kaydı | M 14–20 s | 6–10 s |
| 12 Admin | L 28–38 s | 12–20 s |
| 13 Ayarlar | L 28–40 s | — |
| **Toplam** | **~320–445 s** | **~80–150 s** |

Duvar saati (worker'larla paralel, onay turları dahil): C1 4-6 · C2a/C2b/C2c 5-7 her biri · C3 2-3 → **~20-30 sa ≈ 4-5 iş günü**.

## Riskler
- Kademeli çıkış: C1 sonrası yeni kabuk + eski sayfalar canlıda karışık görünür → C1 kapısında 13 sayfa ekran kontrolü şart.
- Dalga 3a commit'siz değişiklikler üzerine refactor = veri doğruluğu düzeltmelerini geri alma riski → C0 şart.
- `convex/cardReadings.ts` 01/02/07/08 tarafından paylaşılıyor → 08 C2a'da, 07 C2b'de; 02 yeni dosya kullanır.
- `components/access-control/**` 03/05/07 tarafından paylaşılıyor → spec'lerde dosya sahipliği ayrık.
- B3 (PDKS kaynak ayrımı) KVKK hukuki riskli ve büyük → 08 en uzun iş; gerekirse 08 backend'i C2a'dan önce başlar.
- Codex haftalık kota %33 (2026-10-17); ~25 worker. Her dalga başında `agent-quota.py`; ≥%90 → Claude worker.

## C1'den C2'ye notlar
- Eski sayfalar yeni kabukta: tablo yazısı 12px, radius 6px, --accent açık gri (denetim: kırılma yok). 06/07 mobilde tablo yatay taşıyor,
  13'te bayrak emojisi var → ilgili sayfa worker'ı.
- Ortak bileşen API'si: `docs/ux-audit/DESIGN_SYSTEM.md` "A2 bileşenleri" bölümü; worker spec'leri buna yönlendirir.
- Ekran kapısı yöntemi: handoff "C1" maddesi (Orca tab → token 0600 → /tmp/uxaudit/c1-shot.cjs → token sil → sheet.cjs).

## C0'dan ertelenenler (ilgili faza)
- C1: koyu tema `--sidebar-primary` + beyaz ön plan 3.18:1 (token'lar zaten değişecek); contrast testi sidebar/muted/badge çiftlerini de ölçsün.
- C2 formlar: `useUnsavedChangesGuard` henüz hiçbir formda bağlı değil.
- C2b 05: `accessRules.getDetails` üyeleri sınırsız `.collect()` — düzenleme tüm üyeleri istediği için `take()` güvensiz; cursor API ile çöz.
- C2c 11: arama + tarih aralığı sonradan süzülüyor (UI dürüst metin gösteriyor); eski kayıtlarda searchText yok (backfill kararı).
- Düşük: DeviceListErrorBoundary retry tam sayfa reload; MoveReaderDialog kapasiteyi istemcide denetlemiyor; `useAccessRules.ts` legacy sorguyu yalnız mutation için çağırıyor (GroupMembers/GroupDevicesManager).
