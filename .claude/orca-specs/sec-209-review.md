# SEC-209 denetimi (Claude, salt okuma) — 2026-11-25

**Sonuç:** Engel yok. Ham storageId ile sahiplenme IDOR'u (bir kullanıcının başka birinin dosyasını kendi dosyası gibi kaydetmesi) kapandı: `pendingUploads` satırı artık yalnız `files.upload` action'ının o anda kendi ürettiği blob için yazılıyor. 3 düşük öncelikli düzeltme + birkaç not var.

Koşulan: `vitest run convex/files.test.ts convex/files.requestAttachments.test.ts convex/reports.cardless.test.ts convex/lib/gatewayCommand.captureAuthorization.test.ts` → 4 dosya, 28/28 geçti.

## Engel
Yok.

## Doğrulananlar (odak 1-6)
1. **IDOR kapandı mı — evet.** `pendingUploads` insert'i tek yerde: `registerUpload` ([convex/files.ts:47](convex/files.ts:47)), internal ve yalnız `upload` içinden yeni `storage.store` ID'siyle çağrılıyor. `claimUpload` artık insert etmiyor, yalnız sahip kontrolü ([convex/files.ts:62](convex/files.ts:62)).
   - `saveUserPhoto` ([files.ts:72-73](convex/files.ts:72)): pending sahibi şart, kullanınca siliniyor → başka kullanıcı ya da 2. kullanım reddediliyor.
   - `getUploadUrl` ([files.ts:89-95](convex/files.ts:89)): personele bağlıysa o projede `employees.manage`, değilse pending sahibi şart. Yüz blob'u (`employeeFaces.pictureStorageId`), başkasının profil fotosu, talep eki → hepsi ret.
   - Personel fotosu `claimEmployeePhoto` ([convex/lib/peoplePhoto.ts:6-13](convex/lib/peoplePhoto.ts:6)): pending sahibi, ya da pending yoksa aynı personele zaten bağlı olmalı; başka personele bağlı blob ret.
   - Yüz akışı (`employeeFaces.savePhoto`) zaten kendi bytes action'ı; storageId istemciden alınmıyor, etkilenmedi.
   - Rıza belgesi: `documentStorageId` yazan kod yok (personel rızası kaldırılmıştı); yalnız okuma/koruma kontrolleri duruyor.
   - Eski açığın en kötü sonucu da kapandı: eski `claimUpload` ile yabancı yüz blob'u claim edilirse 24 saat sonra `cleanupPendingUploads` o blob'u **silerdi** (yüz blob'u personel/ kullanıcıya bağlı görünmüyor).
2. **Yetki:** `authedAction` girişte `requireCurrentUser` (verified kontrolü dahil) koşuyor; `registerUpload` kimliği tekrar `getCurrentUser` ile auth'tan türetiyor (userId argüman olarak alınmıyor → taklit edilemez). Rol/üyelik kontrolü yükleme anında yok, tüketen mutation'larda var — tasarım gereği doğru (bkz. D2 kota).
3. **Temizlik:** kayıt hatasında blob siliniyor ([files.ts:40-42](convex/files.ts:40)), testli. Yarış: pending tüketimi OCC (Convex'in çakışan yazımları sıraya alması) ile tek transaction'da; aynı pending iki yerde tüketilemez.
4. **İstemciler:** `generateUploadUrl` / `files:claimUpload` / `files:upload` için `src`, `mobile/lib` ve repo genelinde (node_modules hariç) kod çağrısı yok; yalnız `.claude/` ve `docs/` metinleri. Talep eki kendi `requestAttachments.beginUpload` + HTTP proxy akışını kullanıyor, dokunulmamış.
5. **Boyut:** sunucuda 1 B – 5 MiB ([files.ts:26](convex/files.ts:26)); Convex fonksiyon argüman sınırı 16 MiB'ın altında (base64 ile ~6,7 MB). Varsayılan runtime'da 5 MiB + Blob kopyası bellek açısından sorun değil. `files.ts`'te Node modülü importu yok, "use node" gerekmiyor.
6. **Akışlar bozulmadı:** personel formu (upload → getUploadUrl → employees.update tüketir) ve profil (upload → saveUserPhoto) testli; talep eki testi güncel; `reports.ts` boş kart değişikliği doğru (boş kartlı ziyaretçi artık boş `cardNo` okumalarını yutmuyor).

## Düzeltilmeli (düşük)
- **D1 — Eski (deploy öncesi) pending satırları:** [convex/files.ts:102-123](convex/files.ts:102). Eski `claimUpload` ile yabancı blob'a açılmış satırlar deploy sonrası ≤24 sa geçerli kalır; o sürede `getUploadUrl` URL verir, süre dolunca `cleanupPendingUploads` yüz blob'unu (`employeeFaces.pictureStorageId`) veya talep ekini silebilir — temizlik bu iki tabloyu kontrol etmiyor.
  *Düzeltme:* temizliğe `employeeFaces` (pictureStorageId) ve `requestAttachments` (`by_storageId`) referans kontrolü ekle (varsa yalnız satırı sil). Deploy anında `pendingUploads` satır sayısına bakmak da yeter (genelde 0-birkaç satır olur).
- **D2 — Kota/oran sınırı yok:** [convex/files.ts:23-53](convex/files.ts:23). Proje üyeliği olmayan, doğrulanmış her kullanıcı sınırsız sayıda 5 MiB dosya yükleyip `getUploadUrl` ile 24 saat herkese açık URL alabiliyor (geçici dosya barındırma + depolama/bant kotası yakma). Eski akıştan daha iyi (eskiden boyut sınırı hiç yoktu) ama hâlâ açık.
  *Düzeltme:* `registerUpload` içinde kullanıcının son 24 saatteki pending sayısına sınır koy (ör. `by_user` index'iyle ≥20 ise reddet; şema index'i ister) ya da en azından `by_created` + userId filtresiyle say.
- **D3 — Foto tüketicileri PDF kabul ediyor:** `upload` PDF'e izin veriyor ama PDF'i kullanan bir akış kalmadı (rıza belgesi kaldırıldı). `saveUserPhoto` ve `claimEmployeePhoto` içerik türünü kontrol etmiyor → PDF profil/personel fotosu olarak kaydedilebiliyor (kırık avatar; personel fotosu cihaza gidiyorsa cihaz hatası).
  *Düzeltme:* PDF'i `upload`'dan çıkar ya da [files.ts:72](convex/files.ts:72) ve [peoplePhoto.ts:9](convex/lib/peoplePhoto.ts:9) sonrasına `(await ctx.db.system.get(id))?.contentType.startsWith("image/")` kontrolü ekle.

## Not
- **N1 — Yayın sırası:** Convex önce yayınlanırsa açık sekmelerdeki eski web paketi `files:generateUploadUrl` bulamaz → foto yükleme sayfa yenilenene kadar hata verir. Convex + web aynı oturumda yayınlanmalı. Mobil etkilenmiyor.
- **N2 — `claimUpload` artık ölü kod:** istemci çağrısı yok, yalnız kontrol yapıyor (zararsız). Kaldırılabilir; testler onu import ediyor.
- **N3 — Magic byte kontrolü yüzeysel:** JPEG 3 bayt, PDF 5 bayt başlığa bakıyor; polyglot (hem resim hem HTML gibi görünen) dosya geçer. Dosyalar Convex storage alan adından doğru Content-Type ile sunulduğu için uygulama origin'ine XSS (sayfaya zararlı script enjekte etme) riski düşük.
- **N4 — Yetim blob:** `store` başarılı olup action `registerUpload`'dan önce zaman aşımına/çökmeye uğrarsa blob pending'siz kalır ve hiç temizlenmez. Düşük olasılık; kabul edilebilir.
- **N5 — `ctx.storage.delete` hata verirse** catch içindeki asıl hata maskelenir ([files.ts:41](convex/files.ts:41)); `try { await delete } catch {}` ile sarmak daha temiz.
