# FIXate — Next 10 High-Value Upgrades

Prioritized by impact-to-effort. Each targets a real gap from the current
shipped surface, not hypothetical polish.

## 1. ✅ Wire up filtering (simple global regex + advanced query builder)

Implemented as a high-performance, two-tier system evaluated directly in
 the Web Worker.

### Two-tier UX

**Tier 1 — default: a single search input.** Debounced regex against
raw message text. `Esc` clears. Example: `35=D|35=8` to find orders and executions.

**Tier 2 — inline panel: an advanced query builder.** Triggered by an
"Advanced" button next to the search input. The panel expands inline
above the grid (keeping detail panel height constant). Composes a
nested tree of rules with AND/OR logic.

### Rule model

Each leaf rule is `(tag, operator, value)`. Tag input (`TagInput`)
resolves names → numbers (e.g. typing "MsgType" picks 35) and supports
autocomplete without numeric spinners.

Operators by field type:

| Type | Operators |
|------|-----------|
| string / unknown | `contains`, `equals`, `regex`, `is empty`, `is set` |
| numeric | `>`, `<` |

### Implementation notes
- **Worker-side evaluation**: Filtering happens on the worker's cached
  `ParsedMessage` set, returning only `Uint32Array` of indices to the
  main thread.
- **Shared Worker**: `useParserWorker` uses a singleton worker to
  ensure state persistence across components.
- **Reactive UI**: Built with Shadcn/UI primitives (`select`, `checkbox`, `badge`).

## 2. ✅ Typed value rendering (timestamps, prices, sides) + semantic coloring

The dictionary already exposes `type` (`UTCTIMESTAMP`, `PRICE`, `INT`, …).
Today everything renders as raw text. This needs to be specified per
field type:

| FIX type | Raw value | Rendered |
|----------|-----------|----------|
| `UTCTIMESTAMP` | `20260531-14:23:01.045` | `2026-05-31 14:23:01.045Z` + tooltip "2 min ago" |
| `UTCTIMEONLY` | `14:23:01.045` | `14:23:01.045` (monospace, color-muted ms) |
| `UTCDATEONLY` | `20260531` | `2026-05-31` |
| `LOCALMKTDATE` | `20260531` | `2026-05-31` |
| `PRICE` / `QTY` / `AMT` | `1234567.89` | `1,234,567.89` (locale grouping, right-aligned in grid) |
| `INT` / `SEQNUM` / `LENGTH` | `12345` | `12,345` (right-aligned) |
| `CHAR` enum (e.g. 54, 40, 59) | `1` | `Buy` (raw `1` shown faded after, on hover) |
| `STRING` enum (e.g. 35, 39, 150) | `D` | `NewOrderSingle` (raw faded) |
| `BOOLEAN` | `Y` / `N` | `✓` / `✗` |
| `CURRENCY` | `USD` | `USD` (no change, but right-aligned next to amounts) |
| `MULTIPLECHARVALUE` / `MULTIPLESTRINGVALUE` | `A B C` | space-split, each decoded against enum if available, joined with `·` |
| `STRING` (free-form) | as-is | as-is |
| unknown / missing dict entry | as-is | as-is, with faded yellow background (same as unknown-tag treatment) |

### Semantic coloring

A small palette layered on top of the formatted text — never as the
sole signal (a11y), always paired with the decoded label so it works
in any theme. Powered by the same `formatValue()` function that
returns an optional `tone` token consumed by both the grid cell and
the detail panel.

| Field | Rule | Tone |
|-------|------|------|
| **35 MsgType** | Per-category background chip behind the decoded name | session (`A`, `0`, `5`, `1`, `2`, `3`, `4`) → **slate**; app-order (`D`, `F`, `G`, `8`, `9`) → **indigo**; market data (`V`, `W`, `X`, `Y`) → **teal**; quote (`R`, `S`, `i`, `b`) → **violet**; trade-capture (`AE`, `AR`) → **amber**; other → **neutral** |
| **54 Side** | `1` Buy → **emerald** text; `2` Sell / `5` SellShort / `6` SellShortExempt → **rose** text; cross / undisclosed → **neutral** |
| **39 OrdStatus** | `0` New → **sky**; `1` PartialFill → **indigo**; `2` Filled → **emerald**; `4` Canceled / `C` Expired → **muted**; `8` Rejected → **rose**; `5/6` Replace pending → **amber** |
| **150 ExecType** | Same palette as OrdStatus (same enum codes; keep them visually consistent) |
| **40 OrdType** | `1` Market → **amber** chip; `2` Limit → **sky** chip; `3/4` Stop variants → **violet** chip; default → none |
| **59 TimeInForce** | `0` Day → none; `1` GTC → **sky**; `3` IOC → **amber**; `4` FOK → **rose**; `6` GTD → **violet** |
| **Warnings on a row** | Row left-border 2px **rose** if any error-level warning, **amber** if only info |
| **44 Price vs reference** | _(deferred)_ Could shade green/red vs a reference (last/avg) once a stats panel exists. Out of scope for v1. |
| **Unknown tag** | Already faded yellow background — keep as the universal "we don't know this" tone |

**Implementation:** tones are CSS variable names
(`--tone-buy`, `--tone-sell`, `--tone-msgtype-app`, …) defined once
per theme in `globals.css` so light/dark/Catppuccin variants all get
appropriate contrast. The `formatValue()` return adds a single
optional `tone?: ToneToken` field; consumers map it to a class.
No inline hex colors, no per-component palette duplication.

**A11y:** every colored value is *also* labeled. Color disagreements
between themes are tested by snapshotting the contrast ratio of each
tone pair (Vitest + `wcag-contrast`).

### Where it applies

- **Grid cells**: typed render only. Cell tooltip shows the raw value.
  Right-alignment is per type (numbers/timestamps right, strings left).
  Tone applied as text color (Side, OrdStatus) or background chip
  (MsgType, OrdType).
- **Detail panel**: shows `rendered` as the primary value; raw value
  appears in a smaller muted line beneath it when it differs. Avoids
  ambiguity for ops users who need the on-wire string for tickets.
  Tones reused for the same fields.
- **Copy**: copying a cell or field copies the **raw** value by default
  (round-trips back into a FIX message); a `⌘⇧C` (or right-click "Copy
  rendered") copies the formatted one.
- **Sort**: switches from string-compare to type-aware compare
  (numeric, lexicographic timestamp). Already implemented for some
  columns — generalize via the type table above.
- **Filter operators in #1**: gated by the same type table.
- **Coloring legend**: a small "Legend" link in the About popover
  surfaces the tone-to-meaning mapping for new users.

**Implementation note:** a single pure `formatValue(type, raw): {text, title?, align}`
function in `lib/format.ts` (already stubbed in PLAN.md §3) used by
both grid and detail. No re-parsing per render — memoize per
`(version, tag, raw)` tuple if it shows up in profiles.

## 3. ✅ Keyboard navigation across grid + detail

Power users live on the keyboard. Bind `↑/↓` or `j/k` to move row
selection (scrolling the virtualizer to keep it in view), `Enter` to
focus detail, `Esc` to return to grid, `/` to focus filter, `g/G` for
first/last. Currently zero keyboard nav.

**Cheatsheet location:** the existing **About popover** (Info icon in
the header, `App.tsx:91`) already exists for app meta. Add a
"Keyboard shortcuts" section to it — no separate `?` modal. One source
of truth: the user already knows where the Info icon lives.

## 4. Column resize + drag-reorder + pinning

Widths and order already persist in settings but the UI is unwired. Add
native TanStack column-resize handles, DnD reordering on the header row,
and "pin left/right" on the right-click menu (which already exists for
hide). Closes the loop on existing persisted state.

## 5. Repeating-group reconstruction in the detail panel

The dictionaries carry `<group>` declarations; today repeating groups are
a flat run of identical-tag rows that are hard to read in big
NoRelatedSym / NoMDEntries messages. Group them visually (indented,
collapsible, numbered instances) without changing the parser's core flat
output — just a render-time grouper.

## 6. Export (CSV / JSON / raw FIX) of current view

Power users need to hand off subsets. One menu: "Export visible rows as
CSV / JSON / raw FIX (selected delimiter)". Honors active filters,
visible columns, and sort. Pure client-side `Blob` + download — no
backend needed.

## 7. Statistics / summary side panel

A togglable panel with: count by MsgType, by Sender→Target pair, by
version, time span (first/last SendingTime), top symbols, and gap
detection on MsgSeqNum. Click any bucket → applies it as a filter.
Turns FIXate into a triage tool, not just a viewer.

If any messages carry warnings, show a single line at the top:
`⚠ 14 messages with warnings · Filter` — one click filters to them.
No histogram, no per-type breakdown.

## 8. Find-in-message (Ctrl/Cmd-F inside detail panel)

For 200+ field messages the detail panel becomes a wall. Local find that
highlights matching tag names / values / descriptions and scrolls through
hits with `Enter` / `Shift+Enter`. Trivial to build, high daily usage.

## 9. Compare two messages (diff view)

Select a row, `Shift+click` (or `d` keyboard) a second row, get a
side-by-side or unified diff of fields: added/removed/changed values
highlighted, with dictionary names. This is what people open three text
editors and `diff` to do today. Massive workflow win for order-flow
debugging.

## 10. Session restore + shareable view state

Two pieces, both small:

- **OPFS-backed last session**: opt-in "Reopen last log" on load —
  survives accidental refresh without re-uploading.
- **URL-encoded view state**: compress filter + column visibility +
  selected index into the hash. Pasting the URL to a teammate reproduces
  *their view* (still requires they load the same log — no data in the
  URL).

---

## Honorable mentions

Command palette (Cmd-K), auto-parse on paste, hex/raw inspector toggle,
multi-tab / multi-file, sticky column for the row-number index,
virtualized detail panel for huge messages.
