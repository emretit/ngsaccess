# Hik raporları — Faz 3: Aylık Durum renkli Excel (Hik "Attendance Status")

Önce `.claude/orca-specs/hik-rapor-ortak.md` dosyasını oku; oradaki YASAK + kapı + rapor kuralları bu işin parçası.
Faz 2 bitti: rapor tanımında `excelLayout`, export dağıtımı ve ortak Excel yardımcıları hazır. Ayrıntı ve dosya yolları: `.claude/reports/hik-rapor-f2.md`.
`aylik-durum` raporu zaten `excelLayout: 'statusMatrix'`; dağıtım `src/lib/reports/excel/statusMatrix.ts` dosyasındaki builder'ı çağırıyor ve bu builder şu an
düz tablo + lejant yazıyor. Bu fazda builder'ın gövdesini gerçek düzenle değiştireceksin. Paralelde Faz 4 worker'ı `src/lib/reports/excel/personSheets.ts` üzerinde çalışıyor — ona DOKUNMA.
Hik düzeni: `docs/hikconnect-reports/shots/attendance-status.png`. Yalnız web (`src/**`); Convex'e dokunma.

## Hedef (test edilebilir)
Aylık Durum → "Excel (renkli durum tablosu)" tek sayfa üretir: kişi başına bir satır, ayın her günü bir kolon (hücrede bordro kodu, koda göre dolgu),
sağda toplamlar, departman ara başlıkları, dondurulmuş başlık, A4 yatay yazdırma ve "Lejant" sayfası. Ekrandaki tablo ve CSV/PDF değişmez,
yalnız ekrana ve tüm dışa aktarmalara "Erken çıkış (gün)" toplam kolonu eklenir.

## Düzen
- Sayfa adı "Aylık Durum". Satır 1 başlık, satır 2 proje · dönem · "İstanbul saati (UTC+3)". İki satırlık başlık: Ad Soyad · Departman · Bordro kodu ·
  her gün bir kolon (üst gg.aa, alt kısa gün adı; gün türü dolgusu ortak yardımcıdan) · "Toplam" birleşik üst başlığı altında:
  Çalışılan (N) · Geç (gün) · Erken çıkış (gün) · Devamsız (DV) · İzinli (İZN) · Hafta tatili (HT) · Resmî tatil (RT) · İnceleme · Toplam süre · Fazla mesai.
- Departmana göre grupla; her grubun önünde tüm genişlikte birleşik departman satırı.
- Gün hücresi = `cell.payrollCode` (değişmez; `future`/`noData` → "—", `incomplete` → "?"). Dolgular (soluk tonlar, okunur siyah metin):
  DV açık kırmızı · İZN açık mavi · HT açık gri · RT açık amber · "?" açık sarı · N dolgusuz. Geç veya erken çıkışlı N günü: metin "N" kalır,
  yazı rengi turuncu + kalın ve hücre notu (exceljs `note`) "Geç" / "Erken çıkış" / "Geç + erken çıkış". Manuel düzeltilmiş gün: notta "Manuel".
- Toplamlar mevcut `countAttendance` / `row.totals` değerlerinden (yeniden hesaplama yok); süreler `S:DD` metni.
- İlk 3 kolon + başlık satırları dondurulmuş, ince kenarlıklar, A4 yatay `fitToWidth: 1`, başlık satırları her sayfada tekrar.
- "Lejant" sayfası: kod → anlam (N Normal çalışma, DV Devamsız, İZN İzinli, HT Hafta tatili, RT Resmî tatil, ? İnceleme gerekiyor, — veri yok/gelecek),
  renk anlamları, turuncu kalın = geç/erken çıkış, notlar.

## Ekran / registry
`src/lib/reports/registry.ts`'te YALNIZ `aylik-durum` (ve aynı `MONTHLY_TOTALS`'ı paylaşan aylık raporlar) için "Erken çıkış (gün)" toplam kolonu ekle
(`row.attendance.earlyExitDays`); varsayılan görünür değil. Başka rapor girişine dokunma.

## Testler (vitest, gerçek exceljs)
Sayfa adları · gün başlıkları (31 gün, kısa gün adları) · departman satırı · DV/İZN/HT/RT/? dolguları · geç N günü turuncu+not · toplam değerleri
`countAttendance` ile aynı · `=` ile başlayan kişi adı nötrleşir · dondurma ve yazdırma ayarları · eski tablo düzeni kullanılan diğer raporlar değişmedi.

## Ownership (yalnız bunlara yaz)
`src/lib/reports/excel/statusMatrix.ts` + yanına yeni test dosyası · `src/lib/reports/registry.ts` (yalnız yukarıdaki kolon) · `src/lib/reports/registry.test.ts`.
Ortak yardımcı dosyasında eksik varsa DEĞİŞTİRME; kendi dosyanda yerel yardımcı yaz ve raporda belirt.

## Kapsam dışı
Convex · Kişi Devam Dökümü (Faz 4) · Aylık Özet (Faz 2) · bordro kodlarının anlamı.

## Rapor yolu
`.claude/reports/hik-rapor-f3.md`
