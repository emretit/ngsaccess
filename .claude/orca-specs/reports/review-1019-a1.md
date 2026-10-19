# R-A1 — Çıkış yarışı salt-okuma denetimi
Normal kullanıcı çıkışı ve verified=false çıkışı için çift orphan tetiklenmesi kapanıyor.
Başarılı çıkışta kalıcı true ref akışı saptanmadı; hata sonrası yeniden değerlendirme garantisi eksik.
Rıza sınırının çalışan kimliğiyle yeniden kurulması uygun; 21 test ve TypeScript kontrolü geçti.
Yayın 4'e engel: YOK — normal akışta engelleyici regresyon saptanmadı; aşağıdaki hata dayanıklılığı/test açıkları kalıyor.

## Bulgular
- Orta (engelleyici değil) · `src/components/auth/AuthProvider.tsx:94-98,155,226-228` · Orphan kontrolü signingOut=true iken atlanır, ardından çıkış reddedilirse yalnız ref sıfırlanır; aynı auth/user/route değerlerinde effect yeniden çalışmaz. Yerel SDK sunucu hatasını yutar fakat token depolama silmesi reddedilebilir (`node_modules/@convex-dev/auth/src/react/client.tsx:100-120,264-274`); böylece null profilin temizliği sonraki bağımlılık değişimine kalabilir. Öneri: hata temizliğinde state/retry sayacıyla değerlendirme tetikleyin; ref'i dependency listesine eklemek çözmez.
- Düşük · `src/components/auth/registrationFlow.test.ts:33-52` · Yeni test yalnız saf predicate'i doğruluyor; gerçek AuthProvider effect sırası, çıkış reddi ve yeniden giriş sınanmıyor. Öneri: kontrollü signOut promise'iyle user=null → resolve/reject → auth=false → yeni oturum senaryolarını bileşen düzeyinde test edin.
- Düşük · `src/components/employees/EmployeeDetails.test.tsx:27-36` · Statik render testleri çalışan değişiminde açık form/hata durumunun sıfırlandığını kanıtlamıyor. Öneri: aynı mount içinde çalışan kimliğini değiştirerek rıza/iptal diyaloğu ve boundary hatasının temizlendiğini doğrulayın.

## Soruların yanıtı
1. `AuthProvider.tsx:83-88,222-225` ref'i ağ çağrısından önce senkron set eder; sunucunun user=null güncellemesi `registrationFlow.ts:40` üzerinden bastırılır. verified=false dalı da aynı korumayı kullanır.
2. Başarılı SDK signOut tokenState=null yazar (`node_modules/@convex-dev/auth/src/react/client.tsx:264-274,100-120`); useConvexAuth false üretir (`node_modules/convex/src/react/ConvexAuthState.tsx:107-121`), effect ref'i sıfırlar (`AuthProvider.tsx:149-155`). Normal başarıda atlanan orphan kontrolünü yeniden yapmak gerekmez; oturum kapanmıştır.
3. Sekmelerde storage olayı token durumunu eşler (`node_modules/@convex-dev/auth/src/react/client.tsx:150-172`); başka cihazdaki silinme bu ref'i set etmez (`AuthProvider.tsx:86,223`). Normal yeniden girişten önce false geçişi reset sağlar; eşzamanlı giriş/çıkışın false geçişini gözlemletmediği sıra için bu değişiklik ek garanti sunmuyor. Başarılı çıkışın hiçbir zaman false olmaması, incelenen normal SDK yoluyla desteklenmiyor.
4. Reset effect'in yükleme/kayıt/kurulum erken dönüşlerinden sonradır (`AuthProvider.tsx:68-73,149-152`); bu nedenle false geçişinin mutlaka işlendiği bir yaşam döngüsü testi yararlı olur. Hata sonrası ref-only reset için otomatik yeniden değerlendirme yoktur (ilk bulgu).
5. `EmployeeDetails.tsx:131-138` anahtarı aynı çalışan güncellenirken sabittir; yalnız çalışan değişince boundary ve rıza alt ağacı remount olur. Böylece `EmployeeConsentsCard.tsx:65-71` form state'i ve `EmployeeActivityBoundary.tsx:11,54` hata/deneme state'i sıfırlanır; diğer bölümler etkilenmez. Başlatılmış mutation iptal edilmez, eski closure eski employeeId ile tamamlanır (`EmployeeConsentsCard.tsx:84-99`); yeni çalışana yönelmez.

## Doğrulama
- `node_modules/.bin/vitest run src/components/auth src/components/employees` → exit 0; 5 dosya, 21/21 test geçti.
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → exit 0; çıktı/hata yok.
- Kaynaklar değiştirilmedi; yalnız bu rapor yazıldı. Tarayıcı/canlı servis kullanılmadı.

Yayına engel: YOK
