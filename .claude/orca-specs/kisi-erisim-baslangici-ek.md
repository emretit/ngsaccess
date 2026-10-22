# Koordinatör ekleri (ngsaccess-81) — ana spec: .claude/orca-specs/kisi-erisim-baslangici.md

1. Hik kişi kaydını yazan İKİ yer var; ikisi de `beginTime` geçmeli, yoksa yeniden deneme başlangıcı "bugün"e geri yazar:
   - `convex/lib/hikSyncEmployee.ts:263` (ana senkron, `upsertPersonToDevice`)
   - `convex/actions/hikQueueWorker.ts:123` (retry worker, `upsertPersonToDevice`) → OWNERSHIP'e EKLENDİ.
   Dönüşüm tek yardımcıda olsun (ör. `lib/gateway/persons.ts` içinde `hikValidBeginFromAccessStart(accessStartsAt?: string): string | undefined`):
   ISO → İstanbul yerel `YYYY-MM-DDTHH:mm:ss` (timeType "local"; cihaz TR saatinde). Boş/geçersiz → undefined (mevcut varsayılan kalır). Test: "2026-11-01T00:00:00+03:00" → "2026-11-01T00:00:00".
2. Senkron tetiği: `convex/employees.ts:323` `if (!cardChanged && (activeChanged || groupMemberAdded))` → `accessStartsAt` değiştiyse de (set ya da temizle) Hik senkronu planlansın. IDE senkronunu bu yüzden tetikleme (IDE geçerlilik desteği araştırma konusu).
3. Kişiler formunda benzer tarih alanı deseni için mevcut "işten ayrılma" (`employmentEndDate`) alanına bak; aynı bileşen/biçim. Ziyaretçi kaydında alan gösterilmez.
4. Çalışma ağacında BAŞKA oturumun commit'siz dosyaları var (convex/employeeAuth.ts, convex/lib/employeeAuth.ts, convex/lib/employment.ts(+test), convex/lib/mobileErrors.ts, convex/w53Integration.test.ts) → DOKUNMA, kendi testlerin bunlara bağlı kırılırsa `ask`.
5. Kapılar ana spec'teki gibi; `node scripts/find-node-leak.mjs` (yoksa /tmp/find-node-leak.mjs). Rapor: `docs/kisi-erisim-baslangici/report.md` + worker_done ≤10 satır Türkçe, file:line.
