# Vardiya Paket A — tamamlandı

Sözleşme: `.claude/design/vardiya-model.md` §5 uygulandı; sözleşmeden sapma ve açık soru yok.

## Değişiklikler

| Dosya:konum | Sonuç |
|---|---|
| `convex/lib/shiftPlan.ts:4` (yeni) | Sabitler, ortak validator/alanlar, gerçek tarih ve döngü doğrulama, başlangıca göre sıralama, gün sınırları, tek haftalık vardiyada eski biçim, tekil referans kimlikleri |
| `convex/schema.ts:1037` | Yalnız mevcut atamaya `plan?` ve iki yeni tablo/index eklendi; diğer tablolar değişmedi |
| `convex/lib/shiftResolver.ts:26` | Sözleşmedeki DayPlan; memo, resolve/resolveLast, 32 derinlikte departman zinciri, stable updatedAt, sentinel okuma sınırları |
| `convex/lib/shiftUx.ts:52` | Çoklu vardiyanın tüm zaman aralıkları; döngünün yalnız dolu slotları |
| `convex/lib/shiftAssign.ts:52` | Plan-aware karar/kesişim; atomik referans senkronizasyonu ve plan yükleme/doğrulama |
| `convex/shifts.ts:97` | includePlans, kişi atama planları, eski update'te plan koruma, clear split/delete referansları; silme/etki/kullanımda plan ve departman bağlantıları |
| `convex/shiftPlans.ts:70` (yeni) | Departman CRUD/önizleme ve planCells; schedule.manage yazma yetkisi, proje kapsamı, 50 kişi/42 gün sınırları |
| `convex/departments.ts:98` | Departman ataması bulunan departmanın silinmesi engellenir |
| `convex/lib/cardReadingProcess.ts:45` | Ortak çözümleyici ve resolveLast ile departman/gece kuyruğu; eski 100 adaylık yön belirsizliği davranışı korunur |
| `convex/_generated/api.d.ts:218` | Yalnız iki satır: shiftPlans import + fullApi kaydı |
| `convex/lib/shiftPlan.test.ts:1` (yeni) | 18 saf doğrulama/döngü/aralık testi |
| `convex/lib/shiftResolver.test.ts:1` (yeni) | 11 öncelik/miras/stable sort/legacy eşdeğerlik/bounded yükleme testi |
| `convex/shiftPlans.test.ts:1` (yeni) | 16 API/ref atomikliği/temizleme/yetki/silme/planCells/gece yönü testi |

## Son kapılar

- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`: geçti, 0 hata.
- `node_modules/.bin/tsc --noEmit -p convex`: geçti, 0 hata; api.shiftPlans çağrıları testlerde derleniyor.
- `node_modules/.bin/eslint src convex`: geçti, 0 hata; önceden mevcut `convex/attendanceCorrections.test.ts:8` unused admin uyarısı sürüyor.
- `node_modules/.bin/vitest run`: **365 test dosyası / 4042 test geçti**; yeni 3 dosya / 45 test; mevcut test/snapshot dosyaları değiştirilmedi.
- `node scripts/find-node-leak.mjs`: geçti.
- `git diff --check`: geçti.

Departmanı olmayan çalışanlarda yeni departman sorgusu yapılmaz; eski sorgu sayısı ve sonuç snapshot'ları birebir korunur. Departmanı olan çalışanlarda proje başına iki bounded sorgu kullanılır; sınır aşımında Türkçe hata verilir. Etki sorguları birincil/ikincil bağlantıları tekilleştirir; gelecek kullanım sorgusu yalnız aranan vardiyanın dolu slotlarını sayar.

Paket B/C kapsamındaki dosyalara dokunulmadı; canlı DB işlemi, codegen, yayın veya Git staging/commit yapılmadı. Başlangıçta bulunan `docs/mobile-release/PLAN-20261022.md` değişikliği bu çalışmaya ait değil. Sonraki iş koordinatör denetimi ve B/C entegrasyonudur; hesap motorunun çoklu DayPlan tüketimi bu paketin kapsamı dışındadır.
