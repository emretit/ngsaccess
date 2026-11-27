# Kişiler smoke testi — yerel Convex (2026-11-27, item #319)

**Sonuç:** 8 akışın 8'i arayüzde geçti. **Yayın engeli var:** Convex typecheck 2 hata veriyor, `convex dev --once` push etmeden duruyor.

Ortam: `/tmp/ngs-smoke` kopyası (yaklaşık 13:00'te alındı), anonim yerel Convex (`127.0.0.1:3210`), vite `8082`.
Canlıya istek yok; `.env.local` içinde `notable-tern` yok. vite ve yerel backend durduruldu.

## YAYIN ENGELİ: Convex typecheck

```
src/components/employees/lib/employment.ts(3,31): error TS2307: Cannot find module '@/types/employee'
src/lib/employees/exportEmployeesXlsx.ts(1,31): error TS2307: Cannot find module '@/types/employee'
```

- Komut: `npx tsc --noEmit -p convex/tsconfig.json`.
- Sebep: `convex/tsconfig.json` içinde `@/` yol tanımı yok. Commit'siz kod Convex'ten `src/` içine import ediyor:
  - [convex/employees.ts:31-32](../../convex/employees.ts) → `employeeList` → `employment.ts:3`
  - [convex/employeeImport.test.ts:10-12](../../convex/employeeImport.test.ts) → `exportEmployeesXlsx.ts:1`
  - `convex/lib/employeeListPage.ts`, `convex/lib/employeeListFields.ts` de `src/` import ediyor.
- HEAD'deki `convex/employees.ts` `src/` import etmiyor; hata commit'siz değişiklikle geliyor.
- Öneri: [employment.ts:3](../../src/components/employees/lib/employment.ts) ve [exportEmployeesXlsx.ts:1](../../src/lib/employees/exportEmployeesXlsx.ts) içinde göreli import (`../../../types/employee`, `../../types/employee`). Denenmedi; bunun altından başka `@/` hatası çıkabilir.
- Testi yürütmek için kopyada `--typecheck=disable` kullanıldı.

## Akışlar

Ekran görüntüleri: `/tmp/ngs-smoke-shots/` (geçici klasör).

| # | Akış | Sonuç | Kanıt |
|---|---|---|---|
| 1 | Liste; sıralama (ad, departman, kart, durum); arama (ad, kart, boş sonuç); durum filtresi; departman, alt departman, şirket filtresi | GEÇTİ | `01a`–`01g` |
| 2 | Ekle: kartlı, kartsız; geçersiz kart → "Kart numarası biçimi geçersiz"; aynı TC → reddedildi; aynı kart → reddedildi | GEÇTİ | `02a`–`02f` |
| 3 | Düzenle: soyad, kartsıza kart, kart değişimi, erişim bitişi (30.11.2026 kalıcı) | GEÇTİ (not 1) | `03a`–`03f` |
| 4 | Toplu departman (Ali, Deniz → Ikinci Sirket / Depo); şirket de güncellendi (F03) | GEÇTİ | `04a`–`04c` |
| 5 | Şablon indir; 'Aktif: Hayır' + kartsız satır içe aktar; pasif (F01) ve kartsız (F07); 3/3 oluşturuldu | GEÇTİ | `05a`–`05d` |
| 6 | Ayrıntı paneli açılıyor; cihaz teslim kartı boş durum mesajı; yüz kartı kart eklenince panel kapanmadan güncellendi (F10) | GEÇTİ | `06a`–`06d` |
| 7 | Pasifleştirme; silme (onay → 10'dan 9 kişiye) | GEÇTİ | `07a`–`07d` |
| 8 | 390px (iframe): liste ve ayrıntı, yatay taşma yok | GEÇTİ | `08a`–`08d` |
| — | Cihaz (Hik/IDE) senkronu, yüz/parmak izi kaydı | KAPSAM DIŞI | — |

Test edilmeyenler: toplu silme, toplu kart atama, dışa aktar, "İşten çıkar", sayfalama (2. sayfa).

## Notlar (akışı düşürmedi)

1. `employees:update` bir kez `Function execution timed out (maximum duration: 1s)` verdi; kullanıcı bu ham İngilizce metni formda gördü. Tekrar denemede 2/2 geçti, biri 906 ms uyarısı verdi. Makine yükü o sırada ~40'tı ve cron'lar da zaman aşımına düştü; büyük olasılıkla yük kaynaklı. 7 kişilik veride 906 ms olduğu için canlıda süreye bakmak yararlı.
2. Departman ve durum sıralamasında eşit değerler ada göre değil kayıt kimliğine göre diziliyor ([employeeList.ts:65](../../src/components/employees/lib/employeeList.ts)). Commit'siz değişiklikten önce de böyleydi.
3. Yaklaşık 820px genişlikte boş arama mesajı tablonun yatay kaydırma alanında ortalanıyor, sağdan kesiliyor (`01d-ara-yok-boyle`).
4. Kayıt sonrası ekranda "Parmak izi işlemleri kişinin ayrıntılarında." yazısı panelin alt kenarında dışarı taşıyor ([EmployeeForm.tsx:314](../../src/components/employees/EmployeeForm.tsx), `02b-kartli`).
5. Excel içe aktarma `AYSE-001` kartını (şablonun örnek değeri) kabul etti; formda `ABC-12!` reddedildi. `AYSE-001` formda ayrıca denenmedi.
6. Kişiler dışı: `/admin-setup` iki denemede de `users:initializeAdmin` → "Giriş yapmanız gerekiyor" verdi ([AdminSetup.tsx:50-56](../../src/pages/AdminSetup.tsx)). Olası sebep: `signIn` sonrası oturum hazır olmadan mutation çağrılıyor (doğrulanmadı). Dosya commit'siz değişmemiş. Hesap, kopyadaki geçici `convex/zzSmokeSeed.ts` ile yetkilendirildi.

## Konsol

- `Warning: Missing Description or aria-describedby for DialogContent` — kişi paneli her açılışta.
- Beklenen sunucu hataları: aynı TC ve aynı kart reddi (`employees:create`).
- `employees:update` zaman aşımı (not 1) ve `users:initializeAdmin` (not 6).
- Başka hata yok.
