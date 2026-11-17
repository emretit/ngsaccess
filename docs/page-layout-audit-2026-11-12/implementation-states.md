# Wave 1 — state correctness

Implemented 12 November 2026 by the state worker. No backend or PageTemplate changes.

## Changes

- `src/components/access-control/door-plans/DoorPlansTab.tsx`: missing project now says “Bir proje seçin” and directs selection to the top bar. The “no Hikvision door” message and devices CTA remain only for a successfully loaded empty project inventory.
- `src/components/access-control/unified/UnifiedAccessControl.tsx`: existing `QuerySectionBoundary` wraps each tab's query-calling descendant and the rule dialog, with project reset keys. Header, tab navigation and existing header actions remain outside these content boundaries.
- `src/pages/Alarms.tsx`: page identity and missing-project state remain in the shell. `AlarmContent` owns existing filter/category/selection/notification state under a content boundary (including the query-backed permissions hook). Summary, device options, accumulated list/footer, and notification settings each run queries inside separate boundary children. Summary and list failures are independent; list reset follows project/category/filter changes. Existing 50-row loading/selection limits, query arguments, notification permissions and acknowledgement behavior are preserved.
- `src/components/alarms/AlarmFilters.tsx`: adds optional `deviceControl: ReactNode` and extracts `AlarmDeviceOptions`, allowing device-option query failure to preserve other filters. Existing `devices` callers continue to work; it defaults to an empty array.

## API for the next wave

Default `Alarms` remains the route component. Named `AlarmContent` is available for composition/testing; it contains the description, summary, filters, results and settings but no page header. The coordinator can migrate the outer shell to PageTemplate without moving query hooks above their boundaries. `AlarmFilters` supports the optional `deviceControl` slot; `AlarmDeviceOptions` accepts the existing controlled value/onChange and typed device array. No Convex API or backend shape changed.

## Verification

- `vitest run src/pages/Alarms.test.tsx src/pages/Alarms.selection.test.tsx src/components/alarms src/components/access-control/door-plans/DoorPlansTab.test.tsx src/components/access-control/unified/UnifiedAccessControl.test.tsx`: 6 files, 31 tests passed.
- `tsc --noEmit -p tsconfig.app.json`: passed.
- Scoped eslint across all changed TypeScript files and alarms components: passed with no warnings/errors.
- Existing direct tree traversal tests were adapted for the extracted query/device children. Added missing-project wrong-CTA regression and structural fault-injection coverage verifying summary/list hooks execute below independent real boundaries while filters remain outside; the latter also checks the production boundary's retry fallback.

## Limits

Tests use the repository's SSR/direct-element harness. SSR does not execute React client error-boundary capture, so fault injection verifies component topology and the production boundary's error lifecycle separately; no mounted browser recovery is claimed. Live authenticated visual checks were not performed. Query retry remounts its failed section and restarts that list's pagination, matching existing QuerySectionBoundary behavior; successful in-progress pagination is unchanged. Access-control's existing parent permissions/context infrastructure still relies on the route boundary if that infrastructure itself fails; tab data, scope and dialog queries are locally isolated. Broader Alarms layout/toolbar changes and PageTemplate migration belong to the next wave.
