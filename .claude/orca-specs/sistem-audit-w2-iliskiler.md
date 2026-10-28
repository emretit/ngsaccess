# SİSTEM AUDIT — DALGA 2B: MODÜLLER ARASI İLİŞKİLER VE BOŞLUKLAR

ÖNCE `/Users/emreaydin/ngsaccess/.claude/orca-specs/sistem-audit-ortak.md` dosyasını OKU; kurallar ve YASAK listesi aynen geçerli.

**Rapor:** `docs/sistem-audit-2026-10-25/ILISKILER.md` (yalnız bu dosyayı yazabilirsin). Bulgu ID öneki `R-`.

## Girdi
Dalga 1 raporları: `docs/sistem-audit-2026-10-25/M{1..5}-*.md` — her birinin **bölüm 4 (Modüller arası ilişkiler)** ve **bölüm 5
(Eski audit durumu)** kısımları. Modül bulgularını TEKRAR LİSTELEME; sen modüllerin ARASINA bak.

## Görev
1. **Çelişkiler:** iki rapor aynı bağ/eski madde için farklı şey söylüyorsa (biri DÜZELDİ biri AÇIK, biri "sorun yok" biri "kopuk") kodda
   hakemlik yap, doğrusunu yaz.
2. **Sahipsiz dikişler:** hiçbir modül raporunun incelemediği ortak noktalar. En az şu temaları KODDAN izle:
   - **Kişi yaşam döngüsü yayılımı:** pasifleştirme / işten ayrılma / silme / proje değiştirme / erişim başlangıcı → Hik+IDE cihaz roster,
     mobil oturum + QR + kapı niyeti, PDKS/vardiya plan referansları, ziyaretçi ev sahipliği, grant status, KVKK verisi. Hangi olay hangi
     tabloyu güncelliyor/güncellemiyor — matris çıkar (satır: olay, sütun: etkilenen alan, hücre: VAR file:line / YOK / KISMEN).
   - **Proje (müşteri) yaşam döngüsü:** proje pasifleştirme/silme → cihazlar, kuyruklar, cron işleri, mobil, raporlar, e-posta raporları.
   - **Kimlik tutarlılığı:** kart no (metin vs sayı), ideUuid/seri/ehomeId, employee ↔ employeeAuth ↔ users e-posta; tekillik nerede zorlanıyor.
   - **Zaman:** UTC vs Europe/Istanbul gün sınırı — cardReadings yazımı, PDKS gün, rapor filtreleri, mobil, cron saatleri.
   - **Saklama/temizlik:** büyüyen tablolar ve temizleyen cron var mı (cardReadings, deviceEvents, auditLog, checkInTokens, sessions,
     pending ops, syncRuns, alarm). Convex Free 1M fonksiyon çağrısı/ay: tüm cron + köprü poll'ları toplam tahmini tablo.
   - **Şema borcu:** `convex/schema.ts`'te hiçbir yerden okunmayan/yazılmayan tablo/alan/index; yazılıp hiç okunmayan alan.
3. **Ölü uç taraması (tüm sistem):** `convex/**` public query/mutation/action listesi → `src/**`, `mobile/lib/**`, `infra/**`, `scripts/**`,
   `convex/**` içinde çağıranı olmayanlar (ör. `api.X.Y` / Dart'ta `"X:Y"` string'i). Tablo: fn | dosya:satır | çağıran yok | not.

## Rapor biçimi (Türkçe, sade, ≤ 450 satır)
1. **Sonuç (2-3 cümle)** + sayım (P0/P1/P2/P3).
2. **Modül ilişki haritası** (kısa: hangi modül hangi tabloyu yazıyor/okuyor — ortak tablolar).
3. **Kişi yaşam döngüsü matrisi** + **proje yaşam döngüsü** bulguları.
4. **Yeni bulgular** tablosu (ortak spec biçimi, ID `R-`).
5. **Raporlar arası çelişkiler** ve hakem kararı.
6. **Saklama/kota tablosu** ve **şema borcu**.
7. **Ölü uçlar** tablosu (en fazla 40 satır; fazlası sayı olarak).

`worker_done` ≤10 satır: sayım, en önemli 3 bulgu (file:line), rapor yolu, `--outcome succeeded`.
