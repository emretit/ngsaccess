# W5-D — PDKS dışa aktarma kolon seçici (özel export): FRONTEND (UYGULAMA)

## Ortak kurallar (bu repo; CLAUDE.md'yi okumadığın için buraya gömüldü)
- TypeScript strict. `any`/`as any` YASAK (eslint error); `unknown` + narrowing; `!` yerine erken return; tip korumalı filtre, `filter(Boolean)` değil.
- Convex sonuçları `any[]`'a açılmaz: `useQuery` sonucu ya da `FunctionReturnType<typeof api.X.Y>`.
- YASAK: commit, push, deploy, `npx convex *`, DB yazma, `convex/**` (W5-A paralel worker'ın alanı), `mobile/**`, `bridge/**`, `package.json`/lock, `App.tsx`/route dosyaları.
- Yeni Convex çağrısı/polling YOK: kolon seçimi, sıra ve ayraç değişimi tamamen istemci tarafı.
- Kullanıcıya görünen metinler Türkçe. Mevcut UI bileşen dilini (shadcn `src/components/ui/**`, mevcut `ReportPage` kolon menüsü) kullan; yeni tasarım dili icat etme.

## Hedef (test edilebilir)
PDKS ekranındaki "Dışa aktar" paneli (Excel/CSV/PDF genel PDKS dışa aktarması) kullanıcının seçtiği kolonları, seçtiği sırayla ve (CSV'de) seçtiği ayraçla üretir; seçim proje+kullanıcı bazında tarayıcıda hatırlanır; hiçbir seçim yapılmazsa çıktı bugünküyle birebir aynıdır.

## Bağlam (kodda doğrula; satırlar kayabilir)
- Tasarım (otoriter, salt-okuma, mutlak yol): `/Users/emreaydin/ngsaccess/.claude/designs/w5-pdks-codex.md` §4 "Özel dışa aktarma". Emre kararı: ilk sürüm yerel son seçim + sıra + ayraç; adlandırılmış/paylaşılan şablon tablosu YOK.
- PDKS panel: `src/components/pdks/dashboard/PDKSEnhancedExportPanel.tsx` (~98-110 genel export; aylık bordro ve APHB ayrı akış). Üreticiler: `src/utils/pdksExport.ts` (`exportToExcel` ~57 sabit başlıklar ~63, `exportToCsv` ~135 "," ayraç, `exportToPdf`).
- Raporlar: `/reports` kolon seçici zaten var — `src/components/reports/ReportPage.tsx` (~28-53), tercih saklama `src/lib/reports/columns.ts` (localStorage, proje+kullanıcı anahtarı), kolon kataloğu `src/lib/reports/registry.ts`, export `src/lib/reports/export.ts` (formül enjeksiyonu koruması ~20, Excel otomatik `(dk)` kolonu ~128, PDF 2000 satır limiti ~5). Bu desenleri PDKS paneline taşı; ikinci bir paralel altyapı yazma.
- Ücret görünürlüğü: frontend'de `capabilities(profile?.role).admin` deseni (`src/components/settings/sections/ReportsSettings.tsx:50`); backend maskesi zaten var, UI ayrıca ücret kolonlarını sunmaz.

## Değişiklik
1. **PDKS kolon kataloğu** (YENİ `src/lib/pdksExportColumns.ts` ya da `src/lib/reports/` altında): mevcut `PDKSExportRecord` alanlarından kararlı `key`, Türkçe `label`, `value(row)`, `dataType` (text|number|duration|date), `sensitivity` (`normal`|`sensitive`), `requiresPay`, `defaultExportVisible`. Varsayılan seçim = bugünkü başlıklar ve sırası (Çalışan, Kart no, Bordro Kodu, Departman, Gün Kodu, İlk Giriş, Son Çıkış, Toplam Saat, Mesai, İzin, Durum). Yalnız satırda ZATEN olan alanlar; yeni backend alanı isteme.
2. **Hassas kolonlar:** kart no ve benzeri kişisel tanımlayıcılar `sensitive`; kalıcı tercihten otomatik açılmaz (her açılışta varsayılan durumuna döner). Ama bugün varsayılan çıktıda olan bir kolonu (ör. Kart no) varsayılan seçimden ÇIKARMA — birebir uyumluluk önce gelir; yalnız "kaydedilen tercih" onu hatırlamaz. Bu çelişkiyi nasıl çözdüğünü raporda 1 satırla yaz.
3. **Panel UI:** "Kolonlar" bölümü/diyaloğu: dahil et/çıkar (en az 1 kolon), yukarı/aşağı sıra (klavye erişilebilir butonlar; sürükle-bırak şart değil), "Varsayılana dön". CSV için ayraç seçimi `,` (bugünkü varsayılan) / `;` / TAB. İlk 5 satırlık önizleme gerçek sıra ve başlıklarla. Aylık bordro ve APHB akışlarına kolon seçici UYGULANMAZ (yanlarında kısa açıklama yeterli).
4. **Üreticiler:** `exportToExcel/exportToCsv/exportToPdf` seçilen kolon listesini (sıralı) parametre olarak alır; parametre verilmezse bugünkü çıktı birebir. CSV: UTF-8 BOM, seçilen ayraca göre tırnak/yeni satır kaçışı, formül enjeksiyonu koruması (`=`, `+`, `-`, `@` başlangıçları) tüm formatlarda. Excel'de süre kolonu için `(dk)` türetme sessizce eklenmez; görünür bir seçenekse açıkça seçilir. PDF'te çok kolon yatay sığmazsa mevcut bölme/küçültme davranışını izle.
5. **Tercih saklama:** `{version: 1, orderedColumnKeys, format, delimiter}` sürümlü localStorage anahtarı (proje+kullanıcı); bilinmeyen/silinmiş anahtarlar elenir; bozuk JSON → varsayılan. Satır verisi ya da hassas değer saklanmaz.
6. **`/reports` (`ReportPage`)**: davranışı DEĞİŞMEZ; yalnız ortak yardımcıları (CSV kaçış, formül koruması) paylaşmak için gereken en küçük refactor serbest — mevcut `src/lib/reports/*.test.ts` beklentileri değişmemeli.

## Testler (en az)
- Seçim yok → Excel/CSV/PDF başlık + satır içeriği bugünküyle aynı (altın test).
- Sıra değişimi + kolon çıkarma → üç formatta aynı kolon listesi ve sıra.
- CSV ayraçları (`,` `;` TAB) + içinde ayraç/tırnak/yeni satır olan hücre + formül enjeksiyonu (`=SUM(...)`).
- Tercih: kaydet/oku, sürüm uyuşmazlığı, bilinmeyen anahtar eleme, bozuk JSON, proje/kullanıcı değişimi; hassas kolon kalıcı açılmaz.
- Ücret kolonu (varsa) admin olmayan için listelenmez.
- En az 1 kolon kuralı; önizleme 5 satır.
- Mevcut testlerin tamamı yeşil.

## Ownership (yalnız bunlara yaz)
`src/components/pdks/dashboard/PDKSEnhancedExportPanel.tsx` · `src/utils/pdksExport.ts` · YENİ kolon kataloğu + test · YENİ panel alt bileşen(ler)i `src/components/pdks/dashboard/export/**` (+test) · `src/lib/reports/export.ts` ve `src/lib/reports/columns.ts` (yalnız ortak yardımcı paylaşımı için, davranış değişmeden) · ilgili mevcut test dosyaları.

## Kapsam dışı
`convex/**` (W5-A paralel) · W5-A'nın getireceği yeni alanlar (`incomplete`, `punchQuality`, eksik süre) — sonraki turda kataloğa eklenecek · adlandırılmış/paylaşılan şablon · aylık bordro ve APHB çıktısı · `/reports` yeni özellik · T.C./e-posta/telefon gibi satırda olmayan hassas alanları getirmek.

## Kapılar (kendin koş; `npm ci` GEREKMEZ, node_modules kurulu)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0 · `node_modules/.bin/eslint src convex` → 0 error · `node_modules/.bin/vitest run` → tamamı yeşil (sayı) · `node_modules/.bin/vite build` → OK.

## Rapor
`/tmp/w5d-report.md` + `worker_done`'da ≤10 satır (file:line): değişen dosyalar · katalog anahtarları · varsayılan=bugünkü çıktı kanıtı (test adı) · hassas kolon kararı · kapı sayıları.
