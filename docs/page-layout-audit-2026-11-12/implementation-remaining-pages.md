# Remaining management pages — PageTemplate adoption

12 November 2026. Continued the authorized common-page-layout plan using the existing PageTemplate contract. This worker changed only the assigned page/component files and directly related tests; no backend, shared table/template/header, global CSS or business data changes.

## Adoption inventory

| Page / owner | Composition | Preserved behavior |
|---|---|---|
| Reports hub and missing/denied/loading routes — `pages/Reports.tsx` | One PageTemplate heading; report catalog in content | Registry, permissions, official deep links and legacy mola redirect |
| Report group — `pages/Reports.tsx` | Global heading/scope/backLink; local report navigation in optional aside | Report group links and mobile selector; aside changes to the template's 1100px breakpoint |
| Report detail — `components/reports/ReportScreen.tsx` | Owns the single PageTemplate and accepts optional `aside`/`backLink`; description in summary | Direct `definition`-only callers remain compatible; query keys, presets, URL parameters, results/export tools and independent filter/results query boundaries unchanged |
| Dashboard — `pages/Index.tsx`, `components/dashboard/DashboardHeader.tsx` | DashboardHeader composes PageTemplate with optional children and clock in secondaryActions | Standalone header callers still work; date/clock, panel boundaries, 1536px content density cap and responsive panel grids retained |
| Live Monitoring — `pages/LiveMonitoring.tsx` | PageTemplate heading/scope with LiveStatus in secondaryActions | CardReadings owns its existing filters, queries and result tools |
| Leaves — `pages/Leaves.tsx` | Heading in early states; creation in primaryAction, segmented navigation, filters and overlays in named slots | Scoped URL state, request/record switching, keyed boundaries, pagination, conflict navigation and unchanged detail/editor components |
| Audit Log — `pages/AuditLog.tsx` | Heading in early/denied states; all-project scope toggle in secondaryActions; coverage summary and filters slots | Export remains a filter/result tool, URL scope/range validation and results behavior retained |
| System Admin — `pages/SystemAdmin.tsx` | Heading in early/denied states; contextual primary button; TabsList in navigation | Radix Tabs context still wraps both navigation and panels; URL tab state, login redirect and panel-reported actions retained |
| Profile — `pages/Profile.tsx` | PageTemplate with form-width variant and one loading/ready heading | Photo/form/security/project cards and save/sign-out handlers unchanged; removed container and extra vertical page padding |
| Engineering — `pages/EngineeringDepartment.tsx` | One PageTemplate heading and result content | Existing engineering view unchanged; removed container and extra page padding |
| Visitors — `components/visitors/VisitorManagement.tsx` | Creation in primaryAction; independent summary, filters and overlays slots | Permission/project gates, summary/list query boundaries, visitor expiry clock, cursor pagination and detail/editor focus/guards retained |

Result-local pagination/load-more footers remain with their existing query components. Report filters remain inside their existing independently guarded ScopedReport area rather than lifting queries above the boundary merely to populate a parent slot. Local save/sign-out/export/column controls remain in their task context.

## Changed files

The eleven source files listed above, plus:

- `src/pages/managementLayout.test.tsx` (new): one heading in loading/no-project/denied states and Engineering composition.
- `src/components/reports/auditFixes.test.tsx`: hub/group/detail/official/missing report routes each have one heading before local navigation.
- `src/components/dashboard/dashboard.test.tsx`: dashboard children compose below one heading while retaining accessible clock coverage.

## Validation

- 28 relevant Vitest files / 272 tests passed: Reports, Dashboard, Live Monitoring, Audit, Visitors, Leaves, management page layout, admin user/device panels and Engineering view tests.
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`: passed after final changes.
- Scoped eslint over all eleven source files and three directly related test files: passed without warnings/errors.
- Separate Orca browser tab `e9470309-f62a-417b-a540-ca934c9dfeed`, localhost:8081, existing authenticated session. Read-only checks sampled Reports detail, Dashboard, Profile, Leaves, Visitors, Audit Log, System Admin, Live Monitoring and Engineering at 390×844 and 1440×1000. Each sampled route had one h1 and no document-level horizontal overflow. Settled report heading x=248 desktop / x=16 mobile; local report nav sits below the heading and becomes a 44px mobile selector. Settled Profile desktop heading x=248 and account form ~523px within the 800px content column; Engineering mobile heading x=16 and long title wraps.
- Reports mobile filter pointer click changed aria-expanded from false to true and exposed the filter controls. The earlier Orca mobile click issue did not recur, so no pointer workaround was introduced.
- Screenshots visually inspected for report desktop, Engineering mobile and settled Profile desktop. The owned browser tab was closed after checks. No records, form fields, stored user preferences or permissions were edited.

## Limits

Live checks used the existing authenticated role/project; all alternate permissions and unsaved-form/focus scenarios were not manually exercised. Existing guards, handlers and query components were preserved and relevant tests pass, but this is not a claim of complete accessibility, screen-reader, zoom, long-data or full breakpoint-matrix validation. Initial geometry samples taken immediately after viewport changes could precede the shell's responsive React update; settled report/Profile/Engineering measurements and screenshots were used for alignment conclusions. Existing report registry/query semantics and cursor models were intentionally retained.
