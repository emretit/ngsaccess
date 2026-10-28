# Hik raporları — Faz 4: Kişi Devam Dökümü Excel (Hik "Attendance Overview")

Önce `.claude/orca-specs/hik-rapor-ortak.md` dosyasını oku; oradaki YASAK + kapı + rapor kuralları bu işin parçası.
Faz 2 bitti: `kisi-devam-dokumu` raporu (ekranda kişi × ay toplam tablosu, satır tipi `personMonth`, gün hücreleri `includePunches` ile `pairs`/`breaks` içerir),
`excelLayout: 'personSheets'`, export dağıtımı ve ortak Excel yardımcıları hazır. Ayrıntı ve dosya yolları: `.claude/reports/hik-rapor-f2.md`.
Dağıtım `src/lib/reports/excel/personSheets.ts` dosyasındaki builder'ı çağırıyor; şu an düz tablo + lejant yazıyor. Bu fazda gövdeyi gerçek düzenle değiştireceksin.
Paralelde Faz 3 worker'ı `src/lib/reports/excel/statusMatrix.ts` ve `registry.ts` üzerinde çalışıyor — onlara DOKUNMA.
Hik düzeni: `docs/hikconnect-reports/shots/attendance-overview.png`. Yalnız web (`src/**`); Convex'e dokunma.

## Hedef (test edilebilir)
Kişi Devam Dökümü → "Excel (kişi başına sayfa)" seçili/filtrelenmiş her kişi için ayrı sayfa üretir: üst bilgi bandı, özet tablosu,
izin özeti ve ayın her günü bir satır olan döküm (çiftler, süreler, durum); en sonda "Lejant" sayfası.

## Düzen (her kişi bir sayfa)
- Sayfa adı: "Ad Soyad" (Excel sayfa adı kuralları: en çok 31 karakter, `\ / ? * [ ] :` temizlenir, çakışmada " (2)" eklenir, boşsa "Kişi N").
- Satır 1 tam genişlik birleşik, sarı dolgulu bant: "Ad Soyad: … · Departman: … · Bordro kodu: … · Dönem: gg.aa.yyyy – gg.aa.yyyy".
- Özet tablosu (Hik üst blok): satırlar Hafta içi · Hafta sonu · Resmî tatil · Toplam; kolonlar Gün sayısı · Çalışılan gün · Çalışma süresi · Fazla mesai.
  Yanında: Geç (gün / dk) · Erken çıkış (gün / dk) · Devamsız (gün) · Mola toplamı · İnceleme (gün). Değerler `PersonMonthTotals` + gün hücrelerinden.
- İzin özeti: izin türü başına gün (yalnız veride geçenler); izin yoksa "İzin yok".
- Döküm (başlık "Günlük döküm"): her gün bir satır — Tarih (gg.aa.yyyy) · Gün · Vardiya · Plan (başlangıç–bitiş, esnekte "Esnek") ·
  Giriş 1 · Çıkış 1 · Giriş 2 · Çıkış 2 · Giriş 3 · Çıkış 3 (fazlası son hücrede "+k çift"; eksik uç "—") · Çalışma · Fazla mesai · Geç · Erken çıkış · Mola · Durum · İzin türü.
  Gün türü dolgusu ortak yardımcıdan; `future`/`noData` satırı gri metinle "—". Altta toplam satırı (süre/fazla mesai/geç/erken/mola toplamları).
- Süreler `S:DD` metni. Başlık satırları dondurulmuş, A4 dikey `fitToWidth: 1`, döküm başlığı yazdırmada tekrar.
- Sayfa sayısı sınırı: 300 kişiden fazlaysa dışa aktarma bilgilendirici mesajla durur ("En fazla 300 kişi; departman ya da kişi filtresi seçin.") —
  mevcut `notify.info` kalıbıyla, `export.ts`'e dokunmadan builder'dan anlamlı bir hata/uyarı yolu kur; nasıl yaptığını raporda belirt.
- "Lejant" sayfası: durum etiketleri, dolgu anlamları, "Mola = okutma çiftleri arasındaki boşluk", süre biçimi.

## Testler (vitest, gerçek exceljs)
İki kişi → iki sayfa + Lejant · sayfa adı temizleme/çakışma · üst bant metni · özet sayıları `PersonMonthTotals` ile aynı · 3'ten fazla çiftte "+k çift" ·
eksik uç "—" · gece vardiyası günü tek satır · izin türü özeti · `=` ile başlayan ad nötrleşir · 301 kişide uyarı.

## Ownership (yalnız bunlara yaz)
`src/lib/reports/excel/personSheets.ts` + yanına yeni test dosyası. Ortak yardımcı dosyasında eksik varsa DEĞİŞTİRME; kendi dosyanda yerel yardımcı yaz ve raporda belirt.
Kişi detay çekmecesine "Aylık dökümü indir" düğmesi bu fazda YOK (plan 4.2 isteğe bağlı, ertelendi).

## Kapsam dışı
Convex · registry · Aylık Durum (Faz 3) · Aylık Özet (Faz 2).

## Rapor yolu
`.claude/reports/hik-rapor-f4.md`
