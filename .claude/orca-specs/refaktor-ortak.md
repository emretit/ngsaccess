## ORTAK KURALLAR (tüm refaktör worker'ları)
- Çalışma dizini: /Users/emreaydin/ngsaccess (main, worktree YOK). Başka oturumlar aynı dizinde başka dosyaları değiştiriyor: YALNIZ "Ownership" listesindeki dosyalara yaz; listede olmayan hiçbir dosyaya dokunma (git status'taki diğer M dosyalar başkasının işi, geri alma/formatlama YOK).
- SAF REFAKTÖR: kullanıcıya görünen davranış, metinler, aria-label/role, className'ler, sorgu/mutation çağrı sayısı ve zamanlaması, effect bağımlılık semantiği BİREBİR aynı kalır. Yeni özellik, UX değişikliği, "bu arada düzeltme" YOK. Bug görürsen düzeltme, rapora yaz.
- Convex çağrı semantiği değişmez: imperatif `convex.query` → `useQuery`'ye ÇEVİRME (reaktif abonelik fonksiyon-çağrı kotasını artırır; Convex Free kota geçmişi var). Yeni Convex sorgusu ekleme. convex/ klasörüne dokunma.
- Proje kuralları: TS strict; `any`/`as any` yasak (unknown + narrowing); `!` non-null yerine optional chaining + erken return; Convex sonuç tipleri için `FunctionReturnType<typeof api.X.Y>`. Mevcut kod stilini (isimlendirme, yorum yoğunluğu, Türkçe UI metni) koru.
- Test dosyaları: mevcut testlerin import yolu kırılırsa ya re-export bırak ya da yalnız import satırını güncelle; test beklentisi (assertion) DEĞİŞTİRME. Yeni saf yardımcı çıkarırsan küçük birim testi ekleyebilirsin.
- Kapılar (hepsini kendin koş, çıktıyı rapora yaz):
  1. `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0 hata (başlangıç tabanı 0; senin dosyan dışında hata çıkarsa düzeltme, rapora yaz).
  2. `node_modules/.bin/eslint <senin dosyaların>` → 0 error.
  3. Spec'te verilen vitest komutu → yeşil.
- commit / push / deploy / migration / DB yazma / `npx convex ...` YOK.
- Rapor (worker_done, ≤10 satır): yeni dosya listesi + satır sayıları (önce→sonra), kapı sonuçları, bilinçli olarak korunan tuhaflıklar/bug şüpheleri (file:line). Ayrıca aynı içeriği spec'te verilen rapor yoluna yaz.
