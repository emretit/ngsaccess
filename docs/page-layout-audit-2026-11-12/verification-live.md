# Independent live verification — 12 November 2026

Read-only QA against the current shared working tree and authenticated Default Orca profile at `http://localhost:8081`. Read IMPLEMENTATION and the foundation/readability/states/workspaces reports, plus the version-matched Orca browser and orchestration guides. No source files, backend data, user permissions, device operations, saved column preferences or localStorage were changed. Only this report and `evidence/after-*` screenshots are owned by this worker.

Created own browser tab `cca1eb64-dc75-41a8-a3c6-af5deac07603`; preserved the two pre-existing tabs. Commands used pinned page IDs and freshly observed snapshots/DOM. Screenshots are internal audit evidence containing existing personnel/device information. Mobile means Orca touch/coarse-pointer emulation, not physical-device coverage. Loading placeholders were excluded from final pilot captures; ShiftPlan awaited “Bu dönemde atama yok”. Sidebar animations caused intermediate rectangles during initial sampling; final matrix waited for transitions, and Settings 760/761/767 was independently rechecked after 700 ms.

All three reproducible findings below were corrected by source owners and independently retested; final status is recorded with each finding.

## Four pilot screens

| Page | 390 × 844 | 1440 × 1000 | Result |
|---|---|---|---|
| Kişiler | [Mobile](evidence/after-employees-390.png) | [Desktop](evidence/after-employees-1440.png) | Full observed names readable; secondary filters collapsed on mobile; desktop overflow stays in table. |
| Cihazlar | [Mobile](evidence/after-devices-390.png) | [Desktop](evidence/after-devices-1440.png) | Compact unselected helper line; connection badges readable; overflow stays in table. |
| Vardiya planı | [Mobile](evidence/after-shift-plan-390.png) | [Desktop](evidence/after-shift-plan-1440.png) | Daily mobile agenda, weekly desktop calendar; heading/back link and portal actions retained. |
| Ayarlar | [Mobile](evidence/after-settings-390.png) | [Desktop](evidence/after-settings-1440.png) | Global heading aligned; body alone capped at 800 px; section selector/navigation retained. |

## Measured breakpoint matrix

All four pilot pages had exactly one `h1` and one `main` at every width below; `document.documentElement.scrollWidth === innerWidth` throughout. Heading left edge is 16 px at 390/760, and 248 px at 761/767/768/1099/1100/1440 with the existing expanded 216 px sidebar. ShiftPlan has the same left edge and an intentional extra back-link row above its h1. Settings 761 was independently remeasured at x=248 after its transition settled.

Table entries are `clientWidth / scrollWidth` in CSS px of the visible named `role=region[tabindex=0]`; an em dash means the mobile agenda/form has no table region. Page width is the actual document width, not a screenshot inference.

| Viewport / document width | Kişiler region | Cihazlar region | ShiftPlan region | Settings navigation |
|---|---|---|---|---|
| 390 / 390 | 356 / 356 | 356 / 356 | — | Selector |
| 760 / 760 | 726 / 904 | 726 / 726 | — | Selector |
| 761 / 761 | 479 / 904 | 479 / 479 | 479 / 928 | 184 px side navigation |
| 767 / 767 | 485 / 904 | 485 / 485 | 485 / 928 | 184 px side navigation |
| 768 / 768 | 486 / 904 | 486 / 616 | 486 / 928 | 184 px side navigation |
| 1099 / 1099 | 817 / 904 | 817 / 817 | 817 / 928 | 184 px side navigation |
| 1100 / 1100 | 574 / 1444 | 574 / 756 | 574 / 928 | 184 px side navigation |
| 1440 / 1440 | 914 / 1444 | 914 / 926 | 914 / 928 | 184 px side navigation |

At 1099 px the scope control is 44 px tall above results; at 1100 px it becomes a 220 px side panel. Device columns change at 768 px without widening the document. ShiftPlan switches from agenda at 760 to named calendar scroll region at 761. Settings switches selector/side navigation at 761; its 800 px body maximum measured at 1440, with section x=456 and global h1 x=248.

## Interaction evidence

- Actual Orca mobile pointer `click` opened **both** Kişiler and Cihazlar Filtreler: `aria-expanded=false → true`, with employee status/sort and device connection/type comboboxes appearing. Prior worker’s unchanged-pointer report did not reproduce. No keyboard workaround was needed.
- Entered temporary `qa-no-match` searches; Kişiler showed the no-results state, then the visible clear button restored empty search, disabled clear, and two personnel. Cihazlar clear likewise restored empty search, disabled clear, and two devices. No preference or backend writes.
- Kişiler İşlemler portal exposed import/export/template items; Cihaz ekle portal exposed new/assign/virtual-reader items. No item executed. Escape closed the device menu and, after transition, focus returned to Cihaz ekle (`BUTTON`, menu count 0).
- Kişiler named table region accepted focus and keyboard ArrowRight; observed `scrollLeft=40`, `clientWidth=914`, `scrollWidth=1444`, active element remained the region. No column resize or visibility control used.
- Settings desktop keyboard focus + Enter on Raporlar changed URL to `?tab=reports` and focused `H2 Raporlar`, `tabIndex=-1`. Mobile native section selection also focused `H2 Raporlar`.
- Typed only reversible local draft `QA local draft - do not save` in empty Şirket adı. Section navigation opened “Değişiklikler kaydedilmedi”. Düzenlemeye dön retained draft and URL `/settings`; second navigation + Kaydetmeden çık discarded draft; returning Genel showed empty company input and `H2 Genel` focus. Never saved/submitted, toggled theme, or altered users/permissions.

## Shell navigation

Current Layout scroll implementation was present before these checks. Used real scrollable Settings content, not injected rows or height changes. At 390 × 844: set real `main.scrollTop=300` (native content maximum 452); mobile menu SPA navigation to Cihazlar yielded `main.scrollTop=0`; browser Back restored Settings to exactly 300. Earlier safe Settings link → ShiftPlan SPA PUSH reset to 0 and focused MAIN; Back restored its saved offset 452.5. Section query navigation intentionally focuses its new h2 and can therefore scroll to it; this should not be mistaken for a shell reset.

Same-path query check: at 390 × 500, expanded the existing ShiftPlan scope tree and selected its existing shift while `main.scrollTop=100`; the `?shift=…` URL change preserved exactly 100. No new shift/assignment was created. A first lazy SPA visit via the visible Ayarlar link to `/pdks-records/settings` reset to 0 with native maximum 2100. Set that actual scroller to 900; Back/Forward returned to Settings at exactly 900. Separate repeated unfiltered and filtered ShiftPlan → Settings → Back runs both restored plan offset 100 (max 306 after tree remount). One earlier filtered Back sample read 0, but repeated fresh runs restored 100; no reproducible second scroll defect established. Desktop nested PDKS settings breadcrumb read “Ana Sayfa/PDKS/PDKS Ayarları”.

### Finding LQ01 — mobile sheet close overrides route focus (reported to coordinator)

Reproduced twice at 390 × 844: `/settings` → Menüyü aç → Cihazlar. After content loads and 700 ms settles, URL `/devices`, `main.scrollTop=0`, but `document.activeElement` is `BUTTON`, `aria-label="Menüyü aç"`, text “Menüyü aç/kapat”. Ordinary Settings link → ShiftPlan focuses MAIN. This indicates mobile sheet return focus overrides Layout’s pathname focus. Coordinator assigned a shell fix. Post-fix retest at confirmed `innerWidth=390`: same navigation now focuses `MAIN`, label Cihazlar, scrollTop 0. Ordinary sheet Escape restores `BUTTON Menüyü aç`. With reversible local Settings draft, menu → Cihazlar stays `/settings`; focus remains on `BUTTON Düzenlemeye dön` inside alertdialog and draft is intact. No source edits made by QA.

### Finding LQ02 — cancel after disconnected navigation link loses focus

After the post-fix mobile draft-navigation guard, clicking Düzenlemeye dön leaves focus on BODY, URL `/settings`, draft retained. The sidebar link that initiated navigation has been removed, so the dialog has no connected return target. Coordinator corrected fallback focus. Fresh post-fix retest at width 390: guard focused its cancel button inside alertdialog; Düzenlemeye dön returned focus to `MAIN` labelled Ayarlar and retained draft. Ordinary Escape still returns the menu trigger; successful page selection still focuses Cihazlar MAIN. Test draft was discarded through section-navigation guard, and Genel input was verified empty afterwards. A further dirty mobile menu → Cihazlar → Kaydetmeden çık check navigated to `/devices`, active MAIN label Cihazlar, scrollTop 0, no alertdialog; revisiting Settings verified empty company input. No save/submit.

### Finding LQ03 — Alarmlar horizontal overflow has no named focusable region

At `/alarms`, 390 × 844, fresh DOM found one horizontal overflow wrapper: DIV, `overflow-x:auto`, clientWidth 356 / scrollWidth 684; `role`, `aria-label` and `tabindex` were all null. Snapshot has no named focusable table region. The pilot table regions do have the shared semantics. Source observation: `src/pages/Alarms.tsx` Table with resizeKey alarms omits scrollLabel. Coordinator added scrollLabel. Fresh post-fix 390 px retest found `role=region`, label “Alarm kayıtları”, tabindex 0, clientWidth 356 / scrollWidth 684; three ArrowRight key presses moved scrollLeft to 120 while region retained focus. Mobile alarm screenshot refreshed after resetting scroll; no alarm acknowledgement/action executed. This is an absent shared accessibility contract, not a full keyboard/screen-reader conformance assessment.

## Zoom-equivalent layout check

Used a **720 × 500 CSS px viewport**, half of 1440 × 1000, desktop pointer mode, scale factor 1. This is a valid reduced-CSS-viewport reflow check corresponding to 200% page zoom layout, not actual browser zoom or text enlargement. Did not use CSS `zoom`, transforms, or device pixel ratio as a zoom substitute. All four pilots retained one h1/main and document width 720; headings, scope controls and content remained within the main viewport with vertical scrolling as needed. This does not verify rendered glyph quality, physical target size, OS magnification or real browser zoom behavior, so full 200% zoom remains unverified.

## Additional adopted pages

- Alarmlar: 390/1440 document widths 390/1440, h1/main counts 1/1 and 1/1; [mobile](evidence/after-alarms-390.png), [desktop](evidence/after-alarms-1440.png). Read-only populated view observed; no actions submitted.
- Geçiş Kontrol / Kapı Planları: 390/1440 document widths 390/1440, h1/main counts 1/1 and 1/1; [mobile](evidence/after-access-control-390.png), [desktop](evidence/after-access-control-1440.png). Read-only populated view observed; no actions submitted.
- Raporlar index: 390/1440 document widths 390/1440, h1/main counts 1/1 and 1/1; [mobile](evidence/after-reports-390.png), [desktop](evidence/after-reports-1440.png). Read-only populated view observed; no actions submitted.

Following the actual Ham Okutmalar report link also verified `/reports/kayitlar/ham-okutmalar`: one h1 (“Ham Okutmalar”), one main, document width 1440 and nested breadcrumb “Ana Sayfa/Raporlar/Kayıtlar/Ham Okutmalar”. No report download/export executed.

## Limits

No full accessibility conformance claim. Physical touch, screen readers, dark theme, long-data fixtures, alternate roles, forced backend errors/no-project states, actual browser zoom, all remaining routes and destructive operations were not tested. Current data contained two people/two devices; screenshots do not prove behavior for large data sets. No build/lint/test suite run by this independent read-only QA worker; coordinator owns integrated checks. Changes from concurrent source workers mean this verifies live working tree, not an immutable commit.

Final cleanup: all local drafts discarded and empty company input verified. Only own QA tab was closed; both original tabs remained at their original routes. Eight final pilot screenshots plus six additional-page screenshots are stored under `evidence/after-*`; PNG dimensions verified as 390 × 844 or 1440 × 1000. No requested check is pending on source availability; actual 200% zoom and the explicit scope limits above remain unverified.
