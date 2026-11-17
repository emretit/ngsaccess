# Shift test verification after layout adoption

12 November 2026. Investigated the two failures recorded in `/tmp/ngsaccess-layout-tests.log` (coordinator full run: 494/496 files and 5599/5601 tests passed). Both failures were stale assertions against existing calendar/form markup; no production source changes were needed or made in this task.

## Exact changed files

- `src/components/shifts/lib/auditFixes.test.tsx`
- `src/components/shifts/lib/calendarPresentation.test.tsx`
- `docs/page-layout-audit-2026-11-12/implementation-test-verification.md`

## Evidence and assertions

The shared DateInput uses the date-picker's Turkish locale and `dd MMMM yyyy` display format. AssignmentDateFields connects Başlangıç/Bitiş labels to its popup date-control buttons. Assignment creation starts and ends on 19 October in this fixture, while editing retains the original 19–25 October range. The updated test checks each labeled date control and its popup semantics, including the distinct end date, instead of searching the whole form for `19.10.2026`. Existing compact-date assertions for detail/preview/series summaries remain unchanged because those contexts still intentionally use that format.

ShiftCalendarGrid renders the short weekday and day number in separate nested spans inside an aria-hidden visual label. Its column header retains the full `20 Ekim 2026 Sal` screen-reader text. The updated test checks normalized visible weekday/date text within the column header and the separate screen-reader date without fixing the nested visual span structure. The native checkbox still has its explicit person-selection name and is wrapped by a minimum-height 44 px label, so the touch-target assertion now checks that associated label rather than demanding a 24 px checkbox glyph. This is a static markup/style-contract check; measured hit areas still belong to browser QA.

Read-only source investigation covered ShiftCalendarGrid, AssignmentDateFields, AssignmentEditDialog and the shared date-picker. No date value, timezone, keyboard or labeling regression was found in the inspected source.

## Validation

- The two requested files: 13/13 tests passed.
- All existing tests under `src/components/shifts`: 19 files, 127/127 tests passed.
- Scoped ESLint on the two changed tests: passed without warnings/errors.
- Scoped `git diff --check`: passed.
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`: passed.

The coordinator can rerun the full repository suite to establish an integrated final total; this worker ran the affected files and all shift tests, not a second full repository run. Existing Vite config-loader warning remains unrelated. No business-data writes, production source edits, backend changes, git resets or commits were performed.
