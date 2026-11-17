# PDKS Faz C — legacy projeleri tarihli requirements kuralına geçirme aracı

## Hedef
Eski (legacy) punchMode'daki projeleri 2026-11-18'den itibaren "requirements" kuralına geçiren, geçmişi koruyan bir internal migration yazılır. KOŞULMAZ; koordinatör onayla koşar.

## Bağlam
- pdksRuleVersions (convex/schema.ts:~280-291): effectiveFrom + punchMode ("legacy"|"requirements"), index by_projectId_and_effectiveFrom.
- convex/lib/pdksRules.ts loadPdksRulePolicy tarihli sürümü çözer; LEGACY_PDKS_POLICY varsayılan.
- convex/lib/pdksEvidence.ts:~44-55: legacy tek okutmayı giriş sayar; requirements incelemeye ayırır.

## İstenen
1. convex/dataMigrations.ts'e:
   - previewPdksRequirementsSwitch (internalQuery, salt-okuma): hangi projeler legacy, son sürümleri.
   - switchProjectsToRequirements (migrations.define ya da internalMutation, idempotent).
2. Her legacy proje için effectiveFrom "2026-11-18" YENİ sürüm: son sürümün tüm alanlarını ve hedef seçimlerini (pdksCheckpointSelections kopyası) koru; yalnız punchMode="requirements" ve requirements alanlarının güvenli varsayılanları (giriş+çıkış zorunlu, eksik/okutmasız gün "review"; şemadaki gerçek alan adlarını kullan).
3. Hiç sürümü olmayan proje: legacy varsayılandan türetilmiş requirements sürümü, aynı tarih.
4. Zaten requirements olan ya da o tarihte sürümü olan projeyi atla. Geçmiş sürümler DEĞİŞMEZ.
5. UI'nin kullandığı mevcut sürüm oluşturma mantığı varsa onu yeniden kullan; kopya mantık yazma.

## Ownership
convex/dataMigrations.ts, yeni convex/pdksRequirementsSwitch.test.ts (ad serbest), gerekirse convex/lib/pdksRuleWrite*.ts.
Kapsam dışı: convex/schema.ts (Faz D değiştiriyor — YAZMA), pdksDay.ts (Faz A), dashboard.ts (Faz B).

## Zorunlu test
- legacy proje → 2026-11-18 requirements sürümü, hedef seçimleri kopyalanmış
- 2026-11-17 günü legacy davranış, 2026-11-18 günü tek okutma incelemeye düşer
- ikinci koşum değişiklik yapmaz

Ortak kurallar: .claude/orca-specs/pdks-ortak-kurallar.md dosyasını OKU ve uygula.
