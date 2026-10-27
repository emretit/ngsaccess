# Ziyaretçiler audit düzeltmesi — çapraz denetim (2026-10-27)

**Karar: Geçti.** Engel yok. Veri silme, yetki ve maske yolları güvenli. 1 Önemli bulgu var; bir ürün kararı gerektiriyor ve yayını durdurmuyor. 9 Küçük bulgu var, yayın sonrasına kalabilir.

Taban: HEAD d2530e68. Denetlenen: `.claude/pathspec-ziyaretci-audit.txt` diff'i + untracked `convex/visitorHosts.ts`, `convex/lib/visitorRetention.ts` ve testleri. Salt okuma; kod değiştirilmedi.

## Kapı sonuçları (bu denetimde koşuldu, 16:11)
| Kapı | Sonuç |
|---|---|
| `tsc -p tsconfig.app.json` | 0 hata |
| `tsc -p convex/tsconfig.json` | 0 hata |
| `eslint` (6 yol) | 0 error, 0 uyarı çıktısı |
| `vitest` (8 yol) | 15 dosya, 274/274 geçti |
| `node scripts/find-node-leak.mjs` | sızıntı yok (exit 0) |

## Kontrol listesi özeti
- **W4 veri güvenliği: güvenli.**
  - Ayar boşken hiçbir şey silinmiyor (`enabled` yalnız sayı olan satırı seçiyor; `null` → `toPatch` ile `undefined`).
  - Aktif kayıt, `preRegistered` ve bitişi gelecekte olan kayıt korunuyor: index aralığı `isActive=false` + `lt(cutoff)`, üstüne `shouldPurgeVisitor` süzgeci var.
  - Başka projenin kaydı korunuyor (`visitor.projectId !== projectId` → çık).
  - `removeRetainedVisitor` koşulları `Date.now()` ile yeniden kontrol ediyor ve idempotent.
  - Eski TR duvar saati ya da ofsetli değerler en fazla ~3 sa geç silinmeye yol açar. Erken silme olmuyor: en az 30 gün sınırı var; tanınmayan biçim `NaN` → silinmez.
  - Null aktör yalnız tipi genişletiyor; mevcut 4 çağıran (`employees.ts:480,501`, `employeeTermination.ts:280`, `visitors.ts:343`) hâlâ `ctx.user` geçiriyor. `writeAudit` `user: null` kabul ediyor. Rıza iptali yalnız `revokedAt` yazıyor, `revokedBy` yok, yani şema ihlali yok.
  - Zincir 20 çağrı bütçesine bağlı (`batch < MAX_CHAIN_LENGTH`). Silme hatası zinciri durdurmuyor, ertesi gün yeniden deneniyor. Sonsuz yeniden planlama yok.
- **Yetki (W2/W1/W3): güvenli.**
  - `listPage`/`summary`/`getDetail` `visitors.manage` ∨ `reports.view` dışında ret veriyor; super_admin `getUserPermissions` üzerinden tüm yetkileri alıyor.
  - Telefon/not/amaç liste satırında ve ayrıntıda aynı `canManage` ile maskeleniyor.
  - **Boş=temizle silme riski yok:** okuma maskesi ve `update` yazma kapısı aynı `visitors.manage` kaynağına (`getUserPermissions`) bakıyor. Maskeli değeri gören kişi `update` çağıramıyor; formu dolduran yönetici gerçek değeri alıyor.
  - `visitorHosts.search` için `resolveProjectScope` + `visitors.manage` şart. `startCardCapture` için `resolveReadingScope(CARD_CAPTURE_PERMISSIONS)` + cihaz projesi şart.
- **Doğruluk:**
  - Z-Y1 tamam: `update` → `checkedOut`. Formda aktif kayıtta kutu yok, payload `isActive:true` gönderiyor.
  - Z-O1 tamam: her okuma insert'inde `createdAt` sunucu zamanı (`processCardReadingCore.ts:63` `new Date()`; QR/sanal okuyucu `consumedAt`). Backfill (`cardReadings.ts:860`) cihaz zamanı yazıyor, bu yüzden eski olaylar doğru şekilde yakalanmıyor. 30 sn pencere için 50 sınırı makul.
  - Z-O2 tamam: aktif ziyaretçi ve personel kartı hiç yakalanmıyor; `BatchCardAssignDialog` `includeInactiveVisitorCards` göndermiyor.
  - Z-O3 tamam: Hik katalog modeli varsa her iki aile kabul ediliyor; QR/sanal önce eleniyor.
  - Z-O5 tamam: boş ama bitmemiş sayfada "Daha fazla kayıt tara" çıkıyor, sayaçlarda "+" var. `nextExpiry` ayrı ve sınırlı index sorgusuyla bulunuyor; `useVisitorClock` sözleşmesi aynı.
- **Gerileme yok:** sunucu filtresi, dört sayaç, sentetik e-posta gizleme, Erişim bölümünün üstte olması ve satır tıklama yerinde. Mobil `canAssignVisitorPreset` aktivasyonu ve `create` (pasif → `preRegistered`) değişmedi. Mobil uygulama `listPage/summary/getDetail` kullanmıyor.
- **Kurallar:** `any`/`!` yok, alanlar camelCase. Yeni testler `convex-test` ile gerçek handler davranışını sınıyor (yeni dosyalarda `vi.mock` 0).

## Bulgular
| ID | Önem | Worker | Dosya:satır | Sorun | Öneri |
|---|---|---|---|---|---|
| R-1 | Önemli | W4 | `convex/lib/visitorRetention.ts:20` | Bitişi geçmiş olsa da `visitorStatus === "preRegistered"` olan kayıt hiç silinmiyor. Kapsamda iki grup var: web'de erişimsiz oluşturulup hiç etkinleştirilmeyen ziyaretçiler (`visitors.ts:422`) ve Z-Y1 hatasıyla pasife alınıp "Ön kayıt" etiketi almış eski ziyaretçiler. Bu gruplarda KVKK saklama hedefi karşılanmıyor. Spec yalnız "bitişi gelecekte" ön kaydı korumayı istiyordu. | Ürün kararı (Emre): bitişi `cutoff`'tan eski `preRegistered` kayıtlar da silinsin mi? Evet ise süzgeç `preRegistered && bitiş >= cutoff` olarak daraltılır. Silme öncesi `previewVisitorRetention` ile sayı gösterilir. |
| R-2 | Küçük | W3 | `src/components/visitors/VisitorFormFields.tsx:49` | Ayarlar bağlantısı `<a href>`. Tam sayfa yenileme yapıyor, açık formdaki kaydedilmemiş girişler uyarısız kayboluyor. Projenin geri kalanı `Link` kullanıyor (ör. `EmployeeConsentsCard.tsx:158`). | `Link` + `target="_blank"` ya da form kirliyse onay iste. |
| R-3 | Küçük | W3 | `src/components/visitors/hooks/useVisitorFormData.ts:13` | Codegen yapılmadığı için `makeFunctionReference` ile elle tiplenmiş referans kullanılıyor. Sunucu dönüş tipi değişirse tsc bunu yakalamaz. | Yayındaki `npx convex dev --once` codegen'inden sonra `api.visitorHosts.search` kullan. |
| R-4 | Küçük | W2 | `convex/visitors.ts:265` | `maximumBytesRead: 512 KB` 2000 kayıttan önce dolar (ortalama ~260 B/belge). Gerçek tarama sınırı ~500–1000 kayıtta kalır. Metin `scanned` sayısını gösterdiği için yanlış bilgi vermiyor. | Bilinçli bırakılabilir; ya da bayt sınırını ~2 MB yap. |
| R-5 | Küçük | W4 | `src/components/settings/sections/privacy/VisitorNoticeCard.tsx:36` | Silinecek kayıt ön izlemesi yalnız ayar ilk kez doldurulurken çıkıyor. Süre kısaltılınca (ör. 365 → 30 gün) daha çok kayıt silinir, ama ön izleme görünmüyor. | `needsPreview` koşulunu "yeni değer eskisinden küçükse" de kapsayacak şekilde genişlet. |
| R-6 | Küçük | W4 | `convex/privacyRetention.ts:374` | Zincir sürerken gün ayarı değişirse cursor farklı bir aralıkla kullanılır. Convex geçersiz cursor hatası verir ve zincir o gün durur. Veri kaybı yok, ertesi gün devam eder. | Cursor ile birlikte `days` değerini de argüman olarak taşı ya da değer değiştiyse cursor'ı sıfırla. |
| R-7 | Küçük | W4 | `convex/privacyRetention.ts:390` | `removeRetainedVisitor` hata verirse (ör. taşıma kilidi, talep sınırı) iş sessizce düşüyor; kayıt her gün yeniden denenip yine başarısız oluyor. Görünür bir iz yok. | Hatayı yakalayıp audit/console'a "saklama silmesi atlandı" yaz. |
| R-8 | Küçük | W1 | `convex/cardReadings.ts:98` | Dinleme sırasında `by_device` aralığı nedeniyle cihazdaki HER okuma sorguyu yeniden çalıştırıyor. Her çalışmada 50 okumaya kadar ek `get` ya da `by_card` okuması yapılıyor. Pencere 30 sn ile sınırlı ama yoğun turnikede maliyet artar. | Kabul edilebilir. İstenirse ek okumayı yalnız `since` sonrası ilk birkaç adayla sınırla. |
| R-9 | Küçük | W1 | `src/components/visitors/lib/readerCapability.ts:16` | Model çözümü `hikModel` alanına bağlı. NGS0001'de `hikModel` boşsa cihaz, tip metni "Erişim Terminali" olmadığı sürece listede yine görünmez. | Tarayıcı turunda NGS0001'in "Kayıt okuyucusu" listesinde çıktığını doğrula; çıkmıyorsa cihazın modelini doldur. |
| R-10 | Küçük | W3 | `convex/visitorHosts.ts:22` | Arama index'leri yalnız `projectId` ile süzülüyor. `take(50)` sonrasında ziyaretçiler eleniyor; aynı adlı çok ziyaretçi varsa gerçek kişiler sonuçtan düşebilir. | Kabul edilebilir. Gerekirse search index'e `isVisitor` filtre alanı ekle (schema değişikliği). |

## Sonraki adım
Koordinatör R-1 kararını Emre'ye sorar; diğer bulgular denetim düzeltme turuna (W3: R-2/R-3, W4: R-5..R-7) ya da sonraya bırakılır.
