# UI sayfa taraması — ortak bağlam (Faz B: 13 sayfa, tarama + tasarım önerisi, KOD DEĞİŞMEZ)

## Hedef
Tek bir sayfanın mevcut arayüzünü ayrıntılı tara ve seçilen yeni tasarım diline göre yeniden tasarla. Çıktı, sonraki
uygulama dalgasında (Faz C) bir geliştiricinin doğrudan uygulayabileceği kadar somut olmalı.

## Önce oku (zorunlu)
1. `docs/ui-scan/DESIGN_DIRECTION.md` — kesinleşmiş tasarım dili (A2). Token, ölçek, kabuk, sayfa kalıbı, yasaklar.
2. Referans mockup: `docs/ui-scan/directions/A2-sade-bordo-sidebar/home.html` ve `people.html` — kabuk/sidebar/üst çubuk/
   tablo/rozet/filtre/toplu işlem çubuğu CSS'ini buradan AYNEN al (aynı class'lar ve değişkenler), yeniden icat etme.
3. Mevcut ekran görüntüleri: `docs/ui-scan/current/<NN>-<slug>.png` ve `-2.png` (ikinci ekran = aşağı kaydırılmış).
   Görüntüleri aç ve incele. Dosya yoksa yalnız koddan çalış ve raporda bunu belirt.
4. Sayfanın kaynağı (spec'inde listeli) + kullandığı bileşenler, hook'lar ve Convex sorguları. Gösterilen her alan gerçek
   veri modelinden gelmeli; yeni metrik/alan UYDURMA. Yeni veri gerekiyorsa "backend gereksinimi" diye ayrı listele.
5. Önceki UX audit'inde bu modülün bulguları (spec'inde listeli rapor) — çözülenleri tekrarlama, açık olanları kullan.

## Teslim (YALNIZ kendi klasörün: `docs/ui-scan/pages/<NN>-<slug>/`)
1. `REPORT.md`:
   - **Özet** (3 cümle): sayfanın amacı, en büyük 3 sorun, önerinin özü.
   - **Mevcut durum taraması:** tablo halinde bulgular — ID (`<KISALTMA>-UI-01`…), kategori (görsel hiyerarşi / yerleşim /
     tipografi / renk-kontrast / bileşen tutarlılığı / durumlar: boş-yükleniyor-hata / form-diyalog / responsive /
     erişilebilirlik / "AI arayüzü izi" / mikro-metin), kanıt (`dosya:satır` ve/veya ekran görüntüsü bölgesi), etki
     (yüksek/orta/düşük), öneri. Mümkünse 12-25 bulgu; dolgu bulgu yazma.
   - **Yeni tasarım:** bilgi mimarisi (bölümler yukarıdan aşağıya), birincil/ikincil eylemler, tablo kolonları
     (sıra + genişlik önceliği + mobilde gizlenenler), filtreler, durum rozetleri, boş/yükleniyor/hata metinleri (Türkçe,
     gerçek), diyalog/form düzenleri (alan sırası, gruplama, doğrulama mesajı yeri), 390px davranışı.
   - **Bileşen eşlemesi:** hangi ortak bileşen (PageHeader, StatInline, FilterBar, BulkBar, DataTable, StatusBadge,
     EmptyState, Dialog/Sheet, Form alanları) nerede; mevcut hangi dosya/bileşen değişir ya da silinir.
   - **Backend gereksinimi** (varsa) ve **açık sorular** (ürün kararı gerekenler, en fazla 5).
   - **Uygulama tahmini:** S/M/L + kaba saat; riskli noktalar.
2. `mockup.html` — sayfanın A2 dilinde tek dosya HTML mockup'ı: ana görünüm + sayfanın en önemli 1-2 etkileşimi
   (ör. ekleme/düzenleme diyaloğu ya da yan paneli, boş durum) aynı dosyada açılır/kapanır şekilde. Kabuk (bordo sidebar
   + üst çubuk) A2 ile birebir; aktif menü bu sayfa. Harici ağ YOK, inline SVG ikon, emoji YOK, gerçekçi Türkçe örnek veri
   (TR saat/tarih formatı). 1440px öncelikli, 390px'te bozulmadan çalışsın.

## Kurallar
- `src/**`, `convex/**`, diğer klasörler DEĞİŞMEZ. Paralel 4 worker daha var; yalnız kendi klasörüne yaz.
- commit/push/deploy/migration/DB yazma YOK. Ağdan paket kurma YOK. Canlı uygulamaya giriş yapmaya çalışma.
- Yasaklar listesine (DESIGN_DIRECTION.md) uy; renk yalnız token'lardan.
- Kapı: iki dosya var; `mockup.html` file:// ile (mümkünse Chrome/Playwright, 1440 ve 390) konsol hatasız açılır ve belge
  yatay taşmaz; HTML `python3 -c` html.parser ile dengeli; REPORT.md'deki her bulgunun kanıtı var.
- Rapor: `worker_done` özeti ≤10 satır: en önemli 3 bulgu, önerinin özü, dosya yolları, açık soru sayısı,
  `--report-path docs/ui-scan/pages/<NN>-<slug>/REPORT.md`.
