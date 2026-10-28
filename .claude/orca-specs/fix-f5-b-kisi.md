# FAZ 5-B — Çalışan e-posta normalizasyonu (R-02) · silinen ev sahibi (K-07) · silme kapsamı (Y-10) · kurulum yönlendirmesi (B-06)

ÖNCE `/Users/emreaydin/ngsaccess/.claude/orca-specs/fix-ortak.md` OKU (YASAK: git add/commit/stash/checkout/reset/restore; npx convex; DB; paket kurma). Rapor: `/tmp/fix-f5-b-kisi-rapor.md`.
Kaynak: `docs/sistem-audit-2026-10-25/DOGRULAMA.md` + `M4-hesap-yonetim.md` / `M5-mobil.md` / `M1-kisi-erisim.md` (R-02, K-07, Y-10, B-06 — kanıtı yeniden doğrula).

## Hedef (test edilebilir)
(a) Çalışan e-postası her yazma yolunda trim+küçük harf saklanır, mobil giriş büyük/küçük harften bağımsız çalışır; (b) ev sahibi silinen ziyaretçi düzenlenebilir; (c) çalışan silinince ev sahibi olduğu ziyaretçilerin bağı/iletişim alanları public hesap-silme metniyle uyumlu temizlenir; (d) şifre kurulumu sonrası çalışan web QR'a değil mobil uygulamaya yönlendirilir, /check-in konum istemez.

## Ownership
`convex/employees.ts`, `convex/employeeAuth.ts`, `convex/lib/employeeCascade.ts`, `convex/lib/accessScopeRelations.ts`, `convex/visitors.ts` (yalnız K-07 düzenleme yolu), `convex/migrations.ts` YOKSA yeni fonksiyonu `convex/employees.ts` içine `internalMutation` olarak koy (YENİ convex modülü AÇMA — codegen yasak, internal.X tipsiz kalır), `src/pages/EmployeeSetup.tsx`, `src/pages/CheckIn.tsx` (yalnız B-06 konum/metin), ilgili testler + yeni `convex/fixF5People.test.ts`.
DOKUNMA: `convex/invites.ts`, `convex/auth.ts`, `src/pages/UserSetup.tsx`, `src/pages/Login.tsx` (F5-A) · `convex/lib/grantStatus.ts`, `convex/accessGrantStatus.ts`, `convex/lib/adminGuards.ts`, `convex/projects.ts`, `src/components/employees/**`, `src/components/devices/**` (F5-C) · `convex/actions/sendEmail.ts`, `convex/actions/sendScheduledReports.ts`, `src/components/settings/**`, `convex/lib/auditLogQuery.ts`, `package.json` (başka oturum WIP) · `convex/lib/pdks*`, `src/components/reports/**`, `src/lib/reports/**`. `public/**` dokunma (metin uyumsuzluğu kalırsa rapora yaz).

## Değişiklikler
1. **R-02** — tek yardımcı `normalizeEmployeeEmail` (trim + toLowerCase; boş → undefined); employees create/update/import/bulk yolları ve `employeeAuth` giriş/kurulum/şifre yolları bunu kullansın. Tekillik kontrolü normalize değerle.
   Backfill: `internalMutation` sayfalı (≤200/parti, scheduler devamı, ≤20 halka) mevcut kayıtları normalize eder; normalize sonrası ÇAKIŞAN (aynı projede iki kişi aynı e-posta) kayıtları DEĞİŞTİRMEZ, sayar ve konsola listeler (id). Koordinatör yayından sonra Emre onayıyla çalıştıracak — sen ÇALIŞTIRMA.
   Mobil giriş: kayıtlı veri henüz normalize değilken de çalışsın (geçiş dönemi: önce normalize değerle index araması, bulunamazsa mevcut ham değerle eski arama).
2. **K-07** — `accessScopeRelations.ts:~41` ev sahibi kaydı yoksa (silinmiş) düzenleme reddedilmesin: kayıp ev sahibi "yok" sayılır (yeni bir ev sahibi atanırsa normal doğrulama). Silmede bağlı ziyaretçilerin `hostEmployeeId`'si kaldırılsın (sayfalı, ≤200).
3. **Y-10** — `public/hesap-silme/index.html:47` metnini OKU; çalışan silinince ev sahibi olduğu ziyaretçilerde metinde vaat edilen iletişim alanları temizlensin (yalnız metnin söylediği alanlar; ziyaretçi kaydının kendisi ve geçiş geçmişi kalır). Cascade sayfalı (mevcut 200'lük desen, F4-B `employeeCascade.ts`).
4. **B-06** — `EmployeeSetup.tsx:~87` başarı metni: "Şifreniz hazır. NGS Plus mobil uygulamasıyla giriş yapabilirsiniz." (web QR vaadi yok); `CheckIn.tsx:~68` kullanılmamış token için konum İSTEMEDEN okuyucuya yönlendiren nötr ekran (backend zaten READER_REQUIRED döndürüyor; F4-A'nın "Bu QR kod daha önce kullanıldı." davranışını KORU).

## Kabul (testler)
- `Ali@X.com ` ile oluşturulan kişi `ali@x.com` saklanır; mobil `ALI@x.com` ile girer; ham büyük harfli eski kayıt da girer; backfill 450 kayıt 3 parti + çakışan kayıt değişmez.
- Ev sahibi silinmiş ziyaretçi güncellenir; çalışan silmede ziyaretçi bağı/iletişim alanı temizlenir, ziyaretçi kalır.
- B-06: kullanılmamış token ekranında geolocation çağrılmaz (test).
- Kapılar (fix-ortak.md) + `vitest run convex/employees*.test.ts convex/employeeAuth*.test.ts convex/fixF4People.test.ts convex/fixF5People.test.ts convex/visitors*.test.ts convex/mobileVisitors.test.ts src/pages/CheckIn.test.tsx src/pages/EmployeeSetup*.test.tsx` (var olanlar) yeşil.
commit/push/deploy/migration/DB yazma YOK. `git add`/`git commit` YASAK.
