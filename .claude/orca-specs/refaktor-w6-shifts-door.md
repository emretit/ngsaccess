# Refaktör W6 — Vardiya takvimi + Kapı düzenleme diyaloğu

Hedef: iki bileşen alt dosyalara bölünür, davranış birebir, ilgili testler yeşil.

## A) src/components/shifts/ShiftCalendarView.tsx (421 satır, 14 state, 6 sorgu)
1. Sorgular (employees.list, shifts.list, shifts.listAssignments, leaves.listForRange, holidays.listForRange, …) ve aralık hesabı → `useShiftCalendarData` hook'u; `useQuery` argümanları ve "skip" koşulları BİREBİR (yeni abonelik yok).
2. Gün/hücre durumu hesabı (vardiya + izin + tatil birleştirme) → saf `shiftCalendarModel.ts` + golden test.
3. Başlık/gezinme, ızgara, hücre, lejant ayrı bileşenler.

## B) src/components/access-control/EditDoorDialog.tsx (431 satır, 9 state, 4 mutation)
Form bölümleri (genel bilgiler, okuyucu/yön, zaman planı vb.) ayrı bileşenlere; kaydet/sil akışı ve mutation çağrı sırası aynı; `DoorStatusPlanEditor.test.tsx` yeşil kalmalı.

Ownership (yalnız bunlara yaz):
- src/components/shifts/ShiftCalendarView.tsx + YENİ src/components/shifts/calendar/*
- src/components/access-control/EditDoorDialog.tsx + YENİ src/components/access-control/door-dialog/*
- Mevcut test dosyaları: YALNIZ import yolu kırılırsa import satırı
- DOKUNMA: diğer shifts / access-control dosyaları (AssignShiftDialog, ShiftListSidebar, DoorStatusPlanEditor vb.)

Vitest: `node_modules/.bin/vitest run src/components/shifts src/components/access-control`
Rapor yolu: /tmp/refaktor-w6-rapor.md
