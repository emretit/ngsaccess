# Geçiş Kontrol Dalga 1 — A: Kapı Planları yanlış bilgi (04-H1, 04-H2)

## Hedef
Kapı planı dialoğu cihaza gitmeyen işlem için asla "cihaza uygulandı" demez; düğme cihaza gönderdiğini açıkça söyler ve kaydetmeden önce kapıya etkisini özetler; bekleyen/hatalı plan form yeniden açılınca da değişiklik yapmadan tekrar gönderilebilir.

## Ownership (yalnız bunlar)
- src/components/access-control/door-plans/DoorPlanDialog.tsx
- src/components/access-control/door-plans/DoorPlanDialog.test.tsx
- src/components/access-control/doorPlanResult.ts (+ doorPlanResult.test.ts)
- yeni dosya serbest: src/components/access-control/door-plans/DoorPlanImpactSummary.tsx (+ test)
Kapsam dışı: convex/ (backend değişmez), DoorPlansTab.tsx, CopyDoorPlansDialog.tsx, door-dialog/*, DoorStatusPlanEditor.tsx.

## İstenenler
1. **04-H1a sahte başarı:** `saveAction` içinde `updateDoor` boş `keys` dönerse (değişiklik yok) "kaydedildi ve cihaza uygulandı" bildirimi ÇIKMAZ. Bunun yerine: kapı bekleyen/hatalıysa (aşağıdaki 2) gönderimi tekrar dene; değilse "Değişiklik yok; cihaza bir şey gönderilmedi." bilgisi. `applySelectedDoorPlans([])` / `every` boş dizide true sorununu kaynağında çöz (boş sonuç "başarı" sayılmasın).
2. **04-H1b kalıcı tekrar gönder:** `door` prop'u zaten `plansPending` ve `hikPlanApplyError` taşıyor (`convex/doors.ts` listPlanTargets). Form açılışında bunlardan biri doluysa formun üstünde durum satırı göster ("Son gönderim başarısız: <hata>" / "Kaydedildi ama cihaza gönderilmedi") ve değişiklik yapmadan çalışan "Cihaza tekrar gönder" düğmesi sun (plan türleri: kapıda etkin olan status/verify; holiday status ile gider). Mevcut `retryAction` mantığını genelleştir.
3. **04-H2 düğme + etki özeti:** Gönder düğmesi metni "Kaydet ve cihaza gönder" ("Gönderiliyor…" bekleme metni). Düğmenin hemen üstünde, yalnız değişiklik varken, sade etki özeti: kapı adı + değişen planlar; durum planı için "Pzt–Cum 08:00–09:00 sürekli açık kalacak" / "sürekli kilitli kalacak" / "normal çalışır" gibi; doğrulama planı ve tatil planı için birer satır. "Sürekli açık" içeriyorsa cümle uyarı tonunda (text-warning). Haftalık planlarda gün aralıklarını kısa yaz (çok uzunsa "Haftalık · N aralık").
4. Dialog açıklaması: "Kapının zaman planlarını düzenleyin. Kaydettiğinizde plan hemen cihaza gönderilir."

## Kabul
- Test: değişiklik yokken Kaydet → başarı bildirimi yok + "Değişiklik yok" bilgisi.
- Test: `plansPending: true` veya `hikPlanApplyError` olan kapıda form açılınca "Cihaza tekrar gönder" görünür ve değişiklik olmadan çağrı yapar.
- Test: sürekli açık durum planı değişikliğinde özet metni ve düğme metni "Kaydet ve cihaza gönder".
- Mevcut DoorPlanDialog testleri yeşil (gerekirse yeni metne güncelle).
