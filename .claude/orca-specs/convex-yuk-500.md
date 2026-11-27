# Convex yük ölçümü — 500 kişi / 10 cihaz (item #343)

## Hedef
"Bu müşteriyle Convex'te İLK hangi sınıra, kaçıncı günde takılırız?" sorusuna ÖLÇÜLMÜŞ cevap. Free ve Pro planın
aylık kotaları (docs/convex-audit/CONVEX_OLCEK_2026-11-27.md §1: fonksiyon çağrısı, action compute, DB depolama,
DB I/O, dosya depolama, egress) için 30 günlük tüketim tablosu + ilk takılan sınır + en çok tüketen 5 fonksiyon.

## Yasaklar
- Canlı (notable-tern-4) YASAK: ana dizinde `npx convex` çalıştırma, canlıya hiçbir istek yok.
- Ana dizinde (`/Users/emreaydin/ngsaccess`) yalnız rapor dosyasını yaz; başka dosyaya dokunma (başka worker'lar çalışıyor).
- `/tmp/ngs-smoke`'a dokunma (başka worker'ın). Kendi kopyan: `/tmp/ngs-load`, kendi portların.
- commit/push/deploy YOK.

## Kurulum
`rm -rf /tmp/ngs-load && mkdir /tmp/ngs-load && rsync -a --exclude node_modules --exclude .git --exclude dist /Users/emreaydin/ngsaccess/ /tmp/ngs-load/`
→ `.env.local`'den CONVEX_DEPLOYMENT/VITE_CONVEX_URL sil → `npm ci`. Ölçüm için iki yol (biri yeterli, gerekçeni yaz):
1. **Yerel backend** (`cd /tmp/ngs-load && npx convex dev --local`, port çakışırsa farklı port): `.env.local`'de `notable-tern`
   GEÇMEMELİ (geçerse DUR). Fonksiyon başı okunan/yazılan bayt ve belge sayısını loglardan (`npx convex logs` / jsonl) al.
2. **convex-test ölçüm sarmalayıcısı**: `ctx.db` okuma/yazmalarını sayan proxy (getConvexSize ile bayt), gerçek fonksiyonları çağır.

## Senaryo (varsayımları rapora yaz)
- 1 proje, 500 çalışan, 10 cihaz (Hik + gerekiyorsa IDE karışımı — koddaki gerçek yollar), erişim kuralları.
- Günde kişi başı 4 geçiş, 22 iş günü → ~44.000 okuma/ay. Okuma yolu: gerçek HTTP action → processCardReading zinciri
  (http.ts:112,194,259 — token sorgusu, updateLastSeen dahil).
- Açık ekranlar: ana sayfa 5 kullanıcıda gün boyu açık (reaktif yeniden çalışma: her okuma = abone sorguların tekrar
  çalışması; useDashboard.ts:14-35), cihaz listesi 1 ekranda açık. Gün sonu 1 PDKS aylık tablo + 1 bordro, ay sonu dışa aktarma.
- Cihaz köprüsü/poll ve cron'lar: koddaki gerçek aralıklarla aylık çağrı sayısı.
- Depolama: 30 gün sonunda cardReadings (20 index dahil) + diğer tablolar; foto/yüz dosyaları (500 kişi × ortalama boyut).

## Çıktı: `docs/convex-audit/YUK_500_2026-11-27.md` (Türkçe, sade)
1. 1-2 cümle sonuç: Free'de ilk takılan sınır + gün; Pro'da aylık tahmini fatura.
2. Tablo: kota | Free sınırı | Pro sınırı | ölçülen günlük | 30 gün | Free'de dolduğu gün.
3. En çok tüketen 5 fonksiyon (çağrı, DB I/O bayt) dosya:satır.
4. Her biri için düzeltme önerisi + tahmini kazanç (ör. ana sayfa reaktifliği → DB I/O %X azalır).
5. Ölçümün kısıtları (yerel vs bulut farkı, index depolama tahmini).
`worker_done` ≤10 satır.
