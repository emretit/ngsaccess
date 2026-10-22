# Parmak izi — düzeltme turu 1 (denetim: /tmp/fp-denetim.md)

Önce `/tmp/fp-denetim.md` ve `.claude/orca-specs/fp-enroll.md` oku. Kurallar fp-enroll.md ile aynı; ownership AYNI dosyalar + `convex/employeeImport.ts` (yalnız kart patch kancası) + `convex/lib/employeeCardChange.ts` (gerekirse). Şablon HİÇBİR yere yazılmaz.
YASAK (aynen): commit, push, deploy, `npx convex dev/deploy/codegen/run`, DB yazma, git stash/checkout/reset, mobile/**.

## Düzelt
- **P1-1/P1-2 (KVKK silme garantisi):** `removeAllForEmployee` yalnız metadata siliyor. Yeni davranış: kart değişimi / pasifleşme / işten çıkış / kişi silme anında mutation içinde kişinin enrollment satırlarını OKU (take 100) ve {deviceId, fingerNo, ESKİ cardNumber(employeeNo)} anlık görüntüsüyle internal action zamanla (`ctx.scheduler.runAfter(0, internal.actions.hikFingerprint.purgeFingerprintsOnDevices, …)`); action her satır için `deleteFingerprintFromDevice(devIndex, eskiKart, fingerNo)` çağırsın ("bulunamadı/yok" yanıtı = başarı), başarılı olanın metadata satırını silsin, başarısızı SİLMESİN (satır kalır, audit "Parmak izi silme: başarısız") ki yönetici görsün; şablon verisi yok. Metadata'yı mutation'da hemen silme (başarısızsa kayıp olur). Pasif/silmede `deviceRules` boş olsa bile bu action çalışır (hikvisionSync'e bağımlı olma). Pasifleşen kişi için listForEmployee/UI zaten kapalı; kalan satırlar action'la temizlenir.
- **P1-3:** `employeeImport.ts:120-121` kart patch'ine aynı kanca (tek ortak yardımcı: `scheduleEmployeeCardChange` ya da yeni küçük yardımcı; employees.update ile import aynı yolu kullansın).
- **P2-4:** `removeFingerprintFromDevice`: cihazda zaten yok (employeeNo/fingerprint yok subStatus) = başarı say, metadata silinsin.
- **P2-6:** `fingerprintEnrollment.ts` tüm query/mutation'lara `returns` validator ekle (guidelines.md). Dönen tipler değişmesin.
- **P2-7:** `pendingUntil` 120 sn → 180 sn (capture 35 sn + polling payı), ilgili testi güncelle.
- **P2-5:** upsert karşılaştırmasında `.trim()` tutarlılığı (cardNumber hem karşılaştırma hem employeeNo için aynı normalize).
- **P3-9:** `EmployeeFingerprintCard.tsx:87` aria-label fallback; P3-10 "Cihazda parmağınızı okutun" metni `begin` başarılı olunca göster; P3-11 satır 64 uyarıya nokta.
- Her düzeltme için test (purge action: başarı/başarısız/yok-sayılır; import kancası; returns).

## Kapılar (kendin koş, sayıyla raporla)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` · `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` · `node_modules/.bin/eslint src convex` · `node_modules/.bin/vitest run` (başlangıç 2487) · `npm run build` · `grep -rn fingerData convex src` (yeni satırda kayıt/log yok).
Rapor: `worker_done` ≤10 satır, file:line, kapı sayıları. Soru: yalnız tasarımı bozacaksa ask.
