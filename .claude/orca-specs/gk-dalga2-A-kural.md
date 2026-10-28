# Geçiş Kontrol Dalga 2 — A: Kurallar metin/terim + ortak şablon seçici boş durumu

## Hedef
Kurallar sekmesinde kullanıcıya görünen metin sade ve tek terimli ("cihaz") olur, tekrar eden başlık/sayaç kalkar, ve ortak `TemplatePicker` projede şablon yokken ne yapılacağını söyleyip Zaman Şablonları'na yol verir.

## Ownership (yalnız bunlar; testleri dahil)
- src/components/access-control/unified/AccessRulesList.tsx
- src/components/access-control/unified/rules-list/* (RulesPage.tsx, RulesEmptyState.tsx vb.)
- src/components/access-control/unified/AccessRuleDetails.tsx
- src/components/access-control/unified/CreateRuleDialog.tsx (+ CreateRuleDialog.test.tsx)
- src/components/access-control/unified/SyncRuns.tsx (+ SyncRuns.test.tsx)
- src/components/access-control/unified/status/RunNotice.tsx (+ RunNotice.test.tsx)
- src/components/access-control/unified/lib/presentation.ts (+ presentation.test.ts)
- src/components/access-control/unified/components/ZoneDeviceTree.tsx, DepartmentTree.tsx, TimeSchedule.tsx (+ testleri)
- src/components/access-control/unified/templates/TemplatePicker.tsx (+ yeni test serbest)
- src/components/access-control/unified/UnifiedAccessControl.tsx (yalnız sekmeye gitme yolu gerekiyorsa)
Kapsam dışı: status/ altındaki diğer dosyalar (B), templates/ altındaki diğerleri (B), door-plans/, door-dialog/, DoorStatusPlanEditor.tsx (C), convex/.

## İstenenler
1. **01-O4 sade metin:** SyncRuns SheetDescription ve ProjectSyncButton onay metni teknik değil: ör. "Cihaz aldığını bildirene kadar 'Gönderildi' görünür." (Hikvision/IDE teslim kanıtı cümleleri kalkar). Sihirbaz alt özeti "1 kişi · 2 kapı · Pzt–Cum tüm gün" biçiminde; "panel", "açık kapı seçimi" yok.
2. **01-O8 terim:** Bu dosyalarda kullanıcıya görünen "panel" → "cihaz" (ör. arama "Kapı, panel veya bölge ara" → "Kapı, cihaz veya bölge ara"; AccessRuleDetails:~87; ağaç etiketleri). Ağaç veri yapısını değiştirme, yalnız metin. `grep -n -i panel` ile kalan kullanıcı metni kalmadığını doğrula (kod/değişken adları kalabilir).
3. **01-D2:** Liste üstündeki "Bu sayfada N kural" sayacını kaldır (sayfalama satırı zaten sayıyı veriyor).
4. **01-D3:** Sihirbazda adım başlığı ile ağaç iç başlığı tekrarı ("Kimler erişebilir?" + "Kim erişebilecek?", "Nerede ve ne zaman?" + "Hangi kapılarda?"): görünür iç başlık kalkar, adım başlığı kalır; ağaç grubunun erişilebilir adı (aria-label) korunur.
5. **TemplatePicker boş durumu (01-O5 / 02-O2 / 04-O8):** seçilebilir şablon yokken açılır liste yerine/altında: "Bu projede henüz zaman şablonu yok." + "Zaman şablonu oluştur" eylemi → Zaman Şablonları sekmesine gider. Gitme mevcut `onEdit(navigate)` deseniyle olur (çağıran kaydedilmemiş değişiklik onayını kendisi yönetir; CreateRuleDialog ve DoorPlanDialog/CopyDoorPlansDialog bunu zaten bağlıyor — çağıran dosyaları değiştirmeden çalışmalı; değişiklik gerekiyorsa ask). Kullanılan sorgu/argüman değişmesin (CreateRuleDialog aynı aboneliği paylaşıyor). Metin bağlamdan bağımsız olsun ("Özel saat" demesin; CopyDoorPlansDialog da kullanıyor).
6. **Sekme başlığı:** Kurallar sekmesindeki "Geçiş Kontrol" H1 → ortak kalıp ("Kurallar" + açıklama). Sağdaki düğmeler yerinde kalır.

## Kabul
- Test: TemplatePicker şablon listesi boşken "Bu projede henüz zaman şablonu yok" ve oluştur eylemi görünür, eylem onEdit'i çağırır; liste doluyken görünmez.
- Test: sihirbaz alt özeti "panel" içermez ve kişi · kapı · gün biçimindedir.
- Test: Kurallar listesinde "Bu sayfada" yok.
- Mevcut testler yeşil (metin değiştiyse güncelle).
