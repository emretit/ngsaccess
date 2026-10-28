# Geçiş Kontrol Dalga 3 — D: Yetki Durumu etkileşim, yetki, odak, mobil

## Hedef
Yetki Durumu'nda filtreler tek tıkla temizlenir, yeniden gönderim onayı somut hedefleri gösterir, yetkisi olmayan kullanıcıya çalışmayacak düğme sunulmaz, odak kaybolmaz ve mobilde arama ile sonuçlar öne gelir.

## Ownership (yalnız bunlar; testleri dahil)
- src/components/access-control/unified/status/StatusPage.tsx, StatusFilters.tsx, StatusResults.tsx (+ test), StatusViews.tsx, StatusCounters.tsx, RedistributeControls.tsx, EmployeeGrantSheet.tsx, model.ts, useRedistribution.ts, useStatusData.ts (+ status.test.tsx; yeni test serbest)
Kapsam dışı: RunNotice.tsx (A), src/components/shared/FilterBar.tsx (paylaşılan — değişiklik gerekiyorsa ask), convex/ (backend değişmez), templates/, rules-list/, door-*.

## İstenenler
1. **03-O3:** FilterBar'ın `onClear`/`hasFilters` desteğini bağla (tüm filtre + arama temizlenir). Filtre değişince açık cihaz kartı, seçili cihaz hâlâ kapsamdaysa açık kalır.
2. **03-O4:** Seçili kayıt onayında kişi ve cihaz adları (ilk 5 + "ve N kayıt daha") ve proje adı; düğme metni "Seçili N kaydı yeniden gönder". "kişi×cihaz" ifadesi kalmasın.
3. **03-O5:** "Tümünü yeniden dağıt" backend'de `devices.manage` istiyor (`convex/accessGrantStatus.ts:226`). `usePermissions().can("devices.manage")` yoksa düğmeyi gizle ya da devre dışı bırakıp yanında "Bu işlem için cihaz yönetimi yetkisi gerekir" yaz. Seçili/hatalı gönderim `accessRules.manage` ile kalır.
4. **03-O6:** Kişi ayrıntısı (EmployeeGrantSheet) kapanınca odak açan öğeye döner (ref sakla ya da SheetTrigger).
5. **03-O7:** Mobil kayıt seçim kutusu etiketiyle birlikte en az 44px etkileşim alanı ("Seç" gerçek label).
6. **03-O8 mobil öncelik:** 390px'te arama en üstte; ikincil filtreler "Filtreler (n)" açılır panelinde (n = etkin filtre sayısı); toplu gönderim düğmeleri seçim yapılınca görünen işlem çubuğunda, "Tümünü yeniden dağıt" gibi bakım işlemleri ikincil (menü ya da altta). Masaüstü düzeni korunur.

## Kabul
- Test: temizle tüm filtreleri ve aramayı sıfırlar; kapsamdaki cihaz kartı filtre değişiminde açık kalır.
- Test: onay metni kişi/cihaz adlarını ve "Seçili N kaydı yeniden gönder"i içerir.
- Test: devices.manage yokken Tümünü yeniden dağıt çalıştırılamaz (gizli ya da disabled + açıklama).
- Test: sheet kapanınca odak geri döner (mümkünse; değilse odak hedefi ref'inin çağrıldığını sına).
- Mevcut status testleri yeşil (Dalga 1/2: rozet=filtre=sayaç, aria-pressed, Proje özeti, Filtre sonucu).
