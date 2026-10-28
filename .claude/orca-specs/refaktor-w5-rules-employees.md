# Refaktör W5 — Erişim kuralları listesi + Personel tablosu

Hedef: iki bileşen alt dosyalara bölünür, davranış birebir, ilgili testler yeşil.

## A) src/components/access-control/unified/AccessRulesList.tsx (524 satır)
Satır/aksiyon menüsü, filtre/arama çubuğu, boş durum ve sayfalama gibi bölümleri ayrı bileşenlere, saf filtre/sıralama/etiket hesaplarını `accessRulesListModel.ts`'e taşı (+ küçük birim testi). Effect'ler (2 adet) ve sorgular (useQuery/usePaginatedQuery) aynı argüman ve koşulla kalır.

## B) src/components/employees/EmployeeTable.tsx (494 satır, 10 state)
Satır hücreleri, toplu seçim, satır aksiyon menüsü/diyalogları ayrı bileşenlere; saf yardımcılar `employeeTableModel.ts`'e. `EmployeeTable.test.tsx` değişmeden yeşil kalmalı.

Ownership (yalnız bunlara yaz):
- src/components/access-control/unified/AccessRulesList.tsx + YENİ src/components/access-control/unified/rules-list/* (ya da accessRulesList*.ts(x) aynı klasörde)
- src/components/employees/EmployeeTable.tsx + YENİ src/components/employees/table/*
- Mevcut test dosyaları: YALNIZ import yolu kırılırsa import satırı
- DOKUNMA: diğer access-control / employees dosyaları, src/components/sync/*, src/components/audit/*

Vitest: `node_modules/.bin/vitest run src/components/access-control src/components/employees`
Rapor yolu: /tmp/refaktor-w5-rapor.md
