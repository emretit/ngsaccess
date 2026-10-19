# C2b W-07-ui — 07 Canlı İzleme sayfası A2 (frontend) + ACC-1B (07 kısmı)
Önce `.claude/orca-specs/c2b-common.md` (→ c2-common.md) oku. Hedef: `docs/ui-scan/pages/07-canli-izleme/REPORT.md` (tüm "Yeni tasarım":
bilgi mimarisi, tablo kolonları, canlı akış sözleşmesi, kaynak ayrımı, okuma ayrıntısı + bilinmeyen kart → kişiye ata, durum metinleri
ve 390px) + `mockup.html`. Backend sözleşmesi (TEK kaynak): `.claude/orca-specs/reports/c2b-07-api.md` — listLiveSince, listFiltered,
getReading, assignCardFromReading, satır `source` alanı. Ek: `docs/ux-audit/02_GECIS_IZLEME_ZIYARETCI.md` UX-1 §1B'nin 07 kısmı
(ret sebebi veya "neden bilinmiyor", sahte yenileme yok, URL durumu, filtre yazarken odak).

## Hedef (test edilebilir)
`/live-monitoring` A2 düzende: PageHeader (h1 + proje) → canlı kontrol (Canlı/Duraklat, yeni N olay, bağlantı durumu; watermark ile
kaçırma yok, `hasMore` → "yeniden yükle") → StatInline (yüklenen/gösterilen; günlük toplam YOK) → FilterBar (cihaz, kişi, kapı, sonuç;
sunucu filtresi kapsamı `filterScope`/`scannedCount` ile dürüst) → 42px tablo (yön nötr metin, yalnız sonuç semantik renk, kaynak
rozeti) + mobil liste → okuma ayrıntısı Sheet'i (URL `?reading=<id>` → `getReading`) → bilinmeyen kartta "Kişiye ata" onaylı form
(`expectedCurrentCard` yarış kontrolü; hata mesajları backend raporundan). 1440/390'da yatay taşma yok; vitest + build yeşil.

## İş
1. `src/pages/LiveMonitoring.tsx`, `src/components/access-control/CardReadings.tsx`, `CardReadingsFilters.tsx`, `CardReadingsTable.tsx`:
   A2'ye taşı; kart kabı kalkar; URL state (filtreler, reading).
2. Canlı akış: yeni `src/components/live-monitoring/LiveFeedControls.tsx` + `useLiveReadings` hook'u (snapshot + `listLiveSince`
   watermark tamponu, sınırlı tampon boyutu, duraklatınca yeni olay sayacı). `useCardReadings.ts` / `useProjectFilteredCardReadings.ts`
   başka tüketicisi varsa (grep) dışa açık imzası korunur; alias hook kalabilir.
3. Kaynak rozeti: `source` → Türkçe etiket (Kart, QR, Mobil, Biyometrik, Bilinmiyor). Biyometrik okumalar erişim kaydında GÖRÜNÜR
   (bu PDKS değil) ama "PDKS'ye girmez" ipucu ayrıntıda.
4. Ayrıntı (`ReadingDetailPanel.tsx` yeni): cihaz, kapı, kişi, kaynak, ret sebebi ya da "Neden bilinmiyor", zaman (TR).
5. Kişiye ata (`AssignReadingCardForm.tsx` yeni): yalnız admin yetkisinde görünür; kişi Combobox; kişinin mevcut kartı varsa açık
   "değiştirilecek" onayı; `assignCardFromReading` hata/yarış durumlarında form açık kalır, mesaj alan/form üstünde.
6. Saf mantık (tampon birleştirme, filtre→URL, kaynak etiketi) `src/components/live-monitoring/lib/*.ts` + vitest.

## Ownership
src/pages/LiveMonitoring.tsx · src/components/access-control/CardReadings.tsx · CardReadingsFilters.tsx · CardReadingsTable.tsx ·
yeni src/components/live-monitoring/** · src/hooks/useCardReadings.ts · src/hooks/useProjectFilteredCardReadings.ts (imza uyumlu)

## Kapsam dışı
convex/** (ask) · access-control/unified/** (05) · ağaç/okuyucu/kapı dialogları (03) · PDKS · ui|shared|layout · "İlgili kuralı aç".
