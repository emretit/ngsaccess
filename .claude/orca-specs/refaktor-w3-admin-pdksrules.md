# Refaktör W3 — Proje yönetimi paneli + PDKS kural ayarları

Hedef: iki dosya alt dosyalara bölünür, davranış birebir aynı kalır, `PdksRulesSettings.test.tsx` yeşil kalır.

## A) src/components/admin/AdminProjectsPanel.tsx (565 satır)
Zaten ProjectEditor / ProjectDeletion / AdminProjectsContent iç bileşenleri var. Bunları ayrı dosyalara taşı (src/components/admin/projects/ altında: ProjectEditor.tsx, ProjectDeletion.tsx, projectSchema.ts, ProjectsTable.tsx gibi). AdminProjectsPanel.tsx'in dışa açık export'ları (grep ile kontrol et) aynı kalır.

## B) src/components/settings/sections/components/PdksRulesSettings.tsx (600 satır)
1. Saf model: `tomorrowInTurkey`, `pdksRuleSchema`, `recommendedPunchRules`, `pdksPublishPayload`, `ruleSummary`, tipler → `pdksRulesModel.ts` (aynı klasör). PdksRulesSettings.tsx bunları RE-EXPORT eder (test ve diğer importer'lar kırılmasın).
2. `RulesEditor` (~350 satır JSX) → bölüm bileşenleri (ör. hedef seçimi, kural alanları, yayın/silme onayı AlertDialog'u). `pending`/`error`/`success`/`confirmation` akışı ve publish/remove mutation çağrıları AYNEN.

Ownership (yalnız bunlara yaz):
- src/components/admin/AdminProjectsPanel.tsx + YENİ src/components/admin/projects/*
- src/components/settings/sections/components/PdksRulesSettings.tsx + YENİ aynı klasörde pdksRules*.ts(x) dosyaları
- PdksRulesSettings.test.tsx: YALNIZ import yolu kırılırsa import satırı
- DOKUNMA: src/components/settings/sections/NotificationSettings.tsx ve admin/ altındaki diğer dosyalar (hooks/, components/, AdminUsersPanel vb.)

Kapsam dışı: backend, metin/tasarım değişikliği, yetki mantığı.

Vitest: `node_modules/.bin/vitest run src/components/settings src/components/admin`
Rapor yolu: /tmp/refaktor-w3-rapor.md
