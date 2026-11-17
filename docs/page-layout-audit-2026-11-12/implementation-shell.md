# Wave 2 — shell, context and page composition

Implemented 12 November 2026. This dispatch only changed Layout/App/AppHeader/routeMeta, the worker's existing Alarms and UnifiedAccessControl ownership, related tests and this report. Existing checkout changes were retained; no backend, business-data writes, global CSS, reset or commit.

## Type safety

The required initial `tsc --noEmit -p tsconfig.app.json` passed. The reported AlarmFilters test TS2352 was already resolved by the previous dispatch's `isValidElement<Parameters<typeof AlarmDeviceOptions>[0]>` narrowing; no additional AlarmFilters edit was needed.

## PageTemplate composition

- Alarms uses PageTemplate for its outer identity and scope, including the missing-project branch. The permission-checked notification settings action now occupies `secondaryActions`, with a separate local query boundary. Notification dialog open state/deep-link initialization lives in the shell and is passed into `AlarmContent` through optional `settingsOpen` / `onSettingsOpenChange` props.
- Alarm filters retain controlled state and independent device-option query isolation. Existing summary/list/settings boundaries remain independent. Conditional BulkBar appears immediately before results for actionable selected records; its clear action and the existing acknowledge operation are retained. There is no zero-selection bulk UI or notification action in filters.
- UnifiedAccessControl uses PageTemplate `primaryAction`, `secondaryActions`, `notice`, `navigation` and `overlays`. Radix Tabs remains the ancestor of both tab triggers and content. Project-reset data boundaries and existing status-header registration remain in place.

## Main scroll ownership

`Layout.tsx` now owns authenticated `<main>` scrolling. A layout effect records each React Router history entry independently using `location.key`; pathname PUSH/REPLACE resets main to the top, while same-path query PUSH/REPLACE preserves the current scroll and focus. POP restores the saved entry, including query-only history entries. Pathname focus uses `{ preventScroll: true }`.

Scroll positions are held in a bounded 100-entry in-memory map. Leaving a pending restoration retains its intended target rather than recording a temporarily clamped skeleton position. Restoration applies immediately when possible, then uses coalesced MutationObserver/ResizeObserver callbacks while content grows. It does not settle while standard `aria-busy="true"` loading placeholders remain, so both lazy fallback and query loading can finish first. There is no polling animation loop. Wheel, touch, pointer or keyboard input cancels restoration; navigation cleanup and a 30-second ceiling disconnect observers, cancel pending animation frames and clear timers.

Explicit hash navigation resolves decoded IDs within main and scrolls the actual main element. POP saved positions take precedence over a hash on that history entry. Invalid hashes are handled safely. Public routes retain window scrolling: pathname PUSH/REPLACE resets the window, query-only changes preserve scroll, POP stays with native browser restoration, and pushed hash targets can arrive lazily with a bounded observer. Authenticated shell routes do not reset window scroll.

## Nested title and breadcrumb context

`resolveRouteContext(pathname)` is separate from `routeMeta` menu and permission data. Layout's header, main accessible name and live announcement now use this display context. PDKS plan/settings resolve to the actual page titles `Vardiya planı` / `PDKS Ayarları`, with linked PDKS ancestors. Report groups and details resolve through REPORT_GROUPS and the report registry; missing report/group URLs display `Rapor bulunamadı`. Official report group matches the page's `Muhasebe Raporları` title.

AppHeader accepts optional typed `breadcrumbs`, rendering linked ancestors and one current leaf. Existing title-only callers retain the home/title breadcrumb behavior. Home still omits the breadcrumb. Menu entries, permissions and existing route redirects were not changed by this dispatch.

## Verification

- `vitest run src/components/layout src/pages/Alarms.test.tsx src/pages/Alarms.selection.test.tsx src/components/alarms src/components/access-control/unified/UnifiedAccessControl.test.tsx`: 11 files, 70 tests passed.
- Application TypeScript: passed after all changes.
- Scoped eslint for every changed TypeScript source/test: passed with zero warnings/errors.
- New regressions cover effect wiring to main, preventScroll focus, PUSH/REPLACE resets, query preservation, separate POP entries, bounded storage, delayed/clamped restoration, loading placeholders, user cancellation, timeout cleanup, encoded main hashes, public window ownership and lazy hashes, all registry report titles, nested breadcrumbs, notification placement and conditional bulk operations.

## Limits and next verification

No authenticated live-browser checks were performed in this worker. Observer and hook regressions use controlled DOM surfaces and the repository's existing SSR/direct-element approach; real browser back/forward behavior, scrollbars, keyboard focus, and 390/1440 px layouts should receive coordinator visual checks. Positions are retained only for the latest 100 visited entries during this app lifetime; full reload restoration remains native browser behavior. A page that takes more than 30 seconds to become scrollable stops automatic restoration at its reachable position, and user input always takes priority. Initial public POP/hash behavior remains native; pushed public hash targets receive the lazy-content handling described above. Existing access-control parent permission/context failures still rely on the route boundary, while tab queries remain local. No other module's template migration was touched.
