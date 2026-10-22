# Parmak izi kaydı denetimi (SALT-OKUMA)

Sen denetçisin; kodu Codex yazdı. Hiçbir repo dosyasına YAZMA (yalnız rapor: `/tmp/fp-denetim.md`). YASAK: commit, push, deploy, `npx convex *`, DB yazma, git stash/checkout/reset, mobile/**.

## Girdi
- Spec: `.claude/orca-specs/fp-enroll.md` + `.claude/handoff-fingerprint.md` (kararlar: Hik gateway, şablon YALNIZ cihazda, PDKS'e sayılmaz, KVKK 2026/921). CEO kararları: capability snapshot YOKSA engelleme / VARSA ve desteklemiyorsa reddet; kart değişiminde davranış değişmez, enrollment metadata temizlenir + UI uyarısı.
- Değişiklik: `git -C /Users/emreaydin/ngsaccess diff -- convex src` + yeni dosyalar (`git status --porcelain -- convex src`; `??` olanlar): `convex/actions/hikFingerprint.ts`, `convex/fingerprintEnrollment.ts`, `src/components/employees/EmployeeFingerprintCard.tsx`, testleri.

## Bak (öncelik sırası)
1. **Şablon sızıntısı:** fingerData/base64 DB, `console.*`, audit summary, ConvexError mesajı, test snapshot'ı, action dönüşü, Convex action argüman/dönüş loglarına giriyor mu. `convex/lib/gateway/core.ts` log maskesi (`/fingerprint/i`) `captureFingerprintLive`/`addFingerprintToDevice`/`deleteFingerprintFromDevice` gerçek path'lerini (`convex/lib/gateway/biometrics.ts`) kapsıyor mu (path büyük/küçük harf, "FingerPrint" vs "Fingerprint" vb.); `gatewayMultipartCall` ve digestFetch hata yollarında ham gövde loglanıyor mu.
2. **Yetki:** `isManager` + proje + modül (`assertBiometricAllowed`) + rıza (iptal edilmemiş `employeeConsents.biometric_fingerprint`) hem action'da hem `beginEnrollment`/`upsert`'te; super_admin/project_admin dışı roller; `getTargetInternal` userId'yi action'dan alıyor — sahtelenebilir mi (internal olduğu için istemci çağıramaz mı?); `cancelEnrollment`/`listForEmployee` proje kontrolü; silme yolu rıza geri çekilince/modül kapalıyken çalışıyor (bilinçli).
3. **Cihaz kapsamı:** yalnız kişinin aktif erişim grubundaki Hik gateway cihazları; farklı proje cihazı reddi; `employeeNo = cardNumber` — cardNumber boş/başka kişiyle çakışırsa yanlış kişiye parmak yazılır mı.
4. **Temizlik kancaları:** `employeeTermination.ts closeAccess`, `employees.ts update` (pasif + KART DEĞİŞİMİ) ve remove. Kart değişince cihazdaki ESKİ employeeNo altındaki parmak izi cihazda yetim kalıyor mu (metadata silinir ama cihaz kaydı silinmez) — KVKK açısından silme garantisi; pasif/işten çıkışta Hik kullanıcı silme (`hikvisionSync.ts ~126`) parmak izini gerçekten götürüyor mu. Hook `throw`'lardan ÖNCE mi sonra mı (mutation atomik, ama sıra/yan etki). `removeAllForEmployee` 100'lük döngü.
5. **Zaman aşımı/iptal/yarış:** `beginEnrollment` pendingUntil 120 sn vs capture süresi; iki yönetici aynı cihazda eşzamanlı; `finishAttempt`/`clearEnrolled` mantığı; `downloaded=true` sonrası hata → cihaz temizliği; `.unique()` birden çok satırda atar mı; tablo satırı `enrolledAt:""` ile listede gizleniyor mu.
6. **UI (`EmployeeFingerprintCard.tsx`):** yalnız yönetici + modül açık; rıza yoksa buton kapalı + `aria-describedby` sebep; snapshot yoksa bilgi uyarısı (buton kapanmaz); kart değişimi uyarısı; Sil için ConfirmDestructive; sabit KVKK notu "Parmak izi yalnız bu cihazda saklanır; sisteme kaydedilmez. Puantajda kullanılmaz."; `any`/`!` yok.
7. **Convex kuralları:** `returns` validator eksikleri (guidelines.md), sınırsız `.collect()`, `api.d.ts` elle satırları, `schema.ts` eklemeli mi (geri uyum).

## Kapılar (kendin koş, sayıyla yaz)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` · `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` · `node_modules/.bin/eslint src convex` · `node_modules/.bin/vitest run`

## Rapor
`/tmp/fp-denetim.md`: P1 (yanlış davranış/güvenlik/KVKK) / P2 (kenar durum) / P3 (stil) — file:line + somut senaryo + öneri. `worker_done` ≤10 satır: P1/P2/P3 sayıları, en kritik 3, kapı sayıları. Kanıtsız bulgu yazma; her bulguyu kodu okuyarak doğrula.
