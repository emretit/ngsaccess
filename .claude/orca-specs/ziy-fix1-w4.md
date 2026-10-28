# W4 düzeltme turu 1 (denetim docs/ui-audit-ziyaretci/review.md)
Ortak kurallar aynen geçerli (.claude/orca-specs/ziy-ortak.md). Ownership: önceki W4 dosyaların.
1. R-1 (karar: EVET): bitişi cutoff'tan eski `preRegistered` kayıtlar da silinsin. Korunan tek ön kayıt: bitişi cutoff'tan yeni olan (`preRegistered && bitiş >= cutoff`). Aktif kayıt yine asla silinmez. Ön izleme sayımı bu kuralla aynı olsun. Test: 100 gün önce biten ön kayıt 90 gün ayarında silinir; 10 gün önce biten ön kayıt silinmez.
2. R-5: Ön izleme, süre kısaltıldığında da (yeni değer < eski değer) gösterilsin. Test ekle.
3. R-6: Zincir argümanlarına `days` (ya da cutoff) ekle; ayar değiştiyse cursor'ı sıfırla, geçersiz cursor hatası olmasın. Test ekle.
4. R-7: `removeRetainedVisitor` hatasını yakala; audit'e (tercihen) ya da console.warn'a "Saklama silmesi atlandı: <neden>" yaz, zincir durmasın. Test ekle.
Kapılar: tsc app+convex, eslint, ilgili vitest + `node_modules/.bin/vitest run convex/retention.test.ts convex/privacyRetention.settings.test.ts convex/lib/visitorRetention.test.ts src/components/settings/sections/privacy`. worker_done ≤6 satır.
