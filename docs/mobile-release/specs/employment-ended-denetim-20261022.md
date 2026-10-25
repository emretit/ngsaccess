# EMPLOYMENT_ENDED güvenlik denetimi

Tarih: 2026-10-22. Referans HEAD: `579db3e79e75deb880a78eb3791cf02139c190a1`.
Kapsam: spec'teki yedi dosyanın HEAD → çalışma ağacı farkları; ilgili oturum, QR, kuyruk ve Flutter çağrı zincirlerinin salt-okuma incelemesi. Kapsam dışı commit'siz dosyalar incelenmedi. Uygulama/Flutter dosyası değiştirilmedi; commit, push, deploy, gerçek DB veya `npx convex` çalıştırılmadı. Spec'in izin verdiği HEAD kopyası `/tmp/ee-head` içinde çalıştırılıp silindi.

**Bulgu sayısı: 0 ENGEL, 1 DÜZELT, 3 NOT. Sunucudaki giriş/oturum engellemesi GÜVENLİ; mevcut Flutter sürümündeki mesaj ve oturum temizleme uyumu tamamlanmamış.**

## DÜZELT-1 — Flutter yeni kodu tanımıyor; giriş ve açık oturum farklı yanlış hata gösteriyor

Konum: `convex/lib/employeeAuth.ts:26`, `convex/employeeAuth.ts:236`; `mobile/lib/core/response_decoder.dart:45`, `:62`; `mobile/lib/repositories/auth_repository.dart:6`, `:165`, `:189`; `mobile/lib/core/errors.dart:143`; `mobile/lib/config/convex_config.dart:287`, `:354`; `mobile/lib/providers/auth_provider.dart:147`; `mobile/lib/core/error_localizer.dart:24`.

Somut girdi: ziyaretçi olmayan, `isActive=false`, `employmentEndDate="2026-10-18"`, geçerli oturumu olan kişi 19 Ekim'de `employeeAuth.me` çağırır. HEAD `EMPLOYEE_INACTIVE` döndürür; decoder bunu `AuthExpiredError` yaparak oturumu düşürür. Yeni kod önce `EMPLOYMENT_ENDED` döndürür; `_authCodes` ve `normalizeBusinessCode` bunu tanımadığından `BusinessError(BUSINESS_ERROR)` oluşur. Auth-expiry callback ve polling iptali çalışmaz; açık ekranda önceki veriler kalabilir ve polling artan beklemeyle sürebilir. Yerelleştirilmiş mesaj `errorUnknown`: “Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.” Bootstrap sırasında ise güvenli depodaki token korunur, korumalı ekranlar açılmaz ve `retryableFailure` ekranına gidilir (`auth_provider.dart:160`).

Aynı kişi doğru şifreyle yeniden giriş yaparsa sunucunun başarı zarfı içindeki `{error:{code:"EMPLOYMENT_ENDED",...}}`, `AuthRepository._throwStructuredError` default kolundan **ProtocolError** olur; kullanıcı `errorProtocol`: “Geçerli bir sunucu yanıtı alınamadı. Lütfen yeniden deneyin.” görür. Sunucunun Türkçe mesajı istemcinin allowlist yaklaşımı nedeniyle doğrudan gösterilmez. “İşten ayrıldınız” beklentisi mevcut istemcide gerçekleşmez.

Güvenlik etkisi: sunucu korumalı çağrıyı handler'a geçirmeden reddeder, yeni login token'ı üretmez; bu istemci uyumsuzluğu yeni sunucu erişimi sağlamaz. Öneri: ayrı Flutter değişikliğinde login sonucunu ve exception decoder'ını birlikte güncelleyin, kodu tanıyan yerelleştirilmiş “işten ayrılma” nedeni korunurken aktif oturum/token ve hassas ekran durumunu temizleyin. Yalnız `_authCodes` setine eklemek login'in ProtocolError yolunu ve özel mesaj beklentisini çözmez. Bu denetimde Flutter değiştirilmedi.

## NOT-1 — Yanıt gizliliği korunuyor; zamanlama HEAD ile harfiyen aynı değil

Konum: `convex/employeeAuth.ts:15`, `:205`, `:216`, `:217`, `:227`, `:232`, `:236`; `convex/lib/employeeAuth.ts:57`.

`EMPLOYMENT_ENDED` ancak gerçek hash doğrulaması başarılı olduktan sonra döner. Yanlış şifre, hesap yok, auth yok veya passwordHash yok durumları `INVALID_CREDENTIALS` olarak kalır. Hesap yok / auth yok / hash yok yollarında aynı cost-10 dummy bcrypt doğrulaması korunmuştur. `isActive=false` ve bitiş tarihi olmayan kişi doğru şifre verse de HEAD gibi dummy doğrulaması + `INVALID_CREDENTIALS` alır; mevcut “does not disclose an inactive account” testi yeşildir.

İstisna: somut olarak `isActive=false`, geçmiş bitiş tarihi ve mevcut passwordHash için HEAD employee sorgusundan hemen sonra dummy hash'i doğrulardı; yeni sürüm auth kaydını da okur ve gerçek hash'i doğrular. Bu, doğru şifreyi ayırt edebilmek için gerekli akış değişikliğidir. Dolayısıyla “yanıt ve zamanlama tamamen aynı” denemez: normal üretim hash'leri ve dummy cost-10 olduğundan bcrypt iş yükü aynı sınıftadır, ancak ek DB okuması vardır; farklı cost veya bozuk legacy hash için mutlak süre eşitliği yoktur. Süre istatistiği ölçülmedi ve sabit zaman garantisi verilmedi. Yeni test fixture'ındaki cost-4 hash üretim maliyetini temsil etmez. Öneri: zamanlama hakkında “dummy koruması korunuyor” ifadesini kullanın; daha güçlü garanti istenirse desteklenen hash biçimi/cost politikası ve ayrı zamanlama testi tanımlayın.

Rate limiter aynı yerde, normalize edilmiş e-posta anahtarıyla ve `throws:false` ile çalışır. Yeni ret `return` olduğu için limiter yazısı rollback olmaz; limit aşımı yine önce `RATE_LIMITED` döndürür. Eski yok-hesap, yanlış-şifre, eşzamanlı limit ve refill testleri tam pakette başarılıdır.

## NOT-2 — Ortak kontrol dışındaki yollar mevcut ayrı kurallarıyla güvenli; tüm yollar aynı hata kodunu dönmez

Konum: `convex/employeeAuth.ts:279`; `convex/employeeCheckIn.ts:55`; `convex/lib/checkInUx.ts:2`; `convex/lib/processCardReadingCore.ts:274`; `convex/lib/mobileAccess.ts:173`, `:190`.

- `signOut` ortak auth kontrolünü çağırmaz; bitiş sonrası da verilen oturumu silip `null` döndürür. HEAD ile aynı ve güvenli çıkış davranışıdır.
- Fiziksel okuyucunun `consumeReaderToken` yolu session'ı doğrudan `tokenRow.sessionId` üzerinden okur. Token/session süre ve sürümlerini, auth hash/sürümünü ve `genericReaderTokenAllowed`ı doğrular. Bu fonksiyon `employeeWithinAccessEpoch` üzerinden bitiş tarihini ve pasifliği kontrol eder. Örnek: son gün 23:59:30'da üretilmiş, 00:00:10'da henüz 60 saniyesi dolmamış QR bile ertesi gün `{granted:false}` alır; `EMPLOYMENT_ENDED` dönmesi beklenmez. Bu koruma HEAD'de de mevcuttur.
- Kuyruktaki kapı işlemi session'ı `row.sessionId` ile doğrudan okuyan `mobileOperationAllowed`dan geçer; `resolveMobileTarget → listMobileTargets → employeeWithinAccessEpoch` ile teslim öncesi tekrar denetlenir. `mobileAccess.claimGateway:138`, `ideSync.ts:297/:330/:353`, `hikvisionSync.ts:586` çağrı noktaları bunu kullanır. Sınır öncesi oluşturulmuş henüz teslim edilmemiş işlem sınır sonrasında izin alamaz.
- `checkInWithToken` eski uyumluluk endpoint'i oturuma bağlı değildir. Kullanılmamış QR'yi telefondan tüketmez; `READER_REQUIRED`/expired/invalid döner. Ancak **daha önce tüketilmiş QR**, `usedAt` süre kontrolünden önce değerlendirildiği için, işten ayrılma sonrasında da eski `employeeName/accessTime/locationRecorded` makbuzunu `success:true` olarak döndürebilir. Bu HEAD ile aynı, yeni devam kaydı veya kapı erişimi yaratmayan bearer-makbuz davranışıdır. “Sonraki her çağrı kesinlikle EMPLOYMENT_ENDED” genellemesine bu istisna eklenmelidir; iş kararı eski makbuzu da kapatmayı kapsıyorsa ayrı kapsamda yetki/saklama süresi tanımlanmalıdır.

HTTP rotalarında employee session ile bağımsız korumalı mobil giriş yolu bulunmadı; okuyucu rotası yukarıdaki QR kontrolüne ulaşır. Diğer employeeSessions referansları şema, oluşturma, bağımlılık temizliği veya zaten korunan token-status kontrolüdür.

## NOT-3 — W5.3 saat değişikliği yalnız mobil çağrı ile sınırlı değil

Konum: `convex/w53Integration.test.ts:99`, `:117`, `:128`, `:131`, `:193`.

Diff yalnız yorumlar ve `vi.setSystemTime` ekleme/taşımasından oluşuyor; hiçbir beklenen değer, fixture veya sorgu argümanı değiştirilmemiş. İlk senaryoda zaten dashboard öncesi var olan saat ayarı mobil sorgunun önüne taşınmış; dashboard aynı saatte çalışmaya devam ediyor. İki senaryoda yeni saat ayarı son mobil sorgu önünde. Ancak assignment-only senaryoda `:128` küresel saati geri alır ve **`:131` SGK sorgusu da artık 23 Haziran yerine 22 Haziran 23:59 TR'de çalışır**. Bu nedenle “yalnız mobil sorguların saati değişti” ifadesi teknik olarak tam doğru değil.

Gece D+1 çıkış fixture'ı korunmuş, D günü hesabı ve 450 dakika/7,5 saat beklentileri değişmemiş, testin mevcut adaptörler arası hesap tutarlılığı anlamı korunmuştur. Bu test zaten ilerideki çıkışı DB'ye yerleştirerek geçmiş tarihte sorgu yapıyor; gerçek zaman akışı testi değildir. Öneri: saat değişikliğini sadece mobil çağrı etrafında tutmak istenirse önceki fake zamanı saklayıp sorgudan sonra geri yükleyin; mevcut değişiklik güvenlik engeli değildir.

## Ortak mobil kontrolün tam kapsamı

`convex/lib/customFunctions.ts:89/:100` içindeki iki wrapper, handler'dan önce `getCurrentEmployee` çağırır. 25 public endpoint kapsanıyor:

| Dosya | Endpoint ve satır |
|---|---|
| employeeAuth.ts | changePassword:295, me:337 |
| employeeCheckIn.ts | getMyCheckInTokenStatus:34 |
| mobileAccess.ts | listTargets:22, getOperation:110, getRequestOperation:122 |
| mobileAttendance.ts | listPage:57, summary:106 |
| devices.ts | listForEmployee:88 |
| cardReadings.ts | listForEmployee:478, selfCheckIn:495 |
| leaveRequests.ts | submit:22, withdraw:42, listMine:54 |
| attendanceCorrections.ts | submit:15, withdraw:36, listMine:48 |
| mobileVisitors.ts | notice:15, getCreateReceipt:23, listPage:37, summary:55, detail:75, create:81, update:118, cancel:131 |

Ayrıca iki public mutation doğrudan çağırıyor: `employeeCheckIn.createMyCheckInToken:12` ve `mobileAccess.requestOpen:60`. Bu 27 uçta geçerli session + geçmiş bitiş tarihi korumalı handler'a ulaşamaz. `requestOpen:59` geçersiz requestId'yi auth öncesi reddeder; bu durumda hata `INVALID_REQUEST_ID` olur. Argüman validasyonu, olmayan/süresi dolmuş oturum da önce kendi hatasını verir; “hepsi EMPLOYMENT_ENDED” geçerli oturum ve geçerli istek önkoşuluyla doğrudur.

`getCurrentEmployee` sırası: session varlığı → finite ve gelecekte expiry → employee varlığı → **EMPLOYMENT_ENDED** → EMPLOYEE_INACTIVE → passwordHash/passwordVersion. Bu nedenle pasif + geçmiş bitiş artık yeni kodu alır; geçersiz hash/sürümde de bitiş hatası sürüm kontrolünden önce gelir, ancak hiçbirinde erişim verilmez. Bitiş tarihi olmayan pasifler eski `EMPLOYEE_INACTIVE` davranışını korur.

## Gün sınırı, ziyaretçi ve import doğrulaması

- `convex/lib/trDate.ts:1/:8/:23` UTC'ye üç saat ekleyip UTC takvim gününü alır; uygulamanın TR takvim kuralıyla uyumludur. `employment.ts:10/:15` geçerli YYYY-MM-DD alanı için yalnız `today > employmentEndDate` olduğunda ended üretir. Son gün dahildir. `2026-10-19T20:59:59Z` izin; `2026-10-19T21:00:00Z` (20 Ekim 00:00 TR) ret regresyon testi yeşildir. Yazma yolunda tarih biçimi/takvim doğrulaması `employeeTermination.ts:51`dedir.
- `convex/lib/mobileAccess.ts:49` bitiş kısmında aynı `employedOn` ve TR gün anahtarını kullanır. Erişim helper'ı ayrıca isActive, erişim penceresi ve geçerli timestamp kontrol eder; bu yüzden tüm fonksiyonun semantiği değil, **işten çıkış tarihi semantiği** aynıdır. isActive=false kişi son gününde bile eski pasif kontrolüyle reddedilir; bu Emre kararındaki OR koşulunu korur.
- `isVisitor=true` için `employmentEnded` koşulsuz false. Aktif ziyaretçinin eski/stale employmentEndDate ile signIn/me başarısı korunur; pasif ziyaretçi HEAD'deki login `INVALID_CREDENTIALS` ve session `EMPLOYEE_INACTIVE` hatalarını alır. QR/kapı erişim pencereleri aynen korunur. Yeni testler aktif ziyaretçinin login/me davranışını, helper testleri true/false/undefined aktifliklerde ziyaretçi istisnasını doğrular.
- `employment.ts` ve `trDate.ts` import içermeyen saf JS/TypeScript yapraklarıdır; Node builtin veya `use node` yoktur, yeni döngü oluşmaz. `mobileErrors` Convex values kullanır. V8 uyumu için belirtilen Node sızıntı kontrolü çıktısız exit 0, edge-runtime regresyon testleri başarılıdır; deploy yapılmadı.

## Kapılar ve hüküm

| Kapı | Sonuç |
|---|---|
| `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` | Exit 0, hata yok |
| `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` | Exit 0, hata yok |
| `node_modules/.bin/vitest run` | Exit 0; **325 dosya / 3686 test başarılı**, 33,36 sn; flaky tekrarına gerek kalmadı |
| HEAD export + yalnız yeni employmentEnded testi | Beklenen exit 1; **5 kırmızı / 6 yeşil**, 11 test; yanlış kod/eksik ret nedeniyle kırmızı |
| Yeni ağaç: employmentEnded + employment helper testleri | Exit 0; **21/21** (11 yeni endpoint testi + 10 helper testi) |
| `node /tmp/find-node-leak.mjs` | Exit 0, **çıktı yok** |
| `node_modules/.bin/eslint src convex` | Exit 0; **0 error**, 1 mevcut unused-vars uyarısı (`convex/attendanceCorrections.test.ts:8`); no-explicit-any hatası yok |
| Kapsamdaki tracked diff whitespace kontrolü | `git diff --check` exit 0 |
| Geçici HEAD kopyası | Silindi; stash/worktree kullanılmadı |

HEAD'de kırmızı olan beş vaka: aktif çalışanın doğru şifreli girişinin engellenmesi, cron tarafından pasifleştirilmiş çalışanın doğru şifreli giriş kodu, aktif/pasif açık oturumun yeni kodla reddi ve İstanbul gece yarısı sınırı. Bu, testlerin yeni davranışı gerçekten ayırt ettiğini gösterir.

**Son hüküm: GÜVENLİ — incelenen backend giriş/oturum engellemesi için 0 ENGEL; 1 DÜZELT (Flutter sözleşme/UX uyumu), 3 NOT. Zorunlu kapıların tamamı geçti; mevcut mobil sürümün “İşten ayrıldınız” göstermesi ve oturumu temizlemesi için DÜZELT-1 ayrıca tamamlanmalı.**
