# Denetim — Frontend refaktör dalgası (W1-W3, Codex yazdı)

Rol: SALT-OKUMA denetçi. Hiçbir dosyaya yazma (yalnız rapor dosyası). commit/push/deploy/DB YOK.
Çalışma dizini /Users/emreaydin/ngsaccess (main; başka oturumların commit'siz işleri var — yalnız aşağıdaki dosyaları denetle).

Amaç: üç refaktörün SAF olduğunu (kullanıcı davranışı birebir) kanıtla ya da sapmaları file:line ile göster.

Kapsam (eski hâl: `git show HEAD:<dosya>`; yeni hâl: çalışma kopyası + yeni untracked dosyalar):
- W1: src/components/access-control/unified/status/** (StatusPage.tsx bölündü) — rapor /tmp/refaktor-w1-rapor.md
- W2: src/pages/PDKSRecords.tsx + src/components/pdks/records/** — rapor /tmp/refaktor-w2-rapor.md
- W3: src/components/admin/AdminProjectsPanel.tsx + src/components/admin/projects/** + src/components/settings/sections/components/PdksRules*.ts(x) ve pdksRules*.ts(x) — rapor /tmp/refaktor-w3-rapor.md

Kontrol listesi (her worker için):
1. useEffect bağımlılık dizileri ve tetikleyiciler (revision, filtreler, view/expanded) eskisiyle aynı semantikte mi; `alive`/`generation`/`actionLock` yarış ve çift-gönderim korumaları korunmuş mu?
2. Convex çağrıları: aynı fonksiyonlar, aynı argümanlar, aynı sayı; imperatif `convex.query` → `useQuery` dönüşümü YOK.
3. UI: metinler, aria-label/role, className, koşullu render, buton disabled koşulları, Sheet/Dialog open/onOpenChange mantığı, odak geri verme aynı mı?
4. Dışa açık export'lar (default + named) korunmuş mu; importer'lar (grep) kırılmamış mı; test assertion'ı değiştirilmemiş mi?
5. Proje kuralları: `any`/`as any` yok, `!` non-null yok, ownership dışı dosyaya yazılmamış (git status ile kontrol: beklenmeyen değişiklik varsa başka oturumun olabilir — yalnız raporla).

Kapılar (kendin koş):
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`
- `node_modules/.bin/eslint src/components/access-control/unified/status src/pages/PDKSRecords.tsx src/components/pdks/records src/components/admin/AdminProjectsPanel.tsx src/components/admin/projects src/components/settings/sections/components`
- `node_modules/.bin/vitest run src/components/access-control/unified/status src/components/pdks src/components/settings src/components/admin src/pages`
- `node_modules/.bin/vite build` (yalnız derlenebilirlik; dist çıktısını commit'leme, sorun değil)

Rapor: /tmp/refaktor-denetim.md — her bulgu: seviye (ENGEL = davranış değişti/kırık · DÜZELT = küçük sapma/kural ihlali · NOT = bilgi), file:line, eski vs yeni, önerilen düzeltme. Sonunda worker başına "SAF / SAF DEĞİL" hükmü ve kapı çıktılarının özeti.
worker_done (≤10 satır): ENGEL/DÜZELT/NOT sayıları + worker başına hüküm + kapı sonuçları.
