# Vardiya — Hikvision farkını kapatma planı (2026-10-23)

## Checklist (Orca run_787c48544312)
### Karar (Emre 2026-10-23: "önerine göre" + Faz 4 dahil)
- [x] Sıra: Faz 1 ∥ (Faz 2-4 tasarımı) → Faz 2+3 → Faz 4
- [x] Kişi ataması departman atamasından önce gelir
- [x] Pencere dışı okutma = "incelenecek"
- [x] Faz 4 (günde birden çok vardiya) dahil

### Dalga A (paralel)
- [ ] Faz 1 uygulama — Codex astra high, ctx_a43aac230086 (spec orca-specs/vardiya-faz1-kurallar.md)
- [ ] Tasarım A — Codex astra high, ctx_bb4d3be56b86 → .claude/design/vardiya-model-codex.md
- [ ] Tasarım B — Claude opus high, ctx_c0b957a8b052 → .claude/design/vardiya-model-claude.md
- [x] Koordinatör: Faz 1 kapı + denetim + commit 8f57a2d9; sentez .claude/design/vardiya-model.md

### Dalga B+C — Faz 2-4 (Paket A model, B motor, C1 arayüz, C2 PDKS gösterimi) — A, C1, C2 KABUL; B düzeltme 1 sürüyor (handoff-vardiya-hik.md)
- [ ] Spec(ler) + worker(lar) → kapılar → denetim

### Dalga C — Faz 4 (günde birden çok vardiya; Faz 1 + Dalga B üstüne)
- [ ] Spec + worker → kapılar → denetim

### Birleştirme
- [ ] Tam kapı (tsc app+convex, eslint, vitest, find-node-leak) + Orca turu
- [ ] Commit (Emre onayı) → yayın Convex → web (Emre onayı)

## Bağlam
- Kaynak: docs/hikconnect-audit/PDKS_KIYAS.md §2.3 + §3 (P2 5-7, P3). P1 maddeleri (nokta tipi, backfill yönü, çalışma günleri, her giriş/çıkış) bitti ve canlı.
- Hik modeli: Timetable (saat) → Shift (tekrar deseni, günde ≤8 timetable) → Schedule (kişi/departman/grup ataması, geçici vardiya).
- Bizde: `shifts` (sabit/esnek; tolerans alanları var), `shiftAssignments` (kişi + tarih aralığı + haftalık gün deseni), `employees.shiftId` varsayılan.
  Çözüm sırası `convex/lib/shiftResolver.ts:79-91`: en son güncellenen uyan atama → kişi varsayılanı → null (proje saatleri).
- Hesap anlık yapılır: vardiyaya yeni alan eklemek geçmiş günleri de etkiler → yeni alanlar opsiyonel, boşken davranış birebir aynı kalmalı (test şart).
- Departmanlar ağaç (`departments.parentId`), kişide `departmentId`.
- Süreç her fazda: spec → Codex worker (K2/K3) → Claude denetim → tsc/eslint/tam vitest → Orca turu → commit (Emre) → yayın Convex → web (Emre onayı).
