# Convex uzun vade denetimi (item #343) — SALT OKUMA

## Hedef
"Convex NGS Plus'ı büyüdükçe yorar mı?" sorusuna kanıtlı cevap: resmi limitler + koddaki limite/maliyete takılacak
noktalar + aylık kullanım tahmini + sıralı öneriler. Rapor: `docs/convex-audit/CONVEX_OLCEK_2026-11-27.md` (Türkçe, sade).

## Yasaklar
- `npx convex ...` komutlarının HİÇBİRİNİ çalıştırma (ana dizinde `convex dev`/`codegen` canlıya, notable-tern-4'e push eder).
- Kod değiştirme, commit/push/deploy/DB yazma YOK. Ana dizine yalnız rapor dosyasını yaz.
- Başka worker main'de çalışıyor; diğer dosyalara dokunma.

## 1. Resmi limitler (web, docs.convex.dev + convex.dev/pricing; tarih ve link ver)
- Planlar (Free/Starter, Professional, varsa diğerleri): fonksiyon çağrısı, action compute (GB-saat), DB depolama,
  dosya depolama, bant genişliği, deployment/üye sayısı; aşım ücretleri; aşımda ne oluyor (durdurma mı, fatura mı).
- Çalışma limitleri: transaction başına okunan/yazılan belge ve bayt, query/mutation süre sınırı, action süresi,
  belge boyutu, dizi uzunluğu, indeks/tablo sayısı, eşzamanlı istek, scheduler/cron sınırları, http action limitleri.
- Dev deployment vs prod deployment farkı (limit, yedek, ayrı env). Self-hosting (açık kaynak backend) durumu.

## 2. Kod taraması (`convex/`, `src/`)
- Sınırsız büyüyen tablolar (geçiş olayları, hikPendingOperations, audit log, bildirim vb.): saklama/temizlik var mı.
- `.collect()` / `filter` ile tablo taraması, indeksiz sorgu, limit/paginate olmayan liste sorguları — transaction okuma
  sınırına hangi veri hacminde takılır (dosya:satır + tahmini eşik).
- Reaktif abonelikler: büyük listeleri canlı izleyen sayfalar (her yazımda tüm aboneler yeniden çalışır → çağrı sayısı).
- Cihaz kaynaklı çağrılar: köprü poll (`/hik-bridge/poll|ack`), IDE gateway, cron'lar — sıklık × cihaz sayısı = aylık çağrı.
- Dosya depolama (foto, yüz, ek) ve bant genişliği.
- Canlının `dev:notable-tern-4` (dev deployment) olması: riskleri (yanlışlıkla push, yedek, limit) ve prod'a geçiş adımları.

## 3. Tahmin
Senaryo tablosu: 1 müşteri / 10 müşteri / 50 müşteri (ör. müşteri başı 200 kişi, 4 cihaz, günde 2 geçiş/kişi —
varsayımı açıkça yaz, koddan daha iyi sayı çıkarsa onu kullan) → aylık fonksiyon çağrısı, DB boyutu, bant, tahmini aylık $.
Kullanım panosu verisine erişimin yok; Emre'den hangi panodaki hangi sayıyı istemem gerektiğini yaz.

## 4. Rapor biçimi
1-2 cümle sonuç · limitler tablosu (kaynak linkli) · risk listesi (Engel/Düzeltilmeli/Not, dosya:satır) · senaryo tablosu ·
çıkış seçenekleri (self-host, Postgres/Supabase vb.) kısa artı/eksi · ≤5 sıralı öneri, her biri tahmini iş süresiyle.
`worker_done`: ≤10 satır.
