# Wave 1 — readability implementation

12 November 2026. Readability worker; existing system sans, neutral surfaces and burgundy actions retained. No backend, business data, global CSS, parent-page props or other workers’ source changed.

## Changes

- Employee identity uses 14px data, 12px supporting text, a 240px default desktop name column and a 160px floor. Mobile names allow two lines; existing detail buttons, selection, sorting and responsive column visibility remain. Other columns receive content-specific default widths and minima; horizontal overflow stays inside the named keyboard-focusable table region.
- Employee/device search and clear remain visible. Existing `CollapsibleFilters` folds secondary controls on mobile and displays an active count. Select labels, status/type counts, controlled values and parent reset/URL callbacks remain unchanged. Employee scope is only supplied as `hasFilters`; its count is a fallback indicator when there are no locally countable filters, rather than an exact company/department count.
- Owned mobile filter controls and bulk actions have 44px minimum heights. Checkbox hit areas expand through their existing pseudo-elements, keeping their visual size compact. Main device data inherits 14px and connection badges use at least 12px.
- Devices render the existing `DeviceBulkActions`/shared `BulkBar` only with a permitted selection; no 88/53px placeholder remains. A short help line retains management/read-only guidance. Destructive confirmation, mixed selection, pagination summary and empty-state actions remain intact.

## Shared table contract

`TableHead.minWidth` remains optional and now applies to initial CSS layout, persisted-width rendering, accessible resize values, visible-column fitting and subsequent drags. Saved widths are retained, including hidden-column preferences; narrow historical widths receive an in-memory floor, without clearing or rewriting storage on replay. Valid larger preferences retain their exact base width. Unspecified minima keep previous fitting behavior.

Header registration remains ref-based, removes entries on unmount and reads current DOM minimums. Each committed render recalculates the visible header set without setting React state; `ResizeObserver` handles container changes and a window resize listener also covers media-query changes in a capped container. Both listeners clean up. No new public Table props were introduced.

## Files

- `src/components/employees/EmployeeTable.tsx`
- `src/components/employees/EmployeeFilters.tsx` and its existing test
- `src/components/employees/table/EmployeeTableRow.tsx`
- `src/components/employees/table/EmployeeSortColumn.tsx`
- `src/components/employees/table/EmployeeTableBulkSelection.tsx`
- `src/components/devices/DeviceFilters.tsx` and its existing test
- `src/components/devices/DeviceList.tsx` and its existing test
- `src/components/ui/table.tsx`, `table-resize.tsx`, and `table.test.tsx`

## Validation

- 10 relevant Vitest files / 56 tests pass: EmployeeTable, EmployeeFilters, employeeTableModel, DeviceList, DeviceFilters, table, deviceSelection, useListSelection, CollapsibleFilters and EmployeesPage. Coverage includes historical narrow saved widths without storage mutation, larger preferences, visible-column fitting, accessible resize minima, collapsed filter counts, selection and existing confirmation/permission paths.
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`: passes on final run. An earlier concurrent run caught another worker’s temporary AlarmFilters test type error, subsequently resolved.
- `node_modules/.bin/eslint src convex`: 0 errors, 2 existing backend unused-variable warnings.
- Separate Orca tab `0c6ccdc1-4926-4f75-957f-26b955c5c94e`, existing localhost:8081 session, 390×844 and 1440×1000. Both pages’ document widths match the viewport. Employee mobile visible name column measured ~164px; desktop default name/email widths measured 240/220px. Device mobile name/connection widths measured 164/112px; desktop name/model/serial measured 220/180/170px. Searches and expanded device selects measured 44px tall. Device filter disclosure verified using keyboard Enter. No business mutation or persisted preference edits performed.

## Limits

No claim of full accessibility conformance, pointer/touch device coverage, 200% zoom, complete breakpoint matrix, long-data fixtures or all roles. Orca mobile `click` returned unchanged for the disclosure while keyboard activation worked; physical pointer interaction should be checked separately. Saved-profile regression is verified with SSR and pure fitting tests, rather than changing the live user’s stored preferences. Live multi-selection/destructive operations were not exercised; existing tests cover those semantics. Existing table footer ownership remains with the page/list composition.
