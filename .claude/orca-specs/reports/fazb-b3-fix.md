# Faz B — B3-fix sarkan bağ ve izin kilidi regresyonları

## TAM değişen dosya listesi (bu görev)
- convex/accessRules.ts
- convex/leaves.ts
- convex/orphanGuards.test.ts
- .claude/orca-specs/reports/fazb-b3-fix.md (istenen rapor)

## Değişiklikler
- convex/accessRules.ts:760,1232,1349 — remove/removeGroupMember/removeGroupDevice silinmiş çalışanı atlar; mevcut çalışanın erişimini canAccessEmployeeProject ile doğrular.
- convex/accessRules.ts:766,772,1247,1256,1355,1364 — silinmiş kapı/panel/cihaz yetki hatası üretmez; mevcut kayıtların proje kontrolleri ve bağların kendi proje kontrolleri korunur.
- convex/accessRules.ts:1229 — removeGroupMember için super_admin dışındaki rollerin üye/kural proje eşitliği zorunlu; remove ile aynı sözleşme.
- convex/leaves.ts:257 — approve proje eşitliğinden yalnız super_admin muaf; çalışan ve izin projesi erişimleri korunur.
- convex/leaves.ts:267 — reject proje eşitliği kaldırıldı; izin projesi ve mevcut çalışan erişimi kontrolleri korunur.
- convex/orphanGuards.test.ts:155,208,255 — eski 273 senaryo korundu; reject eşitlik beklentisi yeni sözleşmeye uyarlandı; 34 yeni senaryo eklendi (toplam 307).
- Testler gerçek handler ve yetki yardımcılarını kullanır; dış cihaz sync'i ve kayıt/auth sarmalayıcısı önceki test düzeneğiyle mock kalır.
- Silinmiş kaynak testleri iki yönetici rolü × üç silme işlemi × dört kaynak yolu içerir; rule silmede tüm sarkan bağların, cihaz bağı silmede mevcut kapının stale bağının temizliği doğrulanır.
- Proje değiştiren/orphan çalışanın eski izninde super_admin onay/red pozitif; project_admin erişim dışı çalışan veya izin için sıfır yan etkiyle reddedilir.

## Kapılar (son koşu, tümü exit 0)
- node_modules/.bin/tsc --noEmit -p tsconfig.app.json → çıktı yok.
- node_modules/.bin/tsc --noEmit -p convex/tsconfig.json → çıktı yok.
- node_modules/.bin/eslint convex/accessRules.ts convex/leaves.ts convex/orphanGuards.test.ts → hata/uyarı yok.
- node_modules/.bin/vitest run convex/orphanGuards.test.ts convex/lib/shiftAssign.test.ts convex/lib/leaveValidation.test.ts → 3 dosya / 371 test geçti.
- node_modules/.bin/vitest run → 151 dosya / 1849 test geçti.
- git diff --check -- convex/accessRules.ts convex/leaves.ts convex/orphanGuards.test.ts → temiz.
- Üretim düzeltmesinden önce yeni senaryolar 28 hata verdi; düzeltmeden sonra tümü yeşil.

## Açık kalan / riskler
- Engelleyici açık bulgu yok; dönüş şekilleri değişmedi, veritabanına/canlı API'ye yazılmadı; git commit yapılmadı.
- Önceden var olan B3 ve diğer oturum değişiklikleri korunmuştur; kapsam dışı üretim/test dosyalarına yazılmadı.
- Kapı/cihaz silme kaskadı kapsam dışı: üyelik silme diğer bağları silmez; cihaz bağı silmede kapısı zaten silinmiş groupDoors bağı mevcut helper davranışıyla kalabilir, kural silme tüm bağları temizler.
- Proje değiştiren mevcut çalışanın erişimi project_admin için fail-closed kalır; iki projeye erişimi olan project_admin eski izni reddedebilir, onay için eşitlik gerekir.
