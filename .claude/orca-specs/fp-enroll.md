# Parmak izi kaydı — Hik gateway, şablon YALNIZ CİHAZDA (doğrulama + backend + UI)

Tasarım ve kararlar: `/Users/emreaydin/ngsaccess/.claude/handoff-fingerprint.md` — ÖNCE BAŞTAN SONA OKU (checklist 0-2 bu işin kapsamı). Ayrıca `convex/_generated/ai/guidelines.md`.

## Ortak kurallar (CLAUDE.md'yi okumadığın için buraya gömüldü)
- TypeScript strict; `any`/`as any` YASAK; `unknown` + narrowing; `!` yerine erken return. Convex alan adları camelCase olduğu gibi. Sınırsız `.collect()` yok.
- UI metinleri Türkçe, cümle düzeni; mevcut bileşen desenleri (`src/components/employees/**`, `src/components/ui/**`, `ConfirmDestructive`, `useAsyncAction`).
- **Şablon (fingerData/base64) HİÇBİR YERE yazılmaz:** DB, log (`console.*`), audit, hata mesajı, test snapshot'ı. Yalnız action belleğinde capture → download arası.
- YASAK: commit, push, deploy, `npx convex dev/deploy/codegen/run`, DB yazma, git stash/checkout/reset, `mobile/**`. İzinli tek canlı okuma: `npx convex data devices --limit 100` (cihaz modeli/capability için; çıktıyı rapora özetle, sır alanlarını yazma).

## Adım 0 — Doğrula (kod + salt-okuma) ve DUR koşulları
handoff-fingerprint.md §0'daki 5 maddeyi doğrula. Şunlardan biri doğruysa kod yazmadan `ask` ile sor:
- Hiçbir Hik gateway cihazında `captureFingerprint` desteği yok ya da snapshot boş (o zaman "Özellikleri tara" gerektiğini yaz).
- Kişi sync'i kart değişiminde kullanıcıyı silip yeniden yaratıyor (parmak izi kaybolur) — çözüm önerini de yaz.
- Parmak izi doğrulama olayları PDKS'e sayılıyor.

## Adım 1 — Backend
- `convex/schema.ts` (yalnız YENİ tablo, eklemeli): `deviceFingerprintEnrollments` { employeeId, deviceId, projectId (optional id), fingerNo (number 1-10), enrolledAt (ISO), enrolledBy (id users) } + index `by_employee`, `by_device`, `by_employee_device_finger` [employeeId, deviceId, fingerNo].
- YENİ `convex/actions/hikFingerprint.ts`: `enrollFingerprintOnDevice({ employeeId, deviceId, fingerNo })` ve `removeFingerprintFromDevice({ enrollmentId })` — `authedAction` + `isManager(ctx.user)` + proje erişimi (`canAccessEmployeeProject`) + `assertBiometricDeviceAllowed` + rıza (handoff §0'da bulduğun kaynak) + cihaz Hik gateway + kişi bu cihazın erişim kapsamında + capability. Akış: `captureFingerprintLive` (`convex/lib/gateway/biometrics.ts:95`) → bellekteki şablonla aynı cihaza `FingerPrintDownload` (`biometrics.ts:158`, employeeNo + fingerNo) → enrollment kaydını internal mutation ile yaz (varsa güncelle). Silme: cihazdan FP silme ISAPI (biometrics.ts'te yoksa ekle) → kaydı sil. Audit: `internal.deviceEvents.recordOperationInternal` ("Parmak izi kaydı: komut iletildi | başarısız" / "Parmak izi silme: …"), summary'de veri yok. Zaman aşımı/iptal → anlaşılır Türkçe hata.
- YENİ `convex/fingerprintEnrollment.ts`: `listForEmployee` (adminQuery, proje kontrolü, cihaz adıyla) + internal upsert/delete + `removeAllForEmployee` (internal).
- Temizlik: kişi pasifleşince/işten çıkınca/silinince enrollment kayıtları silinsin (cihazdaki FP zaten kullanıcı silinince gider — doğrula). Kancalar: `convex/employeeTermination.ts` `closeAccess`, `convex/employees.ts` update (isActive true→false) ve remove — her birinde tek satırlık `ctx.scheduler.runAfter(0, internal.fingerprintEnrollment.removeAllForEmployee, …)` ya da doğrudan çağrı.
- `convex/_generated/api.d.ts`: yeni 2 modül satırı ELLE (mevcut desen).

## Adım 2 — UI
- YENİ `src/components/employees/EmployeeFingerprintCard.tsx` (+ test): yalnız yönetici + modül açıksa görünür; rıza yoksa buton kapalı + sebep (aria-describedby). Cihaz seçici (kişinin Hik gateway + capability destekli cihazları) + parmak seçici (Sağ/Sol × başparmak…serçe = 1-10) → "Kaydı başlat" (onay: "Cihazda parmağınızı okutun; ~30 sn") → durum. Kayıtlı liste: "Sağ işaret · Cihaz X · 22.10.2026" + "Sil" (ConfirmDestructive). Sabit not: "Parmak izi yalnız bu cihazda saklanır; sisteme kaydedilmez. Puantajda kullanılmaz."
- `src/components/employees/EmployeeDetails.tsx`: kartı yerleştir (tek satır + import).

## Ownership (yalnız bunlar)
convex/schema.ts (yeni tablo) · convex/actions/hikFingerprint.ts · convex/fingerprintEnrollment.ts · convex/lib/gateway/biometrics.ts (yalnız FP silme yardımcısı gerekiyorsa) · convex/employeeTermination.ts (closeAccess tek kanca) · convex/employees.ts (update/remove tek kanca) · convex/_generated/api.d.ts (2 satır) · src/components/employees/EmployeeFingerprintCard.tsx · src/components/employees/EmployeeDetails.tsx · bu dosyaların testleri (yeni test dosyası açabilirsin)

## Kapsam dışı
Şablonu saklama/cihazlar arası kopyalama · Windows köprüsü / IDE · yüz · mevcut `syncEmployeeFingerprintToDevicesInternal` (dokunma) · mobile/**.

## Kapılar (kendin koş, sayıyla raporla)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0 · `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` → 0 · `node_modules/.bin/eslint src convex` → 0 error · `node_modules/.bin/vitest run` → tamamı yeşil (başlangıç 2450) · `npm run build` → OK. Ek kontrol: `grep -rn "fingerData" convex src` çıktısında yeni dosyalarda şablonun kaydedildiği/loglandığı satır OLMAMALI.

## Rapor
`worker_done` ≤10 satır: Adım 0 bulguları (cihaz modeli, capability, kart değişimi davranışı, PDKS filtresi, rıza kaynağı) · yeni/değişen dosyalar · kapı sayıları · bilinçli kararlar (file:line).
