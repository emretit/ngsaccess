# Wave 1 foundation and pilots

Implemented 12 November 2026. Retains existing system sans typography, bordo brand and neutral surfaces. Shared sections use 24 px rhythm; shell gutters and main remain owned by Layout.

## Files and API

- `src/components/shared/PageTemplate.tsx` (new): `title`, `scope`, `backLink`, `primaryAction` (ReactNode), `secondaryActions`, `notice`, `navigation`, `summary`, `aside: { label, content }`, `filters`, `children`, `footer`, `overlays`, `width: 'wide' | 'form'`. Composes PageHeader and MasterDetailListLayout, adds one h1 and no main, retains the 1100 px side-panel transition. Wide is fluid; form limits the body column to 800 px while keeping the heading aligned globally.
- `src/components/shared/PageHeader.tsx`: supports ReactNode primary and secondary action slots; existing label/onClick/disabled object callers, secondaryMenu and children remain supported. Legacy objects keep the Plus default, with optional `icon` (null removes it); ReactNode actions have no forced icon. Title/scope can wrap beside actions.
- `src/pages/Employees.tsx`: active-project scope, heading add menu, compact permission-gated spreadsheet operations menu, scope tree, filters, result footer and overlays use template slots. Removes action content from the EmployeeFilters call without changing its API. Preserves export size limit, template/export error alert, dialog callbacks, URL/private search state, pagination, sorting, transfer handling and drawer guards. Early loading, project-denied and no-project states retain the page heading.
- `src/components/devices/DevicesContent.tsx`: active-project scope, heading add menu, optional scope tree and filters use template slots; filter state, type/status counts, filter key and all DeviceList callbacks/props remain intact.
- Existing tests updated: `src/components/shared/PageHeader.test.tsx`, `src/components/employees/EmployeesPage.test.tsx`. This report is the seventh changed file.

## Verification

- Latest focused run: `vitest run src/components/shared/PageHeader.test.tsx src/components/employees/EmployeesPage.test.tsx src/components/devices/DeviceFilters.test.tsx` — 3 files, 19 tests passed. Covers legacy and slot primary actions, optional icon, slot ordering, one h1/no main, width variants, permission gates, empty/filter states, transfer-to-detail behavior and early project states. Employee tests render dropdown portal content/items inline to inspect guarded options.
- ESLint for all six touched source/test files: passed; scoped diff whitespace check passed.
- `tsc --noEmit -p tsconfig.app.json`: first run passed after pilot migration. Subsequent shared-tree run reported TS2352 at `src/components/alarms/AlarmFilters.test.tsx:18` (in another worker's scope); no diagnostics in foundation/pilot files.
- Broader pilot run included DeviceList: 17 passed, 1 failed because `DeviceList.test.tsx:41` still expected the old fixed-height empty selection bar while the readability worker was changing that behavior. DeviceList and its tests were left to their owner.

## Remaining verification

Coordinator should rerun integrated TypeScript and pilot tests after sibling workers settle. Live 390/1440 px, 760/761/767/768 and 1099/1100 px transitions, 200% zoom, long scope names, keyboard/menu focus and dialog return focus still require browser verification. Devices page-level early branches live outside DevicesContent and are unchanged; existing EmployeePage query-error fallback still belongs to its outer boundary. No backend, global CSS, commits, resets or business-data writes were made.
