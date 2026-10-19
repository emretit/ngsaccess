# UI Audit 2 — özet (2026-10-19)

13 sidebar sayfası A2 yeni arayüzü canlıdayken tek tek tarandı (Orca, Sonnet 5.5 worker, salt-okuma).
Her sayfanın raporu `NN-slug.md`, ekran görüntüleri `NN-slug/`; her raporun sonunda **Kararlar (Emre)** bölümü var.
Spec şablonu: `.claude/orca-specs/ui-audit-2-template.md`.

## Durum
- [x] 13/13 sayfa tarandı · 8 yüksek · 77 orta · 97 düşük
- [x] 05-H1 hemen düzeltildi (`CreateRuleDialog.tsx` ayrı `key`), tarayıcıda doğrulandı — commit `f8e901a` (başka oturum commit etti)
- [ ] Toplu düzeltme (aşağıdaki dalgalar)

| # | Sayfa | Y | O | D |
|---|---|---|---|---|
| 01 | Ana Sayfa + kabuk | 0 | 4 | 7 |
| 02 | Kişiler | 0 | 8 | 9 |
| 03 | Cihazlar | 0 | 9 | 11 |
| 04 | Sanal Okuyucular | 0 | 2 | 3 |
| 05 | Geçiş Kontrol | 1 | 6 | 6 |
| 06 | Ziyaretçiler | 1 | 7 | 7 |
| 07 | Canlı İzleme | 0 | 4 | 7 |
| 08 | PDKS Kayıtları | 2 | 7 | 11 |
| 09 | Vardiyalar | 0 | 7 | 10 |
| 10 | İzinler | 1 | 6 | 5 |
| 11 | Raporlar | 2 | 7 | 6 |
| 12 | Denetim Kaydı | 0 | 3 | 5 |
| 13 | Ayarlar | 1 | 7 | 10 |

## Yüksek bulgular
- 05-H1 kural sihirbazı düzenlemede erken kaydediyordu — **düzeltildi**
- 06-H1 / 10-H1 filtre yalnız o sayfadaki kayıtlara uygulanıyor
- 08-H1 / 11-H1 veri yokken sahte "Devamsız" (`availableDateKeys` hiç verilmiyor)
- 08-H2 gece yarısını geçen vardiya PDKS'de temsil edilemiyor
- 11-H2 günlük raporda fazla mesai > toplam süre; aylık raporla çelişiyor (kök neden bulunmadı)
- 13-H1 gece çarpanı kaydediliyor ama hesapta kullanılmıyor

## Sayfalar arası tekrar eden sorunlar
1. Sahte 0 / "Devamsız": 01-O1, 08-H1, 08-O1, 11-H1
2. Sayfa içi filtre: 05-D1, 06-H1, 10-H1, 11-O1
3. "Vazgeç" iki zıt anlamda (ortak `UnsavedChangesDialog`): 05-O6, 09-O5, 10-O3, 13-O2
4. Tarih biçimi / saat dilimi (`Europe/Istanbul` yok, ISO tarih): 02-D1, 03-O8, 08-O2, 09-O3, 13-O7
5. Ham teknik metin (SDK hatası, marka/tablo anahtarı): 02-O3, 05-O2, 12-O1
6. Gece vardiyası + gece çarpanı: 08-H2, 09-O4, 13-H1
7. Bayat durum ("Canlı" noktası, 4 ay önceki senkron onayı): 01-O2, 03-O7, 05-D5, 06-D2
8. Ağır / reaktif sorgular: 01-O3, 06-O1, 08-O5, 09-O6, 09-O7, 10-O5
9. Küçük dokunma hedefi / 16px checkbox: 01-D5, 02-O4, 03-D8, 05-D3, 05-D4

## Toplu düzeltme önerisi (dalgalar)
- **A — ortak bileşen + hızlı düzeltmeler (~1 gün):** madde 3, 4, 5, 7, 9; sayfa raporlarındaki "Hızlı düzeltmeler"; ölü kod (05-D6).
- **B — veri doğruluğu (~1–2 gün):** 08-H1/11-H1 "Veri yok" + "Henüz gelmedi" + işe başlama öncesi "—"; 11-H2; 08-O3 belirsiz Hik olayları PDKS dışı; 08-O4 CSV içe aktarma kapsamı.
- **C — sunucu filtreleri (~1–2 gün):** 06-H1, 05-D1, 10-H1, 11-O1 + 06-O2 sayaç kırılımı.
- **D — gece vardiyası (~1–2 gün):** atanmış vardiyaya göre eşleme (08-H2), 09-O4, gece çarpanı (13-H1).
- **E — performans:** 01-O3, 06-O1, 09-O6/O7, 10-O5.

## Bilinen sınırlar
- Orca mobil emülasyonunda ekran görüntüsü dikeyde 3 kez tekrarlanıyor; mobil bulgular çoğunlukla DOM ölçümüyle doğrulandı.
- Aktif proje "emre"de ziyaretçi, izin ve vardiya kaydı yok; bu sayfaların dolu hali yalnız koddan incelendi ("doğrulanmadı" etiketli).
