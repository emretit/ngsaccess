# Geçiş Kontrol Dalga 3 — A: Kurallar etkileşim + mobil sekmeler

## Hedef
Kurallar listesinde orta/küçük ekranda "ne zaman" bilgisi her kuralda görünür, ayrıntı çekmecesinden doğrudan düzenlenebilir, sekme şeridi mobilde tek satır ve dokunulabilir olur, son gönderim kartı teknik ifade içermez.

## Ownership (yalnız bunlar; testleri dahil)
- src/components/access-control/unified/rules-list/RuleRow.tsx, RulesPage.tsx, accessRulesListModel.ts (+ testleri; yeni test serbest)
- src/components/access-control/unified/UnifiedAccessControl.tsx
- src/components/access-control/unified/SyncRuns.tsx (+ SyncRuns.test.tsx), unified/lib/presentation.ts (+ test), unified/status/RunNotice.tsx (+ test)
Kapsam dışı: rules-list/RulesFilters.tsx (BAŞKA OTURUM — 01-O3 bu dalgada yok), status/ diğerleri (D), templates/ (B), door-plans/, door-dialog/ (C1/C2), convex/.

## İstenenler
1. **01-O2:** 1280px altında özel saatli kuralların gün/saat bilgisi satırda görünür (şablonlu kuraldaki `xl:hidden` alt satır gibi; `formatWeekdaysAbbr` + saat, mevcut yardımcıları kullan).
2. **01-O6:** Ayrıntı çekmecesi başlığında "Düzenle" düğmesi (yalnız canManage); satır menüsündeki düzenleme akışını yeniden kullan, çekmece kapanıp düzenleme açılır.
3. **01-D1:** Sekme şeridi mobilde tek satır, yatay kaydırılabilir; sekmeler `min-h-11`. Masaüstünde görünüm değişmez.
4. **Son gönderim kartı:** "N gönderildi (teslim kanıtı yok)" → sade: ör. "N kayıt cihaza gönderildi" (teslim teyidi IDE'de ayrıca gösteriliyorsa onu bozma). `grep -n "teslim kanıtı"` ile kullanıcıya görünen kalmasın.

## Kabul
- Test: özel saatli kural satırında küçük ekran alt satırı gün/saat metnini içerir.
- Test: canManage iken çekmecede "Düzenle" var ve düzenleme açma işlevini çağırır; değilken yok.
- Test: kullanıcı metninde "teslim kanıtı" yok.
