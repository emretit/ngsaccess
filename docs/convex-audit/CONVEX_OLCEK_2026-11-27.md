# Convex ölçek denetimi — NGS Plus (2026-11-27)

> Salt okuma denetimi. `npx convex` çalıştırılmadı, kod değişmedi. Kod durumu: `c82eb800` + çalışma ağacı.
> Kullanım panosuna erişim yoktu; sayılar koddan ve varsayımlardan türetildi (aşağıda açıkça yazılı).

## Sonuç (1-2 cümle)

**Convex para yüzünden değil, iki yapısal şey yüzünden yorar:** (1) Free plan ticari kullanıma uygun değil —
0,5 GB veritabanı sınırı tek müşteriyle bile birkaç ay ile ~1 yıl içinde dolar ve aşımda kart okuma kayıtları
yazılamayabilir; (2) koddaki birkaç "tek sorguda tüm aralığı oku" deseni, 200 kişilik bir müşteride
**aylar içinde** Convex'in sorgu başı okuma sınırına (16 MiB / 32.000 belge) takılır. Pro plana geçip bu
sorguları düzeltince 50 müşteriye kadar aylık maliyet kabaca **$65–255** bandında kalır.

---

## 1. Resmi limitler

Kaynaklar (2026-11-27'de okundu):
[Limits](https://docs.convex.dev/production/state/limits) ·
[Pricing](https://www.convex.dev/pricing) ·
[Pricing FAQ](https://www.convex.dev/pricing/faq) ·
[Usage limits](https://docs.convex.dev/production/usage-limits) ·
[Backup & Restore](https://docs.convex.dev/database/backup-restore) ·
[Multiple deployments](https://docs.convex.dev/production/multiple-deployments) ·
[Self-hosting](https://docs.convex.dev/self-hosting)

### Plan kaynakları (ABD fiyatı; diğer bölgeler ×1,3)

| Kaynak | Free | Starter (kullandıkça öde) | Professional ($25/geliştirici/ay) |
|---|---|---|---|
| Fonksiyon çağrısı | 1M/ay (sert) | 1M dahil, +$2,20/1M | 25M dahil, +$2/1M |
| Action compute | 20 GB-saat | 20 dahil, +$0,33/GB-saat | 250 dahil, +$0,30 |
| DB depolama (satır + **index**) | 0,5 GB | 0,5 dahil, +$0,22/GB-ay | 50 GB dahil, +$0,20 |
| DB I/O (fonksiyon↔DB okuma/yazma) | 1 GB/ay | 1 dahil, +$0,22/GB | 50 GB dahil, +$0,20 |
| Dosya depolama (dosya + yedek) | 1 GB | 1 dahil, +$0,033/GB | 100 GB dahil, +$0,03 |
| Veri çıkışı (egress) | 1 GB/ay | 1 dahil, +$0,132/GB | 50 GB dahil, +$0,12 |
| Geliştirici / deployment | 1-6 / 40 | 1-6 / 40 | 1-20 / 300 |
| Deployment sınıfı | S16 | S16 | S256 |
| Günlük otomatik yedek | Yok (elle en çok 2 yedek, 7 gün) | Yok | Var (7 gün; haftalık 14 gün) |
| Özel alan adı (custom domain) | Yok | Yok | Var |
| Log streaming / hata raporlama | Yok | Yok | Var |

- **Kullanım takım (team) toplamıdır**, proje başına değil.
- Business/Enterprise: $2.500/ay minimum; dedicated (D1024/D2048), SLA, fiziksel yedek.
- Not: DB depolama "her index tablonun bir kopyası gibi fiyatlanır" (limits sayfası notu).

### Aşımda ne olur

| Plan | Davranış |
|---|---|
| Free | Uyarı e-postası; uzun süre aşımda fonksiyon çağrıları HTTP hatası dönebilir; "yeni ekleme/güncelleme yapan mutation'lar başarısız olabilir" → **kart okuma kaydı yazılamaz**. |
| Starter / Pro | Uyarı e-postası + aşım ücreti; trafik kesilmez. |
| Kendi koyduğun usage limit | "Disable" eşiği aşılırsa deployment o gün/ay için kapanır; dev deployment'larda **e-posta gönderilmez**. |

### Çalışma limitleri (tüm planlarda aynı)

| Limit | Değer |
|---|---|
| Sorgu/mutation başı okunan veri | **16 MiB** (`filter` ile elenen de sayılır) |
| Sorgu/mutation başı taranan belge | **32.000** |
| Sorgu/mutation başı index aralığı (`db.get` + `db.query` sayısı) | **4.096** |
| Yazılan veri / belge | 16 MiB / 16.000 |
| Query/mutation süresi | 1 sn (yalnız kullanıcı kodu) |
| Action süresi | Convex runtime 30 dk · Node 10 dk |
| Belge boyutu | 1 MiB; dizi 8.192 eleman; 1.024 alan |
| Tablo / tablo başı index | 10.000 / 32 |
| Eşzamanlı (S16 → S256) | sorgu 16→256 · mutation 16→256 · action 64→512 · zamanlanmış iş 8→256 · oturum 1.000→10.000 |
| Mutation yazma hızı (S16/S256) | 4 MiB/sn / 8 MiB/sn |
| Mutation başı zamanlanan fonksiyon | 1.000; bekleyen toplam 1.000.000 |
| HTTP action yanıtı | 100 MiB (istek boyutu sınırsız) |
| Ortam değişkeni | 512 adet, değer ≤ 8 KiB |

### Dev vs prod deployment

- Her projede **1 prod** + geliştirici başına **1 dev** deployment vardır; verileri ve push süreçleri ayrıdır.
- Limit/fiyat açısından fark yok (kullanım takım toplamı). Farklar: dev deployment'ta usage-limit
  **uyarı e-postası yok**, dev deployment bir geliştirici hesabına bağlı ve `npx convex dev` ile
  **her çalışma ağacından doğrudan push** alır; prod'a yalnız `npx convex deploy` + deploy key ile gidilir.
- Yedek: Free/Starter'da otomatik yedek yok (elle, deployment başına en çok 2, 7 gün saklanır).

### Self-hosting

Açık kaynak backend ([convex-backend](https://github.com/convex/convex-backend)), bulutla aynı kod.
Lisans FSL-Apache-2.0: Convex Cloud'a rakip ürün yapmamak şartıyla serbest → NGS Plus için uygun.
Plan limitleri yok; yedek, güncelleme, izleme ve ölçek sizde.

---

## 2. Risk listesi (koddan)

Varsayım: `cardReadings` satırı ≈ **1,5–2 KB** (ham cihaz gövdesi `rawData` olarak saklanıyor,
`convex/lib/processCardReadingCore.ts:258`). 16 MiB ÷ ~1,8 KB ≈ **~9.000 okuma** = tek sorgunun güvenli tavanı.
200 kişi × 2 geçiş × 22 iş günü = **8.800 okuma/ay**.

### Engel (büyüyünce kırılır)

| # | Yer | Sorun | Tahmini eşik |
|---|---|---|---|
| E1 | `convex/dashboard.ts:467` `getAnnualOvertimeBalance` (PDKS uyarıları, `PDKSOvertimeAlert` + `PDKSSmartPresets`) | Yılın **tüm** okumalarını tek sorguda okuyor (`loadPdksDataset`) | 200 kişilik projede ~**1 ay** veride 16 MiB'e yaklaşır, ~3,6 ayda 32.000 belge sınırını geçer → sorgu hata verir |
| E2 | `convex/dashboard.ts:196` (super_admin, proje seçilmemiş) | `by_access_time` aralıksız + `.filter` → **tüm tenant'ların tüm okumalarını** tarıyor | Toplam tabloda ~9.000–32.000 okuma (1 müşteride ~1-4 ay) |
| E3 | `convex/dashboard.ts:224` (çok projeli kullanıcı, proje seçilmemiş) | `by_project` + `.filter(accessTime)` → projenin **tüm geçmişini** tarıyor | Projede ~1-4 aylık veri |
| E4 | `convex/lib/pdksTableQuery.ts:62` ve `convex/lib/pdksPayrollQuery.ts:113` (PDKS tablosu, bordro) | Mesai dönemi (hafta/ay) okumalarını tek `.collect()` ile okuyor | ~**200 kişi**/proje (günde 4 geçişte ~100 kişi) |
| E5 | `convex/dashboard.ts:255` + `:258` | `leaves` ve `departments` **tüm tablo** (tüm tenant'lar) her ana sayfa sorgusunda | İzin tablosu tüm müşterilerle büyür; ayrıca herhangi bir müşterinin izin değişikliği **herkesin** ana sayfasını yeniden çalıştırır |

### Düzeltilmeli (maliyet / yavaş büyüyen risk)

| # | Yer | Sorun |
|---|---|---|
| D1 | `convex/schema.ts:757-776` | `cardReadings`'te **20 index** + `rawData`. Depolama satır başı ~4 KB (alt) – ~38 KB (Convex'in "index = tablo kopyası" notuna göre üst). En büyük depolama kalemi. |
| D2 | `convex/privacyRetention.ts:34` + `:202` | Kart okuma saklaması isteğe bağlı ve **en az 1.825 gün (5 yıl)**; `auditLog` hiç silinmiyor (`oldValue/newValue: v.any()`, 11 index). İkisi de sınırsız büyür. |
| D3 | `src/hooks/useDashboard.ts:14-35` | Ana sayfada 4 canlı sorgu (`getStats`, `getActivitySummary`, `getTodayTimeline`, `getRecentReadings`). Her kart okumasında açık her ana sayfa bunları yeniden çalıştırır; `getActivitySummary` tüm personel + bugünkü okumalar + tüm izinleri okur (~1 MB/çalışma) → **DB I/O'nun ana kaynağı**. |
| D4 | `convex/http.ts:112,194,259` | Kart okuma başı 4 fonksiyon çağrısı (HTTP action + token sorgusu + `updateLastSeen` + `processCardReading`); `updateLastSeen` her okumada `devices` satırını yazıp cihaz listesini izleyen sayfaları da yeniden çalıştırır. |
| D5 | Canlı = `dev:notable-tern-4` | Dev deployment: (a) ana ağaçtan yanlışlıkla `convex dev`/`codegen` canlıya push eder; (b) otomatik yedek yok (Free); (c) usage-limit e-postası gelmez; (d) bir geliştirici hesabına bağlı. Cihaz köprüleri, ESP32 nginx, IDE daemon ve mobil uygulama `notable-tern-4.convex.site/.cloud` adresine sabit → taşıma zor. |
| D6 | Zombi Hik köprüsü (`POST /hik-bridge/roster`, 404) | 2026-10-19'da ~3 sn'de bir geri gelmişti ≈ **~860K çağrı/ay** — tek başına Free kotasının %86'sı. Hâlâ sürüyorsa en büyük çağrı kalemi. |
| D7 | `convex/shifts.ts:121` | Aralık verilmezse projenin **tüm vardiya atama geçmişi** dönüyor (yıllar içinde büyür). |

### Not (şu an sorun değil)

- Canlı izleme (`convex/cardReadings.ts:300` `listLiveSince`) ve kart listesi (`:123`) sayfalı ve bayt sınırlı — iyi örnek.
- Raporlar (`convex/lib/reportScope.ts:49`) 20.000 okuma tavanı koyup anlaşılır hata veriyor (yine de 16 MiB'e ~9.000'de takılabilir).
- Operasyon tabloları (Hik/IDE kuyruğu 30 gün, sync run 90 gün, cihaz olayı 365 gün, oturum/token) günlük temizleniyor.
- Hik olayları event-driven (`infra/hik-event-bridge`, poll yok; saatlik durum snapshot'ı).
- IDE daemon poll'u şu an 1 saate çekili; normal ayarda (boşta 60 sn) ≈ 86K çağrı/ay sabit.
- Cron'lar ≈ 40-60K çağrı/ay sabit (2026-10-16 ölçümü ~42K).
- Dosyalar: yükleme 5 MB sınırlı; yüz fotoğrafı ~100-200 KB/kişi → 200 kişi ≈ 20-40 MB. Sorun değil.
- Eşzamanlılık: S16'da (Free/Starter) 50 müşteride sabah vardiya girişinde (~5 okuma/sn × ~8 abonelik) 16 eşzamanlı sorgu sınırına yaklaşılır; S256'da (Pro) sorun yok.

---

## 3. Senaryo tahmini

**Varsayımlar** (müşteri başı): 200 kişi · 4 cihaz · günde 2 geçiş · 22 iş günü → 8.800 okuma/ay ·
mesaide 2 açık canlı ekran · 2 ofis kullanıcısı · mobilde günde %30 personel.
Çağrı/okuma ≈ 4 (cihaz yolu) + ~8 (abonelik yeniden çalışması) = **~12**.
Müşteri başı ≈ 105K (okuma) + 10K (cihaz durum) + 22K (panel+mobil) ≈ **~140K çağrı/ay**.
Sabit: cron'lar ~60K (+ zombi köprü varsa ~860K, + IDE poll açılırsa ~86K).

| | 1 müşteri | 10 müşteri | 50 müşteri |
|---|---|---|---|
| Fonksiyon çağrısı/ay | ~0,2M (zombi varsa ~1,06M ⚠ Free aşımı) | ~1,5M | ~7M |
| DB depolama, 12. ay (alt–üst) | 0,5–5 GB | 5–50 GB | 25–250 GB |
| DB I/O/ay (kaba) | 5–20 GB | 50–200 GB | 250 GB–1 TB |
| Dosya depolama | <0,1 GB | ~0,5 GB | ~2 GB |
| Egress/ay | <1 GB | ~2-5 GB | ~10-25 GB |
| **Free** | Çağrı OK; depolama + I/O **aşar** | Çalışmaz | Çalışmaz |
| **Starter $/ay** | ~$1–25 | ~$15–55 | ~$75–280 |
| **Pro $/ay** (1 geliştirici) | $25 | ~$25–55 | ~$65–255 |

- 5 yıllık saklama yürürlükteyse depolama 5. yılda ×5 olur (50 müşteri üst sınır ~1,2 TB → Pro'da ~$240/ay ek).
- Belirsizliğin büyüğü depolama (index çarpanı) ve DB I/O'da; aşağıdaki pano sayıları bunu kalibre eder.
- Maliyet kalemleri sırası: DB I/O > DB depolama > fonksiyon çağrısı. Çağrı sayısı sorun değil.

### Emre'den istenen pano verileri (dashboard.convex.dev)

1. **Team Settings → Usage** (bu ay + geçen ay): Function calls, Database storage (**Document / Index ayrımı**),
   Database I/O, Action compute, File storage, Data egress. Plan adı (Free mi Starter mı) ve bölge (ABD / AB).
2. Aynı sayfada **Function calls by function** grafiği: ilk 10 fonksiyon (özellikle `POST /hik-bridge/roster`
   hâlâ var mı, `getActivitySummary` payı).
3. **notable-tern-4 → Data**: `cardReadings`, `auditLog`, `deviceEvents`, `hikPendingOperations` satır sayıları.
4. **notable-tern-4 → Health / Insights**: "bytes read" veya "documents read" uyarısı veren fonksiyonlar.

---

## 4. Çıkış seçenekleri

| Seçenek | Artı | Eksi |
|---|---|---|
| **Convex Cloud Pro** (önerilen) | Kod değişmez; günlük yedek, custom domain, S256, log streaming; 50 müşteride ~$65–255/ay | Sağlayıcı kilidi; fiyat Convex'e bağlı |
| **Self-host Convex** (Hetzner) | Plan limiti yok; sabit ~€20-60/ay sunucu; kod aynı | Yedek, güncelleme, izleme, felaket kurtarma sizde; tek sunucu = tek arıza noktası; DB'yi (Postgres) ayrıca yönetmek |
| **Supabase / Postgres** | Standart SQL, Pafta tecrübesi, ucuz depolama | 224 dosyalık `convex/` + reaktif sorgular + auth + cron + scheduler yeniden yazımı → **aylar**; yüksek regresyon riski |

---

## 5. Öneriler (sıralı)

1. **Pro + gerçek prod deployment + custom domain** (`api.ngsplus.app` gibi): veri export/import, env
   kopyası (auth JWT anahtarları dahil), Netlify `VITE_CONVEX_URL`, köprü/ESP32/IDE daemon URL'leri, mobil
   build. Sonra cihazlar bir daha URL değiştirmez, günlük yedek açılır, yanlışlıkla push riski kalkar.
   **~1 gün + mobil store build.**
2. **Engel sorgularını düzelt (E1–E5):** yıllık mesai bakiyesini aylık özet tablosundan/`pdksRecords`'tan
   hesapla; `dashboard.ts:196/224` taramalarını `by_project_access_time` aralığına çevir; `leaves` /
   `departments` tam taramalarını index'li yap; PDKS/bordro okumalarını kişi başı index'li parçalara böl
   veya sayfalı yap. **~1,5–2 gün.**
3. **`cardReadings`'i incelt (D1):** `rawData`'yı ayrı tabloya taşı veya kısalt, 20 index'ten kullanılmayanları
   sil → depolama ve I/O birkaç kat düşer. Widen-migrate-narrow ile. **~1 gün.**
4. **Ana sayfa reaktifliğini sınırla (D3):** okuma başına tüm özeti yeniden hesaplamak yerine günlük sayaç
   belgesi (aggregate) veya 30-60 sn'lik non-reactive yenileme; `updateLastSeen` yazımını seyrelt (D4).
   **~1 gün.**
5. **Bekçiler:** panoda usage limit (uyarı) + team spending limit; zombi `/hik-bridge/roster` kaynağını
   kapat (D6); `auditLog` için saklama süresi kararı (D2). **~1 saat + Emre kararı.**
