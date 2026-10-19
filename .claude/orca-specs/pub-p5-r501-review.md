# Görev: R5-01 düzeltmesinin güvenlik denetimi (SALT OKUMA)

## Hedef
`git diff -- convex/invites.ts convex/invites.test.ts convex/actions/sendEmail.ts` (Codex yazdı, koordinatör sendEmail.ts'e 1 log satırı ekledi) R5-01'i kapatıyor mu,
yeni açık/regresyon var mı — kanıtla raporla. Kod DEĞİŞTİRME.

## R5-01 (önceki denetim `/tmp/pub-p5/REVIEW.md`)
`invites.create` public authedMutation token'ı çağırana dönüyordu → project_admin başkasının e-postasına davet açıp token'ı alır, o adresle signUp + consume →
`verifyUser` adresi "doğrulanmış" işaretler (squat). Düzeltme: `create` internalMutation + `callerId`; token yalnız `sendUserInviteEmail` action'ında e-postaya yazılır.
Worker raporu: `/tmp/pub-p5/fix-r501.md`. Spec: `.claude/orca-specs/pub-p5-r501.md`.

## Kontrol et
1. Token'a istemciden ulaşan başka yol kaldı mı: tüm `convex/**` public query/mutation/action dönüşleri, hata metinleri, `invites.list` (superAdmin; dönüş validator'ı ham doc ile uyumlu mu?), `verify`, http.ts route'ları, scheduler/log.
2. `create` caller doğrulaması `authedMutation`/`getCurrentUser` (`convex/lib/auth.ts:9-28`) ile eşdeğer mi; `callerId`'yi saldırgan kontrol edebilir mi (yalnız internal → action'da `ctx.user._id`).
   `authedAction` (`convex/lib/customFunctions.ts:104`) `api.users.currentUser` kullanıyor — verified=false caller action'a girip internal create'e ulaşabilir mi? (create'in kendi kontrolü yakalıyor mu?)
3. Yetki mantığı birebir korunmuş mu (super_admin / owner / üye project_admin); rate-limit anahtarı; eski davet iptali.
4. Testler gerçek kayıtlı handler'ı mı çalıştırıyor, sahte olan yalnız DB/limiter mı; (a)-(h) senaryoları anlamlı mı.
5. `sendResendEmail` artık her mailde sabit hata döner + `console.error` → başka çağıranlarda (MailSettings test maili, employee setup) kullanıcıya etki; kabul edilebilir mi.
6. Deploy/uyumluluk: web `sendUserInviteEmail` imzası aynı mı; eski web ↔ yeni backend kırılır mı. R5-05'in bu düzeltmeyle kapandığı iddiası doğru mu.

## Kapılar (kendin koş, sonuçları yaz)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` · `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` · `node_modules/.bin/eslint convex/invites.ts convex/invites.test.ts convex/actions/sendEmail.ts` ·
`node_modules/.bin/vitest run convex/invites.test.ts`. Ağaçta başka oturumların değişiklikleri var (convex/cardReadings.ts, convex/lib/pdks*, reportAttendance*) — kapsam dışı; kırmızı varsa ayır.

## YASAK
Dosya düzenleme (rapor dosyası hariç) · `npx convex …` · commit/push · canlı DB/Convex okuma-yazma · arka planda sunucu.

## Rapor
`/tmp/pub-p5/REVIEW-r501.md`: ilk satır `**commit'e engel: var|yok**`, kapı sonuçları, bulgular `ID | Ciddiyet | file:line | sorun | senaryo | öneri`. `worker_done` ≤10 satır.
