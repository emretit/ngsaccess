# P5-düşük / W-emp — çalışan şifre kurulumu atomik + giriş hatası enumeration (X1-F3 + X1-F5)

HEDEF (test edilebilir): (1) Aynı setupToken ile `setEmployeePassword` yalnız BİR kez başarılı olur; token okuma ile tüketme tek mutation'da atomik. (2) `employeeAuth.signIn` tüm başarısız durumlarda AYNI hata metnini ve benzer süreyi verir (çalışan var mı ayırt edilemez).

## Bağlam
- `convex/actions/setPassword.ts` `setEmployeePassword` (public action, "use node"): `internal.employeeAuth.getByTokenInternal` ile token'ı okuyor → bcrypt hash → `internal.employeeAuth.update({authId,...})` ile yazıyor. Okuma/yazma ayrı → iki eşzamanlı çağrı aynı token'la ikisi de başarılı olur; yazarken token'ın hâlâ geçerli olduğu kontrol edilmiyor.
- `convex/employeeAuth.ts` `signIn` (public mutation): çalışan yok/pasif → "E-posta veya şifre hatalı"; çalışan var ama `passwordHash` yok → "Mobil şifreniz henüz kurulmamış..." (enumeration). Ayrıca çalışan yokken bcrypt koşmadığı için süre farkı var.

## Yapılacak
1. `convex/employeeAuth.ts`'e `internalMutation` `consumeSetupToken({ token, passwordHash })` ekle: `by_token` ile kaydı bul; yoksa `{ status: "invalid" }`; `tokenExpiresAt` geçmişse `{ status: "expired" }`; değilse AYNI mutation içinde `passwordHash` yaz + `setupToken`/`tokenExpiresAt` temizle + `updatedAt`; `{ status: "ok" }`. `returns` validator zorunlu.
2. `setEmployeePassword`: uzunluk kontrolü aynı kalsın; hash'i action'da hesapla, sonra `consumeSetupToken` çağır; sonucu MEVCUT dönüş şekline eşle (`{ success: true }` / `{ success: false, error: "Geçersiz veya süresi dolmuş token" | "Token süresi dolmuş" }`). İstersen hash'ten önce `getByTokenInternal` ile hızlı ön kontrol kalabilir ama nihai karar `consumeSetupToken`'da. `employeeAuth.update` başka yerlerde kullanılıyorsa silme.
3. `signIn`: tüm başarısız yollar (çalışan yok, pasif, auth kaydı yok, passwordHash yok, şifre yanlış) aynı `Error("E-posta veya şifre hatalı")`. Çalışan/auth/hash yoksa sabit bir dummy bcrypt hash'e karşı `verifyEmployeePassword` koş (süre eşitleme). Dummy hash modül sabiti (gerçek bcrypt cost-10 hash'i; sır değil, rastgele dizgenin hash'i).
4. `convex/actions/sendEmail.ts`'te çalışan kurulum maili token/link mantığına dokunman GEREKMİYOR; yalnız X1-F3 için zorunluysa dokun.

## Ownership (yalnız bunlar)
convex/employeeAuth.ts, convex/actions/setPassword.ts, convex/actions/sendEmail.ts (gerekirse), convex/employeeAuth.test.ts, yeni test dosyası gerekiyorsa convex/actions/setPassword.test.ts.

## Kapsam dışı / DOKUNMA
mobile/** (l10n'deki "kurulmamış" metni kullanılmaz kalır, sorun değil), convex/schema.ts, convex/cardReadings.ts, convex/lib/pdks*, convex/dashboard.ts, src/components/dashboard/**, diğer worker'ların dosyaları (convex/auth.ts, convex/invites.ts, convex/projects.ts, convex/ideSync.ts, convex/hikvisionSync.ts, src/components/auth/**). Ağaçta başka oturumların commit'siz işi var; onlara dokunma, revert etme.

## Testler (zorunlu)
- consumeSetupToken: ok → token temizlenir + hash yazılır; aynı token ikinci çağrı → invalid; süresi geçmiş → expired, hash yazılmaz.
- signIn: çalışan yok / passwordHash yok / yanlış şifre → üçü de aynı mesaj.
Mevcut test kalıbını (convex/employeeAuth.test.ts) izle.

## Kapılar (kendin koş, çıktıyı rapora yaz)
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` ve `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` → 0 (başka oturumun dosyasından gelen hata varsa ayrı listele, düzeltme)
- `node_modules/.bin/eslint <ownership dosyaları>` → 0 error
- `node_modules/.bin/vitest run convex/employeeAuth.test.ts <yeni test>` → yeşil

## Yasak
commit / push / deploy / `convex dev` / `convex deploy` / `convex run` / migration / canlı DB yazma YOK. `any` yasak (unknown + narrowing).

## Rapor
`/tmp/pub-p5/fix-low-emp.md` (≤25 satır, file:line) + worker_done'da ≤10 satır, `--files-modified` gerçek liste.
