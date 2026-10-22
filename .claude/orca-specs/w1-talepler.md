# W1 — Talepler ekranı (izin + PDKS düzeltme onay kuyruğu)

## Ortak kurallar (bu repo; CLAUDE.md'yi okumadığın için buraya gömüldü)
- TypeScript strict. `any` / `as any` YASAK (eslint error). Bilinmeyen veri `unknown` + narrowing. `!` non-null yerine erken return.
- Convex handler'ları schema alan adlarını olduğu gibi (camelCase) döner. Frontend'de Convex sonucu `any[]`'a açılmaz; `useQuery` sonucu ya da `FunctionReturnType<typeof api.X.Y>` kullan.
- `db.get` sonrası null süzme: `filter((p): p is NonNullable<typeof p> => p !== null)`.
- Convex kuralları: `convex/_generated/ai/guidelines.md` oku. Sınırsız `.collect()` yok; `take(N)` + sınır.
- UI metinleri Türkçe, sade. Mevcut bileşen/stil desenini taklit et (src/components/leaves/**, src/components/pdks/**, src/components/ui/**).
- YASAK: commit, push, deploy, `npx convex *` (dev/deploy/codegen), DB yazma, `convex/_generated/**` düzenleme, `mobile/**`.

## Hedef (test edilebilir)
Yönetici (super_admin / project_admin) aktif projede bekleyen çalışan İZİN taleplerini ve PDKS DÜZELTME taleplerini web'de görür; onaylar veya gerekçeyle reddeder.

## Bağlam
- Çalışan izin talebi: `convex/leaveRequests.ts` `submit` → `leaves` tablosuna `status:"pending", source:"employee"` ekler. Yönetici tarafı YOK: eski `leaves.approve/reject` C6'da silindi (referans: `git show f00637f^:convex/leaves.ts` satır 257-302). `leaves.update` yalnız onaylı kaydı düzenler (pending için LEAVE_READ_ONLY).
- Yeniden kullanılacak: `convex/lib/leaveRules.ts` `leaveDecisionPatch` (şu an üretimde çağıranı yok), `convex/leaves.ts` `assertNoLeaveOverlap` (onayda onaylı izinle çakışma kontrolü; gerekirse export et), `resolveProjectScope`, `requireLeaveEmployee`, `writeAudit`.
- PDKS düzeltme: `convex/attendanceCorrections.ts` `listPending` / `approve` / `reject` HAZIR (adminQuery/adminMutation). Yalnız UI eksik.

## Değişiklik
1. **Şema (convex/schema.ts, yalnız `leaves` tablosu, eklemeli):** opsiyonel `decisionNote: v.optional(v.string())`, `decidedAt: v.optional(v.string())`; index `by_project_status: ["projectId","status"]`. Başka tabloya dokunma.
2. **Backend (convex/leaveRequests.ts):**
   - `listPending` (adminQuery): args `{ projectId: v.id("projects"), paginationOpts }`; proje yetkisi kontrolü; `by_project_status` ile pending; çalışan adı, departman adı (varsa), gün sayısı ekle; sayfa ≤100.
   - `pendingCount` (adminQuery): `{ projectId }` → `{ leaves: number, corrections: number, capped: boolean }`; her biri `take(101)` ile sınırlı ("100+" gösterimi için).
   - `approve` (adminMutation): `{ leaveId, note?: string }`; proje + çalışan erişimi (eski approve ile aynı kontroller); yalnız `status==="pending"`; `assertNoLeaveOverlap`; patch `status:"approved", approvedBy, decidedAt, decisionNote, updatedAt`. Çalışanın `notes` alanını EZME. `writeAudit`.
   - `reject` (adminMutation): `{ leaveId, note: string }` gerekçe 3-500 karakter zorunlu; patch `status:"rejected", approvedBy, decidedAt, decisionNote`; `writeAudit`.
   - Hata mesajları Türkçe `ConvexError`.
3. **UI — İzinler (`src/pages/Leaves.tsx` + yeni `src/components/leaves/LeaveRequestsPanel.tsx`):** sayfada "Kayıtlar | Talepler (N)" geçişi (yalnız yönetici görür). Talepler: tablo (çalışan, tür, tarih aralığı, gün, çalışan notu, talep zamanı) + "Onayla" + "Reddet" (gerekçe diyaloğu, zorunlu). Çakışma hatasında anlaşılır mesaj (toast). Boş durum: "Bekleyen izin talebi yok."
4. **UI — PDKS (`src/pages/PDKSRecords.tsx` + yeni `src/components/pdks/CorrectionRequestsPanel.tsx`):** sayfada "Düzeltme talepleri (N)" girişi (buton → panel/sheet ya da sekme; mevcut sayfa desenine uygun olanı seç). Satır: çalışan, tarih, tür, istenen giriş/çıkış, gerekçe, talep zamanı. "Onayla" (opsiyonel not) / "Reddet" (zorunlu gerekçe). Boş durum metni.
5. **Testler:** `convex/leaveRequests.test.ts`'e listPending/approve/reject/pendingCount vakaları (yetkisiz proje, pending olmayan kayıt, çakışma, gerekçe kısa, notes korunur). Panel bileşenleri için mevcut test desenine uygun en az birer render testi (renderToStaticMarkup kullanılıyor).

## Ownership (yalnız bunlara yaz)
convex/schema.ts (yalnız leaves bloğu) · convex/leaveRequests.ts · convex/leaveRequests.test.ts · convex/leaves.ts (yalnız `assertNoLeaveOverlap` export'u gerekiyorsa) · src/pages/Leaves.tsx · src/components/leaves/LeaveRequestsPanel.tsx (+test) · src/pages/PDKSRecords.tsx · src/components/pdks/CorrectionRequestsPanel.tsx (+test)

## Kapsam dışı
Çalışan tarafı talep ekranı (mobil ekibin işi) · menü rozeti · e-posta/push bildirimi · `leaves.update` mantığı · izin bakiyesi hesabı · mobile/**.

## Kapılar (hepsini kendin koş, çıktıyı raporla)
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0
- `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` → 0
- `node_modules/.bin/eslint src convex` → 0 error
- `node_modules/.bin/vitest run` → tamamı yeşil (sayıyı yaz)

## Rapor
`worker_done`'da ≤10 satır: değişen dosyalar, eklenen fonksiyonlar, kapı sonuçları (sayılarla), bilinçli kararlar (file:line).
