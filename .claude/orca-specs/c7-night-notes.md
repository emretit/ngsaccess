# C7 — Gece vardiyası kenar durumları (R3B-N1, N2, N3, N5)

Kaynak: `docs/ui-audit-2/review-wave3b.md` satır 25-29 (R3B-N1..N5). N4/N7 aksiyonsuz, N6 Emre kararı (DOKUNMA: gün türü vardiya başlangıcına göre kalır).

## Hedef
1. N1: Elle PDKS'te giriş = çıkış (ör. 08:00/08:00) yalnız başlangıç = bitiş olan vardiyada kabul edilir; 22→06 gibi gece vardiyasında ve vardiyasız kişide ConvexError (Türkçe). `convex/lib/pdksManual.ts:20` doğrulaması + `convex/lib/pdksWorkDay.ts:84-89` `manualPdksTimes`. Mevcut "eşit başlangıç/bitiş vardiya" testi korunur.
2. N2: `convex/lib/pdksAvailability.ts:14-19` ilk kayıt adayı `accessStatus === "izin_verildi"` olanı tercih eder; reddedilen deneme işe başlama tarihi olmaz (izinli yoksa mevcut davranış). Şema değişikliği YOK.
3. N3: Yalnız `unknown` kaynaklı okuması olduğu için devamsız görünen kişide PDKS tablosu satırında/detay çekmecesinde "N okuma PDKS dışı bırakıldı" göstergesi (`convex/lib/pdksSource.ts:73-76`; sunucu cevabına sayı ekle, UI'da göster). Mevcut sınıflandırma (güvenli taraf) değişmez.
4. N5: `src/components/settings/sections/components/OvertimeSettingsForm.tsx:52,89` gece çarpanı seçicisi yerel `<select>` yerine projedeki `@/components/ui/select`; metin/seçenekler aynı. `"nightCombineMode" in rates` kontrolünü tip doğruysa kaldır.

## Ownership
convex/lib/pdksManual.ts · convex/lib/pdksWorkDay.ts · convex/lib/pdksAvailability.ts · convex/lib/pdksSource.ts · bunların testleri (convex/lib/*.test.ts) · src/components/settings/sections/components/OvertimeSettingsForm.tsx · src/components/pdks/** (N3 göstergesi için gereken en az dosya) · N3 için sunucu cevabını üreten dosya convex/cardReadings.ts DEĞİL — o dosya başka ekibin; sayıyı convex/lib/* içinde hesaplayıp mevcut dönüş tipine ekleyemiyorsan DUR ve coordinator'a sor.

## Kapsam dışı
convex/cardReadings.ts, convex/schema.ts, convex/employees.ts, N6 gün türü, bordro/mesai hesabı, mobile/**.

## Kabul testleri
N1: gece vardiyası + 08:00/08:00 → ret; eşit start/end vardiya → kabul; vardiyasız → ret. N2: [reddedildi 1 Eki, izin_verildi 3 Eki] → 3 Eki. N3: göstergenin sayısı testte. N5: render testi seçenek metinleri.

Ortak kurallar: `.claude/orca-specs/e1-common.md` (oku, uy). Rapor dosyası: /tmp/c7-w4.md
