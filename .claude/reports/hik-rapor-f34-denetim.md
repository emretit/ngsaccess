# Hik raporları — Faz 3 + Faz 4 denetimi (salt-okuma)

Kapılar (kendi koşum): `tsc` temiz · `eslint src/lib/reports src/components/reports` temiz · `vitest` 15 dosya / 93 test yeşil.
`any`, `!`, `filter(Boolean)` bulunmadı. Tüm metin hücreleri `setCell`/`safeCell` ile geçiyor (formül nötrleme tam; `cell.note` formül değil).

**ENGEL 0**

## ÖNEMLİ

1. **Sayfa adı kesilince sonda `'` kalırsa dışa aktarma çöküyor** — [personSheets.ts:18](src/lib/reports/excel/personSheets.ts#L18)
   `uniqueSheetName` apostrofu yalnız temizlenen ADDA kırpıyor; 31 karaktere `slice` sonrası sonda `'` kalabilir.
   Senaryo: 31. karakteri `'` olan uzun ad (ör. "Mehmet Ali Yılmaz-O'Connor Hanımoğlu…") → exceljs `addWorksheet` "first or last character … single quotation mark" fırlatır (doğruladım) → tüm Excel iner/inmez, kullanıcı genel "Rapor dışa aktarılamadı" görür.
   Düzeltme: `shortened` içinde slice sonrası `.replace(/^'+|'+$/g, '')` (boş kalırsa `Kişi N`) uygula; test ekle.

## DÜŞÜK

2. **300+ kişi: çift bildirim** — [personSheets.ts:129](src/lib/reports/excel/personSheets.ts#L129) + [ReportPage.tsx:44](src/components/reports/ReportPage.tsx#L44)
   Builder `notify.info(mesaj)` atıp sonra `PersonSheetsLimitError` fırlatıyor; `runExport` catch'i `notify.error('Rapor dışa aktarılamadı', error)` ile ikinci toast basıyor (başlık "Rapor dışa aktarılamadı", açıklama aynı Türkçe mesaj). Kullanıcıya mesaj ulaşıyor ama iki toast + biri "hata" tonunda.
   Düzeltme: ya `notify.info`'yu kaldır (catch zaten mesajı gösteriyor) ya da catch'te `PersonSheetsLimitError` ise sessiz geç. Dosya inmiyor (writeBuffer'a gitmiyor) — doğru.

3. **"Çalışılan gün" tanımı sayfalar arasında farklı** — [personSheets.ts:41](src/lib/reports/excel/personSheets.ts#L41) vs [personBlocks.ts:11](src/lib/reports/excel/personBlocks.ts#L11)/ekran kolonu
   Kişi sayfası özet satırı `workedDays + holidayWorkedDays` (Hik üst blok gibi), Aylık Özet ve ekran kolonu yalnız `workedDays`. Hafta sonu/tatil çalışan kişide aynı kişi için iki farklı "Çalışılan gün". HT/RT günleri kod olarak N değil, yani çift sayım yok; salt etiket tutarsızlığı.
   Düzeltme: kişi sayfasında etiketi "Çalışılan gün (hafta sonu/tatil dahil)" yap ya da Lejant'a not düş.

4. **Kişi sayfasında dondurma çok satır** — [personSheets.ts:122](src/lib/reports/excel/personSheets.ts#L122)
   `ySplit: headerRow` (≥13 satır: bant 44pt + özet + izin özeti) sabitleniyor (~370pt+). Çok izin türü olan kişide (her tür +28pt) küçük ekranda kaydırılabilir alan kalmayabilir.
   Düzeltme: dondurmayı kaldır ya da yalnız başlık satırını yazdırma tekrarında bırak (`printTitlesRow` zaten var).

5. **Günlük satır toplamı ≠ Toplam satırı (kenar durum)** — [personSheets.ts:82](src/lib/reports/excel/personSheets.ts#L82) vs [personMonth.ts](src/lib/reports/personMonth.ts)
   Günlük "Geç/Erken çıkış" dk sütunu her sayılan günde yazılıyor; Toplam `personMonthTotals` yalnız `workday` + `incomplete` olmayan günleri topluyor. Hafta sonu/tatil ya da `incomplete` günde geç dk varsa sütun toplamı alt toplamdan büyük çıkar. Aylık Durum'da da benzer: N hücresi hafta sonu çalışmada geç ise turuncu ama "Geç (gün)" toplamı saymaz ([statusMatrix.ts:97](src/lib/reports/excel/statusMatrix.ts#L97), `countAttendance` yalnız `workday`). Ekranla uyumlu olan toplam; gün hücresi/sütun daha geniş.
   Düzeltme: gün hücresinde de `classification === 'workday'` şartı (matrix) / günlük dk'yı aynı şartla yaz.

## Doğrulananlar (sorun yok)
- Aylık Durum toplamları `countAttendance` alanlarını birebir kullanıyor; birleştirmeler çakışmıyor (A:C 3–4, Toplam 3, departman satırı tam genişlik); Lejant `A9` = "Turuncu kalın" satırı doğru; `Erken çıkış (gün)` kolonu eklendi, kolon sayısı `TOTALS` ile türetiliyor.
- Kişi sayfası: özet/izin/döküm satırı çakışması yok (özet birleşikleri satır 2–7, izin 9+); Toplam satırı sütun eşlemesi (11–15) başlıklarla uyumlu; "+k çift" 3'ten fazlada son çıkış hücresi; eksik uç `—`; 0 kişi Excel butonu `rows.length === 0` ile kapalı; Lejant adı rezerve, çakışma `(2)`, `history` ve boş ad `Kişi N`.
- `usePdksTableSnapshot`: `alive` bayrağı unmount sonrası setState'i engelliyor; `skip` ile canlı `useQuery` kapalı (`snapshot ? 'skip' : args`); `ReportResults` `key={queryKey}` ile her filtre/`revision` değişiminde remount → yeniden çekiyor; hata render'da fırlatılıp `QuerySectionBoundary` (`resetKey={queryKey}`) yakalıyor. `argsRef` yalnız ilk args'ı tutuyor — remount garantisine bağımlı, bugün güvenli (not: `enabled` true→false→true akışı yok).
