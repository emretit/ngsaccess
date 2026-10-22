# KVKK rızaları kartı düzeltmesi (frontend + küçük backend)

Emre 2026-10-22 kararları (personel drawer'ındaki "KVKK rızaları" kartı, `src/components/employees/EmployeeConsentsCard.tsx`):
1. Parmak izi rızası iptal edilince cihazlardaki parmak izi kayıtları OTOMATİK silinir.
2. Kart verisi satırı çıkar (iş sözleşmesine dayanır, rıza gerekmez); fotoğraf rızası kalır.
3. Rıza alırken imzalı form (belge) yüklenebilir; aktif rızada belge görüntülenebilir.
4. Yüz tanıma satırı KALIR.
Ek (CEO denetimi): biyometri modülü kapalıyken satırlar kırmızı "Rıza Yok" + sebepsiz kapalı buton gösteriyor → yanıltıcı.

## Ortak kurallar (bu repo; CLAUDE.md'yi okumadığın için buraya gömüldü)
- ÖNCE `convex/_generated/ai/guidelines.md` oku (Convex kuralları).
- TypeScript strict. `any` / `as any` YASAK. Bilinmeyen veri `unknown` + narrowing. `!` yerine erken return.
- Convex handler'ları schema alan adlarını camelCase döner. `filter(Boolean)` yerine tip korumalı filtre.
- UI metinleri Türkçe, cümle düzeni (yalnız ilk harf büyük), sade. Mevcut bileşenler: `src/components/ui/**`, `ConfirmDestructive`, `notify`, `formatTrDateTime`, `useAsyncAction`.
- Mobilde dokunma hedefi `max-sm:min-h-11`; masaüstü kompakt kalır.
- YASAK: commit, push, deploy, `npx convex *` (codegen dahil — `convex/_generated/**` elle de düzenleme), DB yazma, `mobile/**`, git stash/checkout/reset. Localhost:8081 canlı veriye bağlı: tarayıcıda rıza al/iptal/Kaydet gibi yazan hiçbir butona BASMA.

## Hedef (test edilebilir)
Parmak izi rızası iptali `scheduleFingerprintPurge`'ü tetikler; yeni "card" rızası alınamaz; rıza kaydı isteğe bağlı belgeyle alınır ve belge yalnız yetkili yöneticiye imzalı URL ile açılır; modül kapalıyken biyometri satırları nötr "Kapalı" + ayara bağlantı gösterir; metinler cümle düzeninde; mevcut + yeni testler yeşil.

## Ownership (yalnız bunlara yaz)
`convex/employeeConsents.ts` (+ test), `convex/schema.ts` (YALNIZ `employeeConsents` tablosuna bir opsiyonel alan), `convex/lib/employeeCascade.ts` (yalnız consents bölümü, gerekirse), `src/components/employees/EmployeeConsentsCard.tsx` (+ `EmployeeConsentsCard.test.tsx`), yeni `src/components/employees/hooks/useConsentDocumentUpload.ts` (+ test) gerekiyorsa.

## Backend
1. **İptal → parmak izi silme** (`employeeConsents.revoke`): `consentType === "biometric_fingerprint"` ise `scheduleFingerprintPurge(ctx, employeeId, employee.cardNumber)` (`convex/lib/employeeCardChange.ts:27`; mevcut işten çıkarma/pasifleştirme yolu bunu kullanıyor). Audit notuna "cihaz parmak izleri silme kuyruğuna alındı (N)" ekle. Yüz için davranış değişmez.
2. **Kart rızası kapanır** (`employeeConsents.grant`): args'tan `card` literal'i çıkar (schema'daki literal eski kayıtlar için KALIR). Eski aktif kart rızası iptal edilebilir kalır.
3. **Belge** : schema `employeeConsents`'e `documentStorageId: v.optional(v.id("_storage"))`. `grant` args'a `documentStorageId` (opsiyonel). Doğrulama `claimEmployeePhoto` desenine benzer (`convex/lib/peoplePhoto.ts`): `pendingUploads.by_storage` satırı yükleyen kullanıcıya ait olmalı (`assertUploadOwner` / `files.ts` deseni), `ctx.db.system.get(storageId)` ile içerik türü PDF/JPEG/PNG ve boyut ≤ 10 MB; geçerse pending satırı silinir (yoksa `cleanupPendingUploads` cron'u dosyayı siler!) ve consent'e yazılır. Eski `documentUrl` alanı dokunulmaz.
4. **Belge görüntüleme**: yeni `getDocumentUrl({ id: v.id("employeeConsents") })` — yönetici yetkisi (grant/revoke ile aynı seviye: `adminQuery` ya da eşdeğeri) + `requireEmployeeAccess`; `ctx.storage.getUrl` döner, belge yoksa `null`. `returns` validator'ı yaz.
5. **Silinen kişi** (`employeeCascade.ts`): consents revoke ediliyor (history korunur) — belgeyi SİLME (rıza ispatı), yalnız mevcut davranışı bozma.
6. Testler (`convex-test` deseni; mevcut `convex/*.test.ts` örneklerine bak): parmak izi rızası iptali purge'ü planlar (enrollment satırı `cancelRequested`), yüz iptali planlamaz; card grant reddedilir; belgeyle grant (sahip kontrolü, yanlış tür/boyut reddi, pending satırı silinir); getDocumentUrl yetki.

## Frontend (`EmployeeConsentsCard.tsx`)
1. **Modül kapalı** (`biometricModule.enabled === false`): yüz + parmak izi satırında aktif rıza YOKSA rozet nötr "Kapalı", "Rıza al" butonu YOK; satır içi `text-xs`: "Biyometri modülü kapalı." + yöneticide `<Link to="/settings?tab=privacy">Ayarlar › Gizlilik ve KVKK</Link>`. Aktif rıza varsa "Aktif" + İptal (bugünkü gibi). Üstteki ayrı "Biyometri modülü kapalı…" paragrafı kaldırılır.
2. **Rozetler**: aktif → "Aktif" (successSubtle); yok → "Rıza yok" nötr (`outline`), kırmızı `destructive` HİÇBİR durumda yok. Fotoğrafta yokken "İsteğe bağlı".
3. **Kart satırı**: listeden çıkar; yalnız eski AKTİF kart rızası varsa satır görünür (İptal için). Liste altına `text-xs`: "Kart verisi iş sözleşmesine dayanır; ayrıca rıza gerekmez."
4. **Metinler (cümle düzeni)**: "Yüz tanıma", "Parmak izi", "Fotoğraf"; açıklamalar: biyometri "Yalnız kapı erişimi; mesai takibinde kullanılmaz", fotoğraf "Profil fotoğrafı; isteğe bağlı". Üst açıklama tek cümle: "Biyometri yalnız erişim kontrolü içindir; rıza yoksa kayıt eklenemez." ("Yasal danışmanınıza doğrulatın" kalkar.) Diyalog başlığı "<Tür> rızası", alan etiketi "Not (isteğe bağlı)", buton "Rızayı kaydet".
5. **Belge yükleme (diyalog)**: "İmzalı rıza formu (önerilir)" dosya alanı — PDF/JPEG/PNG ≤ 10 MB; yükleme `files.generateUploadUrl` → POST → `files.claimUpload` (mevcut `usePhotoUpload` deseni); yükleniyor/hata durumları `role=status`/`role=alert`; yükleme sürerken Kaydet kapalı. Belge zorunlu DEĞİL.
6. **Aktif satırda belge**: `documentStorageId` varsa "Belgeyi aç" bağlantısı/butonu → `getDocumentUrl` sonucu yeni sekmede (`window.open(url, "_blank", "noopener")`); yoksa gösterme.
7. **İptal onayı**: parmak izi için etki metni "Cihazlardaki parmak izi kayıtları da silinir." (kayıt sayısı `fingerprintEnrollment.listForEmployee` ile biliniyorsa "N kayıt"); diğer türlerde "Rıza kaydı geri alınmış olarak işaretlenir; geçmiş korunur." Bugünkü "şablonlar silinmez" metni kalkar.
8. Yetkisiz rol (project_user): butonlar yok (bugünkü gibi), rozetler nötr.
9. Testler (vitest + renderToStaticMarkup / mock'lar; mevcut `EmployeeConsentsCard.test.tsx` deseni): modül kapalıyken "Kapalı" + bağlantı + Rıza al yok; destructive rozet yok; kart satırı yalnız aktif kart rızasında; belge varken "Belgeyi aç"; parmak izi iptal etki metni.

## Kapsam dışı
Aydınlatma metni şablonunun taşınması, yüz kayıt akışı, mobil, `EmployeeFingerprintCard` (yalnız metin referansı "KVKK rızaları" zaten doğru).

## Kapılar (hepsini kendin koş, sayıyla yaz)
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` ve `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` → 0 (codegen çalıştıramadığın için yeni query/arg tipleri `convex/_generated/api.d.ts`'te otomatik görünür — `api.d.ts` modül-tabanlı; yeni dosya EKLEME, mevcut `employeeConsents.ts` içine yaz).
- `node_modules/.bin/eslint src convex` → 0 error
- `node_modules/.bin/vitest run convex/employeeConsents src/components/employees` + ilgili convex testleri → yeşil

## Rapor
`worker_done` ≤10 satır: madde başına yapıldı/yapılmadı + dosya:satır, kapı sonuçları (sayılarla), şema değişikliği tam satırı.
