# Güvenlik denetimi — işten ayrılan mobil giriş yapamasın (EMPLOYMENT_ENDED; Claude yazdı)

Rol: SALT-OKUMA denetçi. Rapor dışında dosya yazma. commit/push/deploy/DB/`npx convex` YOK. Çalışma dizini /Users/emreaydin/ngsaccess (main, worktree YOK). Başka oturumların commit'siz dosyalarını denetleme.
Eski hâl `git show HEAD:<dosya>`, yeni hâl `git diff HEAD -- <dosya>`.

Emre kararı: son çalışma günü (TR, dahil) geçmiş ya da isActive=false çalışan mobile login olamasın; açık oturumu varsa sonraki çağrıda reddedilsin. Ziyaretçi davranışı değişmesin. Login için ayrı sabit kod EMPLOYMENT_ENDED (mobil "İşten ayrıldınız" gösterecek).

Dosyalar: convex/lib/employment.ts (YENİ employmentEnded), convex/lib/mobileErrors.ts (yeni kod), convex/lib/employeeAuth.ts (getCurrentEmployee), convex/employeeAuth.ts (signIn), YENİ convex/employeeAuth.employmentEnded.test.ts, convex/lib/employment.test.ts, convex/w53Integration.test.ts (yalnız mobil sorguların sistem saati son güne alındı).

## Sorular
1. Hesap sızıntısı: signIn'de EMPLOYMENT_ENDED yalnız DOĞRU şifreden sonra mı dönüyor? Yanlış şifre / auth yok / passwordHash yok / hesap yok yollarında yanıt ve zamanlama (bcrypt dummy doğrulama) HEAD ile aynı mı? isActive=false + bitiş tarihi YOK → hâlâ INVALID_CREDENTIALS mi (mevcut test "does not disclose an inactive account")? Rate limiter davranışı değişti mi?
2. Oturum: getCurrentEmployee'yi kullanan TÜM mobil uçlar (employeeAuthedQuery/Mutation + doğrudan çağıranlar: employeeCheckIn.createMyCheckInToken, mobileAccess.requestOpen, diğerleri — grep) artık bitiş sonrası EMPLOYMENT_ENDED alıyor mu? getCurrentEmployee'yi ATLAYAN bir mobil oturum yolu var mı (ör. employeeSessions'ı doğrudan okuyan query/mutation/http route, processCardReadingCore consumeReaderToken)? Varsa bitiş kontrolü orada nasıl (QR yolu employeeWithinAccessEpoch ile zaten kapalı mı)?
3. Sıra: getCurrentEmployee'de EMPLOYMENT_ENDED, EMPLOYEE_INACTIVE'den ÖNCE. isActive=false + bitiş geçmiş artık EMPLOYMENT_ENDED (eskiden EMPLOYEE_INACTIVE). Mobil istemci `mobile/lib/core/response_decoder.dart` `_authCodes` setinde EMPLOYMENT_ENDED yok → mevcut mobil sürüm bu kodda oturumu düşürmez. Bunun etkisini değerlendir (güvenlik: sunucu yine reddediyor mu? UX: kullanıcı ne görür?). Flutter'ı DEĞİŞTİRME, yalnız raporla.
4. Saat dilimi + sınır: trTodayKey() İstanbul günü mü; son gün dahil, ertesi 00:00 TR'den itibaren ret mi? employmentEnded ile employeeWithinAccessEpoch'taki (convex/lib/mobileAccess.ts) bitiş kontrolü aynı semantik mi?
5. Ziyaretçi: isVisitor=true için signIn ve getCurrentEmployee davranışı HEAD ile birebir mi?
6. w53Integration.test.ts değişikliği yalnız mobil sorguların saatini mi değiştiriyor; hiçbir beklenen değer değişmemiş mi; testin anlamı korunuyor mu?
7. Testler eski kodda kırmızı / yenide yeşil mi? `git stash` YASAK; HEAD export: `rm -rf /tmp/ee-head && mkdir /tmp/ee-head && git archive HEAD | tar -x -C /tmp/ee-head && cp convex/employeeAuth.employmentEnded.test.ts /tmp/ee-head/convex/ && ln -s /Users/emreaydin/ngsaccess/node_modules /tmp/ee-head/node_modules` → orada koş (beklenen: 5 kırmızı, 6 yeşil). İş bitince /tmp/ee-head'i sil.
8. Yeni import'lar (./employment, ./trDate) V8'de güvenli mi (node-yalnız değil), döngü yok mu?

## Kapılar (kendin koş)
- `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` ve `-p tsconfig.app.json`
- `node_modules/.bin/vitest run` (TAM suite; `convex/w5aFix2.test.ts` yük altında flaky — düşerse tek başına koş)
- `node /tmp/find-node-leak.mjs` çıktısız

Rapor: /tmp/denetim-employment-ended.md — ENGEL/DÜZELT/NOT, file:line, eski vs yeni, somut girdi, öneri; sonda GÜVENLİ / GÜVENLİ DEĞİL + kapı özeti.
worker_done (≤10 satır): sayılar + hüküm + kapılar.
