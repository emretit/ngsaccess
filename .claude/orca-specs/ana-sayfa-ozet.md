# Ana sayfa okuma düzeltmesi (item #343)

## Hedef
Ana sayfanın canlı sorguları her kart okumasında günün tüm verisini yeniden okumasın: `getActivitySummary`
(convex/dashboard.ts:726), `getTodayTimeline` (:132), `getStats` (:45), `getRecentReadings` (:678). Ölçüm raporu:
docs/convex-audit/YUK_500_2026-11-27.md §3/§5 (bu 4 sorgu DB I/O'nun ~%95'i). Hedef: 20 firma × 200 kişi senaryosunda
ana sayfa DB I/O'su ≥ %80 düşsün, ekranda görünen sayılar/zaman çizelgesi birebir aynı kalsın.

## Yaklaşım (önerilen; daha iyisini gerekçeyle seçebilirsin)
- Proje × gün (İstanbul günü) özet belgesi + saatlik sayaçlar (timeline için 24 kova). Kart okuması yazılırken AYNI
  transaction'da güncellenir (processCardReading / backfill / dedup yolları — hepsi; dedup'ta çift sayma yok).
- Yazma çakışmasını (OCC) azaltmak için gerekirse saatlik ya da shard'lı belge.
- İzin/vardiya/personel değişimine bağlı alanlar (activity summary'deki "gelmeyen", "izinli" vb.) için: ya ilgili
  mutation'larda özeti güncelle ya da bu kısmı ayrı, seyrek değişen küçük sorguya ayır.
- Özet belgesi yoksa (eski gün / yayın öncesi veri) mevcut yol çalışsın — backfill YOK, bugün yayından sonra dolmaya başlar;
  yayın günü için gün başından o ana kadarki kısmı tek seferlik doldurma gerekiyorsa bounded internal mutation yaz ama
  ÇALIŞTIRMA (ayrı onay).
- `getStats`: personel/aktif cihaz sayısı sayaç/özetten; sık değişen `lastSeen`/serial alanlarını stats'ın okuduğu
  belgeden ayır (updateLastSeen her okumada stats'ı yeniden çalıştırmasın — http.ts:112,194,259).
- `getRecentReadings`: yalnız gösterilen alanlar; cihaz bağlantı bilgisi ayrı sorgu.

## Ownership
convex/dashboard.ts, convex/schema.ts (yalnız yeni tablo/index; mevcut tablolara dokunma), convex/cardReadings.ts ve
processCardReading çekirdeği (convex/lib/processCardReadingCore.ts) yalnız özet güncelleme çağrısı için, convex/http.ts
(updateLastSeen), yeni convex/lib/dashboardSummary.ts, src/hooks/useDashboard.ts ve ana sayfa bileşenleri, testleri.
Başka worker çalışmıyor olmalı bu dosyalarda — koordinatör sırayla başlatıyor.

## Kapılar
- Eşitlik testi: aynı fixture'da eski sorgu sonucu == yeni sonuç (gece yarısı sınırı, dedup, geç gelen backfill, izinli,
  çoklu cihaz, silinen/pasif personel).
- Ölçüm: docs/convex-audit/YUK_500_2026-11-27.md yöntemiyle (/tmp/ngs-load ölçüm sarmalayıcısı) önce/sonra ana sayfa
  DB I/O'su — rapora yaz.
- İlgili test dosyaları + eslint değişenler. Tam vitest/tsc koordinatörde.
- `npx convex` YOK (canlıya push). commit/push/deploy/migration/canlı DB yazma YOK.

## Rapor
worker_done ≤10 satır: değişen file:line, önce/sonra DB I/O, eşitlik testleri, yayın sırasında gereken tek seferlik işlem (varsa).
