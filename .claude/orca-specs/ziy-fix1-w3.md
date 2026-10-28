# W3 düzeltme turu 1 (denetim docs/ui-audit-ziyaretci/review.md)
Ortak kurallar aynen geçerli (.claude/orca-specs/ziy-ortak.md). Ownership: önceki W3 dosyaların.
1. R-2: `VisitorFormFields.tsx:49` Ayarlar bağlantısı tam sayfa yenileme yapmasın. react-router `Link` kullan ve yeni sekmede aç (`target="_blank" rel="noopener noreferrer"`), böylece açık form kaybolmaz. Testi güncelle.
2. R-3 bu turda YAPILMAZ: codegen yayında yapılacak; `makeFunctionReference` satırına `// TODO(ziy-R3): codegen sonrası api.visitorHosts.search` yorumu ekle, başka değişiklik yok.
Kapılar: tsc app, eslint, `node_modules/.bin/vitest run src/components/visitors`. worker_done ≤4 satır.
