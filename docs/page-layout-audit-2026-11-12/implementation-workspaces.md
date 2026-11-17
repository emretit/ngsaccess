# Workspace adoption: shift, settings and attendance

Implemented 12 November 2026 using the shared PageTemplate. Existing typography and color tokens remain; template section rhythm is 24 px and form body columns cap at 800 px, with globally aligned headings.

## Exact changed paths

- `src/pages/ShiftPlan.tsx`
- `src/pages/Settings.tsx`
- `src/pages/PDKSRecords.tsx`
- `src/pages/PdksSettings.tsx`
- `src/components/shared/PageTemplate.tsx`
- `src/components/shifts/ShiftPlanPage.test.tsx`
- `src/components/settings/settings.test.tsx`
- `src/components/pdks/auditPage.test.tsx`
- `src/components/pdks/settings/PdksSettingsPanel.test.tsx`
- `docs/page-layout-audit-2026-11-12/implementation-workspaces.md`

## Composition and preserved behavior

ShiftPlan uses global heading/backLink, a secondary settings link and its existing ref-backed action portal in primaryAction. The tree is in aside, preserving its own query boundary, ref, focus/expand behavior and create state. Calendar and department assignments retain their shared query boundary in the body. A calendar error can now leave the independently bounded tree available. Project keys, shift search parameter, history state and return navigation are unchanged; loading and no-project states retain heading and back action.

Settings uses form width and a semantic sidebar containing its existing labeled mobile selector and desktop navigation. PageTemplate adds optional `aside.breakpoint: 761 | 1100` (default 1100) so Settings retains its 761 px selector/navigation transition while existing list pages stay at 1100 px. The body alone caps at 800 px. Section h2/ref/tabIndex and tab-change focus effect, pending guard, URL normalization, legacy payroll redirect, SettingsFormState provider and section query boundary remain. The existing guard dialog uses overlays. Permission loading and denial now retain the global page heading.

PDKSRecords uses heading secondary operations, primary shift-plan navigation, a filters slot containing the existing period/date/search controls and smart preset, and overlays for corrections, employee detail, import, assistant and warning panels. Results, bulk selection and view-owned state remain in PdksRecordsResults. Existing permissions, outer query boundary, selected record behavior, details return focus and legacy plan redirect are preserved; project loading/no-project results retain heading context. No footer extraction is needed because this result component has no separate pagination footer.

PdksSettings uses form width, project scope and backLink. Existing page states and the intact PdksSettingsPanel retain their permissions, history-aware return behavior, per-project key, form guards and internal query boundary.

## Verification

- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`: passed after implementation and updated tests.
- Scoped ESLint for all nine touched source/test files: passed with no warnings/errors.
- Scoped `git diff --check`: passed.
- Relevant existing tests: 7 files, 47 tests passed — ShiftPlanPage, settings, auditPage, PdksSettingsPanel, PageHeader, shiftRedirects and useGuardedFormNavigation. Added semantic coverage for single h1/no duplicate main, retained headings/back actions in early states, Settings focus target/navigation, permission boundary query avoidance and legacy PDKS redirect query preservation. Existing draft, return-history, permissions and guard tests pass.

## Remaining verification

Independent browser QA remains for 390/1440 px and 760/761/767/768/1099/1100 px transitions, 200% zoom, long project names, portal actions after tree changes, dirty-form tab/project navigation, dialog return focus and keyboard section-heading focus. No business-data writes were made; backend, globals, tables, shell, reports and other workers' files were not edited. The existing PDKS outer query-error fallback still owns the whole content, as before; moving that boundary would require a separate data/error composition change.
