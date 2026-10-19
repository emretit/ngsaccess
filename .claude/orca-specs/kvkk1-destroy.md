# Worker B — Biyometrik şablon imha aracı + imha tutanağı
ÖNCE `.claude/orca-specs/kvkk1-common.md` oku (zorunlu). Bu iş GERİ ALINAMAZ silme içerir: tasarım temkinli, kod canlıya hiç çalıştırılmaz.

**Hedef:** Yetkili yönetici, seçili projenin yüz ve/veya parmak izi şablonlarını önce sayım (kuru çalışma) görerek, yazı ile onaylayıp toplu siler (Convex kayıtları + storage dosyaları + cihazlar);
her çalıştırma denetim kaydına imha tutanağı olarak düşer ve ekranda özetlenir.

## Ownership (yalnız bunlara yaz)
- `convex/biometricDestruction.ts` (YENİ: public `previewBiometricDestruction` adminQuery, `startBiometricDestruction` adminMutation, `getDestructionRun` adminQuery; internal batch mutation/action'lar)
- `convex/lib/biometricDestruction.ts` (+test) (YENİ: saf plan/özet/tutanak metni mantığı)
- `convex/_generated/api.d.ts` (yalnız kendi modül satırı), `convex/actions/biometricDestruction.ts` (YENİ; cihaz tarafı için, `"use node"` kuralına dikkat)
- `src/components/settings/sections/privacy/BiometricDestructionCard.tsx` (+ test)
- İzin: `convex/employeeFaces.ts`/`employeeFingerprints.ts`/`lib/employeeCascade.ts`/`actions/hikvisionSync.ts` OKU; yazma YOK (Worker A bunlara kapı ekliyor). Cihaz silme için mevcut
  `deleteEmployeeFaceFromDevicesInternal` ve parmak izi karşılığını ÇAĞIR.
- Tutanak kalıcılığı için yeni tablo gerekirse `ask` + TAM tanım (schema koordinatörde); varsayılan çözüm = `auditLog` kaydı (`writeAudit`, `targetTable: "biometricDestruction"`).

## Davranış
1. `previewBiometricDestruction({ projectId, kinds: ("face"|"fingerprint")[] })` → `{ faceCount, fingerprintCount, employeeCount, storageFileCount }`. Yalnız sayar (sınırlı tarama; çok büyükse alt sınır + `capped: true` döner), YAZMAZ.
2. `startBiometricDestruction({ projectId, kinds, confirmText, reason })`: `confirmText` sunucuda doğrulanır (tam metin: proje adı; farklıysa hata); `reason` 3–500 karakter zorunlu.
   Önce audit "başladı" kaydı + `destructionRun` benzeri durum (auditLog ile izlenebilir ya da koordinatörün onayladığı tablo); sonra batch'ler (≤100 kayıt/transaction) kendini `scheduler.runAfter(0)` ile sürdürür:
   `employeeFaces` satırı + `pictureStorageId` (`ctx.storage.delete`, dosya yoksa atla), `employeeFingerprints` satırı. Çalışan kaydı, kart numarası, rıza kayıtları, okuma geçmişi SİLİNMEZ.
3. Cihaz tarafı: silme Hik cihazlarına mevcut op kuyruğu üzerinden (`deleteFace`/`deleteFingerprint`) gönderilir; cihaz hatası Convex silmesini GERİ ALMAZ ama tutanakta "cihaz silmesi başarısız: N" olarak görünür.
   Silme sırası: önce cihaz op'ları kuyruğa alınır (storage/şablon verisi gerekiyorsa silinmeden ÖNCE okunur — Hikvision scheduler'ın silinmiş kayıtları okuyamama riskine dikkat, `lib/peopleHikSnapshot.ts` kalıbına bak), sonra Convex silinir.
4. Tutanak: bitince `writeAudit` kaydı `{ projectId, kinds, silinenYuz, silinenParmak, silinenDosya, cihazOpSayisi, cihazHata, baslangic, bitis, gerekce }` + kullanıcı. Kart, son çalıştırma özetini gösterir.
5. Yetki: adminMutation + `getProjectIdsForUser` içinde proje; aynı proje için eşzamanlı ikinci çalıştırma reddedilir (basit kilit: aktif run varsa hata).
6. `BiometricDestructionCard`: türler (yüz / parmak izi) seçimi → "Sayım göster" → sonuç → gerekçe + proje adını yazarak onay (`ConfirmDestructive` kalıbı) → ilerleme → tutanak özeti. Yıkıcı düğme `destructive` tonunda, sayım görülmeden aktif olmaz.
   Metin: "Bu işlem geri alınamaz. Çalışan, kart ve okuma geçmişi silinmez; yalnız biyometrik şablonlar silinir." Yasal danışman notu ekle.

## Kapsam dışı
Modül açma/kapama (Worker A). Saklama süresi (Worker C). Çalışan profil fotoğrafı (`employees.photoUrl/photoStorageId`) — biyometrik şablon sayılmaz, SİLME. Canlıya çalıştırma.
Testler: `lib/biometricDestruction.test.ts` (plan, batch bölme, confirmText doğrulama, tutanak özeti), `BiometricDestructionCard.test.tsx` (sayım olmadan düğme pasif, yanlış metinde pasif).
