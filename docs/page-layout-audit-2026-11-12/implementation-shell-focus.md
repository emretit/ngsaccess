# Mobile sidebar navigation focus fix

12 November 2026. Live QA found that selecting Devices from the mobile Settings menu reset main scroll correctly, but the sheet's close autofocus later returned focus to “Menüyü aç”.

## Fix

- `src/components/ui/sidebar.tsx`: SidebarProvider records explicit mobile navigation intent before closing the sheet. The existing Radix `onCloseAutoFocus` lifecycle consumes this intent and focuses `#main` with `preventScroll` after navigation, instead of restoring the menu trigger. Ordinary dismissal, including Escape/close/outside dismissal, continues to focus the trigger. Opening a new sheet clears stale intent, and every close autofocus consumes intent once.
- The handler respects an already open AlertDialog/Dialog outside the sidebar. A blocked route can open an unsaved-changes confirmation before sheet exit completes; neither main nor trigger takes focus away from that owning modal.
- Modified clicks, prevented clicks, middle clicks, download links and non-self targets do not register navigation intent or close the sidebar.
- `src/components/layout/AppSidebarNav.tsx`: primary and report-group links use the explicit navigation-close callback.
- `src/components/layout/AppSidebar.tsx`: the brand/home link uses the same callback.

The fix uses the sheet close lifecycle directly. No timers, delayed focus effects, business-data changes or unrelated source changes were introduced.

## Regression coverage and checks

`src/components/layout/sidebarFocus.test.tsx` renders the production SidebarProvider/Sidebar and actual navigation/brand link trees, capturing the Sheet close callback. It checks navigation-to-main, ordinary-dismiss-to-trigger, intent consumption, modified/cancelled clicks, report/brand links, and preservation of an open guard dialog's focus ownership. The harness invokes the close autofocus lifecycle directly; live animation timing remains a browser QA responsibility.

- `vitest run src/components/layout`: 7 files, 54 tests passed.
- `tsc --noEmit -p tsconfig.app.json`: passed.
- Scoped eslint for all four changed TypeScript files: zero warnings/errors.

## QA handoff

Ready for QA dispatch `ctx_21501e3d53e8` to retest at 390 px: Settings → Menüyü aç → Cihazlar, wait through sheet exit, expect activeElement MAIN and main scroll 0. Also check menu Escape/ordinary close returns focus to the trigger, and a real dirty Settings draft → menu → Devices keeps the confirmation's focus while navigation is blocked. The coordinator's review concern about blocked navigation has been addressed with the explicit modal-ownership check above. No live-browser outcome is claimed by this worker.

## Confirmed QA follow-up LQ02

QA confirmed that cancelling the blocked Settings navigation left BODY focused because UnsavedChangesDialog's original sidebar link had unmounted. `src/components/shared/UnsavedChangesDialog.tsx` now preserves the existing connected-trigger path, but when that trigger is disconnected it resolves the current `#main` during close autofocus and focuses it with `preventScroll`. On cancellation this returns focus to the Settings page; on discard it uses the destination page's current main. Public/no-main cases retain Radix's default fallback. No arbitrary timing or navigation-guard changes were introduced.

`src/components/shared/UnsavedChangesDialog.test.tsx` adds four lifecycle regressions: connected original trigger, disconnected menu trigger on cancel, current destination main on discard, and no-shell fallback. Combined `vitest run src/components/shared/UnsavedChangesDialog.test.tsx src/components/shared/unsavedChanges.test.ts src/components/layout` passes 9 files / 62 tests. QA dispatch was directly notified that source is ready for retest. The temporary Array.at test usage was replaced by target-compatible length indexing before the final TypeScript check.

## Confirmed QA follow-up LQ03

`src/pages/Alarms.tsx` now passes `scrollLabel="Alarm kayıtları"` to the existing framed Table. Its existing overflow wrapper consequently receives `role="region"`, the Turkish accessible name, `tabIndex={0}` and focus-visible treatment. No table shape or shared Table implementation was changed. `src/pages/Alarms.test.tsx` checks the actual rendered wrapper's name, keyboard tab stop and overflow class. QA dispatch received the source-ready notification for live ArrowRight verification at 390 px.

The final TypeScript pass also picked up the concurrently extended shared QuerySectionBoundary render return type: the existing Alarms selection regression now narrows the fallback using `isValidElement<Record<string, unknown>>` before reading its retry prop. This is a test-only adaptation to the shared API, with no type assertions to any.

## Final checks after all QA fixes

- Combined targeted command covering layout, UnsavedChangesDialog/guard logic, Alarms rendering and selection: 11 files / 75 tests passed.
- Final `tsc --noEmit -p tsconfig.app.json`: passed.
- Scoped eslint for every changed TypeScript source/test: passed, zero warnings/errors.
- Source-ready notifications for LQ02 and LQ03 were sent directly to QA `ctx_21501e3d53e8`; live retest results remain with that worker/coordinator.
