# FAZ 2-C — Kart kimliği tekilliği (K-04) + ziyaretçi kart iadesi yarışı (A6-6) + ziyaretçi IDE silme durumu (A6-7)

ÖNCE `/Users/emreaydin/ngsaccess/.claude/orca-specs/fix-ortak.md` OKU. Rapor: `/tmp/fix-f2-c-kart-rapor.md`.
Kaynak: `docs/sistem-audit-2026-10-25/DOGRULAMA.md` (K-04), `M2-cihaz.md` §5 (A6-6, A6-7), `ILISKILER.md` §5 (A4/2 ziyaretçi kart değişimi KISMEN).

## Ownership
`convex/employees.ts` (yalnız kart tekillik kontrolü), `convex/employeeImport.ts`, `convex/visitors.ts`, yeni `convex/lib/cardIdentity.ts` (+ test), yeni `convex/fixF2Cards.test.ts`.
DOKUNMA: `convex/actions/ideGatewayDevice.ts`, `convex/ideSync.ts` (Faz 2-A), `convex/hikvisionSync.ts` (Faz 2-B), `convex/lib/processCardReadingCore.ts`, `convex/schema.ts`.
Mevcut yardımcıları (ör. `lib/employeeCardChange.ts`, `lib/peopleHikSnapshot.ts`) yalnız ÇAĞIR; değiştirmen gerekirse `ask`.

## Değişiklikler
1. **K-04** — `lib/cardIdentity.ts`: `cardNumericKey(card)` (yalnız rakamsa baştaki sıfırları atılmış sayısal anahtar; IDE'nin `Number(card)` davranışıyla aynı sonuç).
   Kart tekillik kontrolü (employees create/update, import, toplu kart atama, ziyaretçi kart atama/aktivasyon) mevcut tam-metin kontrolüne ek olarak sayısal çakışmayı da arasın:
   şema değişikliği YOK — mevcut kart index'iyle kanonik değer + baştaki sıfırlı varyantları (toplam uzunluk ≤ 20) sorgula. Çakışmada Türkçe hata:
   "Bu kart numarası (baştaki sıfırlar hariç) başka bir kayıtta kullanılıyor."
2. **A6-6** — Ziyaretçi çıkışı (`checkOut`) ve kart iadesi (`releaseCard`): kart numarası değişmeden ÖNCE eski kart + cihaz hedefleri snapshot'ı alınıp silme işi bu snapshot'la
   planlansın (çalışan kart değişiminde `employeeCardChange.ts`'in yaptığı gibi). Action gecikse de eski kimlik cihazdan silinebilsin.
3. **A6-7** — Ziyaretçi için IDE silme çağrıları (`visitors.ts` ~513, ~572) `employeeId` geçsin (fonksiyon zaten opsiyonel kabul ediyor) → Yetki Durumu satırı güncellensin.

## Kabul
- Testler: `00123` varken `123` atanamaz (create/update/import/ziyaretçi); farklı sayılar serbest; harfli kartlar eski davranış; checkOut→hemen releaseCard sonrası silme işi eski kartı taşır;
  ziyaretçi IDE silme işi employeeId taşır.
- `convex/employees*.test.ts`, `convex/employeeImport.test.ts`, `convex/mobileVisitors.test.ts`, `convex/hikRevocation.test.ts`, `convex/fixF0People.test.ts` yeşil.
