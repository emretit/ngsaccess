# UI Audit 2 — 01 Ana Sayfa (/home) + Kabuk

**Tarih:** 2026-10-19 · **Kapsam:** masaüstü (1639px) tam tur, mobil (390px) DOM ölçümü + menü/Sheet etkileşimi, kaynak kod.

## Özet

A2 arayüzü ekranda tutarlı ve temiz: tek h1, sade sayaç şeridi, bordo sidebar, çalışan ⌘K paleti, aramalı proje seçici, mobil Sheet (odak "Kapat"a gider, Escape ile menü düğmesine döner). Yüksek önemde bulgu yok. Asıl sorunlar veri anlamında: "veri yok" ile "gerçekten 0" ayırt edilemiyor, "Canlı" etiketi 2 aylık veriyle yanıltıyor ve ana sayfa her kart okumasında ağır sorguları yeniden çalıştırıyor.

| Yüksek | Orta | Düşük |
|---|---|---|
| 0 | 4 | 7 |

## Bulgular

| ID | Önem | Kategori | Ne görülüyor | Neden sorun | Öneri | Kanıt |
|---|---|---|---|---|---|---|
| 01-O1 | Orta | içerik | Bugün okuma yokken "Bugün gelen 0 / 7", "Şu an içeride 0", "Geç kalan 0" gösteriliyor. | Backend okuma yoksa `null` döner (veri yok), UI `?? 0` ile bunu gerçek sıfıra çeviriyor; "Geç kalan 0" yanlış güven verir. | `null` ise "—" göster, alt metin "Bugün okuma yok". | `src/components/dashboard/TodayStrip.tsx:42-43,63,66`; `convex/dashboard.ts` getActivitySummary (`hasReadings ? … : null`); `d1-top.png` |
| 01-O2 | Orta | içerik | "Canlı akış" başlığında yanıp sönen yeşil "Canlı" noktası var; listedeki en yeni kayıt 18.08, yani ~2 ay eski. Cihazların 4'ü de çevrimdışı ("0/4"). | "Canlı" yanlış izlenim verir; yazılım çalışıyor sanılır. | Son okuma 1 saatten eskiyse noktayı söndür, "Son okuma: 18.08" yaz; ya da etiketi "Son okumalar" yap. | `src/components/dashboard/LiveFeed.tsx:34-42`; `d1-top.png`, `d2-bottom.png` |
| 01-O3 | Orta | performans | Ana sayfa 4 reaktif sorgu kullanıyor; `getTodayTimeline` bugünün tüm okumalarını `for await` ile tarıyor, `getActivitySummary` tam PDKS veri setini (personel+okuma+izin) yüklüyor. Her yeni okumada ikisi de yeniden çalışır. | Yoğun projede function-call/okuma kotası yer (bkz. IDE poll kotası olayı); süre ölçülmedi, **doğrulanmadı**. Eski HOME-UI-12 kısmen hâlâ açık. | Saatlik sayaç tablosu/aggregate; özet için bugüne özel hafif sorgu veya throttle. | `convex/dashboard.ts:121-141` (timeline), `:818-833` (activity), `loadPdksDataset` `:~160` |
| 01-O4 | Orta | etkileşim/içerik | "Kart okumaları" panelinde okuma yokken 200px'lik boş mesaj alanı var; panel yanındaki Canlı akış'ın yüksekliğine esnediği için ~330px boş beyaz alan. | İlk ekranın yarısı boş; günün büyük bölümünde böyle görünür. | Boş durumda paneli içerik boyunda tut (`items-start`) ya da sağ kolona bağla. | `src/pages/Index.tsx:11,25` (`h-full` panel), `DashboardPanel.tsx:27`; `d1-top.png` |
| 01-D1 | Düşük | içerik | Grafik gösterge "İzin / Ret", akış satırı "İzin verildi / Reddedildi". | Aynı durum için iki ad. | "İzin verildi / Reddedildi" kullan. | `ReadingsTimeline.tsx:13,38-39` vs `LiveFeed.tsx:83` |
| 01-D2 | Düşük | içerik | Akış zamanı eski kayıtlarda yıl olmadan "18.08 16:06". | Yıl değişince/aylar sonra belirsiz. | 24 saatten eskiyse yıl ekle veya `title` ile tam tarih. | `src/lib/relativeTime.ts` feedTimeTr; `d2-bottom.png` |
| 01-D3 | Düşük | erişilebilirlik | Saat `<p aria-label="İstanbul saati 18:20">`, çocukları `aria-hidden`. | `p` rolü adlandırmayı desteklemez; ekran okuyucu saati okumayabilir. | `role="timer"`/`group` yerine görünmez metin (`sr-only`) kullan. | `DashboardHeader.tsx:19-29` (snapshot'ta paragraph "İstanbul saati 18:21" görünüyor ama okuyucu desteği **doğrulanmadı**) |
| 01-D4 | Düşük | görsel | Üst çubuk breadcrumb'ı "Ana Sayfa" ve sayfa h1'i "Ana Sayfa" aynı anda; altbilgide proje adı + "İstanbul saati (UTC+3)" saat etiketini tekrarlıyor. | Gürültü. | Home'da breadcrumb'ı gizle; altbilgiyi kaldır veya sadeleştir. | `AppHeader.tsx:41-44`; `Index.tsx:31`; `d2-bottom.png` |
| 01-D5 | Düşük | erişilebilirlik | Mobilde panel linkleri "Tümü" 50×32, "Cihazlar" 65×32; üst çubuk ikonları 36×36. | WCAG 2.2 AA (24px) geçer ama 44px önerisinin altında, dokunması zor. | Link min yüksekliği 44px (`min-h-11`). | `DashboardPanel.tsx:30` (`min-h-8`); mobil ölçüm (eval) |
| 01-D6 | Düşük | erişilebilirlik | Tek projeli kullanıcıda proje adı etiketsiz `div`; çok projelide "Proje ara" hem görünür label hem `aria-label` olarak çift. | Tek projede ekran okuyucu "emre"yi bağlamsız okur. | `aria-label="Aktif proje: X"`; çift etiketi tekilleştir. | `ProjectSwitcher.tsx:16,24,30` |
| 01-D7 | Düşük | görsel | Mobil emülasyon ekran görüntüleri tool tarafından parçalı geliyor (aynı alan 3 kez); mobil sayfa görsel turu bu yüzden yalnız DOM ölçümüyle yapıldı: yatay taşma yok (scrollWidth 390), Sheet çalışıyor. | Mobilde hiza/kesilme **doğrulanmadı** (gerçek görüntü yok). | Gerçek cihazda/DevTools'ta bir kez gözle kontrol. | `m1-top.png` (parçalı); eval ölçümü |

## Hâlâ açık (eski ID)
- HOME-UI-12 (SHL-08): ağır tarama — 01-O3 olarak devam.
- Eski HOME-UI-04/05/06/07/08/09/10/11 ve SHELL-UI-01/05/06/07/09 yeni kodda kapalı görünüyor (Tümü→/live-monitoring, "Kart okuması" etiketi, rol filtreli hızlı erişim, skip-link, ⌘K, aramalı seçici, mobil Sheet).

## Hızlı düzeltmeler (≤30 dk)
1. 01-O1: `null` özet değerlerini "—" göster (TodayStrip).
2. 01-O2: "Canlı" noktasını son okuma yaşına bağla.
3. 01-D1: gösterge adlarını "İzin verildi/Reddedildi" yap.
4. 01-D5: panel link `min-h-11`.
5. 01-D4: Home'da breadcrumb + altbilgi sadeleştir.
6. 01-O4: boş grafikte panel yüksekliği.

## Ürün kararı gereken
1. "Bugün gelen / içeride / geç kalan" veri yokken "0" mı yoksa "—" mı görünsün (01-O1)?
2. Ana sayfa canlı abonelikli kalsın mı, yoksa ağır özetler 30-60 sn'de bir mi yenilensin (01-O3)?

## Test edilmedi
Hesap menüsü açma ve gerçek Tab ile tüm sayfa odak sırası tam gezilmedi (Tab ile odak halkası 3px outline görüldü); yükleme/hata durumları kodla incelendi, ekranda tetiklenmedi.

## Kararlar (Emre, 2026-10-19)
- 01-O1: veri yokken "—" + "Bugün okuma yok" gösterilecek.
- Düzeltmeler tüm sayfaların taraması bitince toplu yapılacak.
