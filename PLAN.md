# FIXate — Project Plan

A 100% client-side web tool for parsing, browsing, and inspecting
[FIX protocol](https://en.wikipedia.org/wiki/Financial_Information_eXchange) log messages.
No data ever leaves the user's browser.

---

## 1. Product summary

FIXate accepts FIX messages as pasted text, a dropped file, or a file picked
from disk. It parses them entirely in the browser (Web Worker), renders the
results in a virtualized grid with the most useful tags as columns, and shows
a detail pane for the selected message that decodes every tag and its enum
values against the appropriate FIX data dictionary. Column visibility,
theme, and other UI preferences persist in `localStorage`. Nothing else
persists; nothing is uploaded.

Target scale: comfortably handle log files containing tens of thousands of
messages (target: 100k messages, ~50–100 MB raw, parsed and filterable
without UI jank).

---

## 2. Locked decisions

| Area | Choice |
|------|--------|
| Name | **FIXate** |
| Framework | **Vite + React 18 + TypeScript (strict)** |
| Styling | **Tailwind CSS** |
| Components | **shadcn/ui** (Radix primitives + Tailwind) |
| Icons | **lucide-react** (ships with shadcn) |
| Data grid | **TanStack Table v8 + TanStack Virtual** |
| FIX parser | **Custom**, with **auto-detected protocol version** |
| Data dictionary | **QuickFIX XML dictionaries** compiled to typed JSON at build time |
| Theming | **next-themes** (system / light / dark, persisted) |
| Heavy work | **Web Worker** (Comlink for ergonomics) |
| Storage | **`localStorage`** for settings only; **no message persistence** |
| Unit / integration tests | **Vitest** + **React Testing Library** |
| E2E tests | **Playwright** |
| Hosting | **Cloudflare Pages** (static deploy) |
| Package manager | **pnpm** |
| Node | LTS (>= 20) |

---

## 3. Repository layout

```
FixWebsite/
├── PLAN.md
├── README.md
├── index.html
├── package.json
├── pnpm-workspace.yaml         # only if we split parser into its own package later
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── playwright.config.ts
├── public/
│   └── favicon.svg
├── scripts/
│   └── build-dictionaries.ts   # QuickFIX XML -> JSON at build time
├── dictionaries/               # source XML, vendored from quickfixengine.org
│   ├── FIX42.xml
│   ├── FIX44.xml
│   ├── FIX50SP2.xml
│   └── FIXT11.xml
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/
│   │   ├── ui/                 # shadcn/ui generated components
│   │   ├── InputPanel.tsx      # textarea + drop zone + file picker + clear
│   │   ├── MessageGrid.tsx     # TanStack Table + Virtual
│   │   ├── DetailPanel.tsx     # full tag/value/description view
│   │   ├── FilterBar.tsx       # global regex + per-column filters
│   │   ├── ColumnSettings.tsx  # toggle visible columns
│   │   ├── ThemeToggle.tsx
│   │   └── EmptyState.tsx
│   ├── parser/
│   │   ├── tokenize.ts         # split into messages + tag=value tokens
│   │   ├── parse.ts            # build ParsedMessage[]
│   │   ├── detect.ts           # auto-detect FIX version per message
│   │   ├── dictionary.ts       # lookup tag name + enum description
│   │   └── types.ts
│   ├── worker/
│   │   ├── parser.worker.ts    # entry; uses Comlink
│   │   └── filter.worker.ts    # may merge into parser.worker
│   ├── state/
│   │   ├── messages.ts         # Zustand store (or React context+reducer)
│   │   └── settings.ts         # persisted: columns, theme, default dict
│   ├── lib/
│   │   ├── columns.ts          # default column definitions
│   │   ├── format.ts           # value formatters (timestamps, prices)
│   │   └── storage.ts          # typed localStorage wrapper
│   ├── dictionaries/           # GENERATED JSON output of build-dictionaries.ts
│   │   └── *.json
│   └── styles/
│       └── globals.css
└── tests/
    ├── parser/
    │   ├── tokenize.test.ts
    │   ├── parse.test.ts
    │   ├── detect.test.ts
    │   └── fixtures/           # real FIX samples per version + message type
    ├── components/
    │   └── *.test.tsx
    └── e2e/
        ├── paste-and-filter.spec.ts
        └── drop-file.spec.ts
```

---

## 4. FIX parser design

### 4.1 Wire format

A FIX message is an ordered sequence of `tag=value` pairs separated by the
**SOH** byte (`0x01`). Logs commonly substitute `|`, `^A`, or `\x01`-as-text.
The parser must accept any of: `\x01`, `|`, `^A`, the literal string `\x01`,
or ``. Detection is per-message (sniff first ~256 chars for a
delimiter candidate, prefer `\x01` if present).

A message ends at the **next** start-of-message marker (tag `8=` at a line
start or after a previous trailing delimiter) or at end of input. We do
**not** require tag `10` (checksum) to be present — many captured logs strip
it — but we validate it when present and surface a per-message warning.

### 4.2 Auto-detected protocol version

Version is taken from tag **8 (BeginString)** of each message:

- `FIX.4.0`, `FIX.4.1`, `FIX.4.2`, `FIX.4.3`, `FIX.4.4` → use the matching
  dictionary directly.
- `FIXT.1.1` → session-layer envelope for FIX 5.0+. The application version
  is in tag **1128 (ApplVerID)** (e.g. `9` = FIX50SP2). If `1128` is absent,
  fall back to the user's configured default app version (default: FIX50SP2).
- Unknown → fall back to FIX44, surface a warning badge on the row.

Detection happens **per message**, not per file — mixed-version logs are
handled correctly.

### 4.3 Output type

```ts
interface ParsedField {
  tag: number;
  rawValue: string;
  // Resolved against the dictionary for this message's version:
  name?: string;         // e.g. "MsgType"
  enumLabel?: string;    // e.g. "NewOrderSingle" for 35=D
  description?: string;  // human description of the tag
  type?: FieldType;      // STRING | INT | PRICE | UTCTIMESTAMP | ...
}

interface ParsedMessage {
  index: number;             // position in original input
  rawText: string;           // exact original substring
  fields: ParsedField[];     // preserves original order
  byTag: Map<number, string>;// O(1) lookup of raw values
  version: FixVersion;       // resolved version (incl. ApplVerID for FIXT)
  msgType?: string;          // raw value of tag 35
  warnings: Warning[];       // bad checksum, unknown tag, repeat-group oddities
}
```

Repeating groups: v1 treats them as flat ordered fields with no grouping —
the detail panel can still show them in order. v2 may reconstruct groups
using the dictionary's `<group>` declarations.

### 4.4 Performance budget

- Single-pass tokenizer, no regex in the hot path; manual index scan over
  the input string.
- No per-field object spread / clone.
- `ParsedMessage.fields` is a tightly packed array of plain objects.
- `byTag` populated during the same pass.
- Dictionary lookup is a `Map<number, FieldDef>` per version, loaded lazily
  and cached.
- All parsing runs in a **Web Worker**; the main thread only receives the
  finished `ParsedMessage[]` (or a transferable summary + lazy fetch by
  index, depending on profiling).

Target: parse 100k messages (~80 MB) in under 3 s on a modern laptop.

### 4.5 Data dictionary build step

`scripts/build-dictionaries.ts` runs at build time:

1. Reads each `dictionaries/*.xml` (QuickFIX format, redistributable).
2. Emits one `src/dictionaries/<version>.json` per version with:
   - `fields`: `{ [tag]: { name, type, values?: { [code]: label } } }`
   - `msgTypes`: `{ [code]: name }`
3. Vite imports them with `?url` / dynamic `import()` so only requested
   versions are loaded at runtime.

This keeps zero XML parsing in the shipped bundle.

---

## 5. UI design

### 5.1 Layout

Three states, same shell:

1. **Empty**: full-width input panel (textarea + drop zone). Friendly empty
   state with a "paste a FIX message or drop a log file" prompt.
2. **Single message**: input panel collapses into a thin header; the detail
   panel takes the full content area.
3. **Many messages**: split view.
   - Left ~65%: filter bar on top, virtualized grid below.
   - Right ~35%: detail panel for the selected row.
   - The split is a resizable handle (shadcn `Resizable`).

A persistent top bar holds: app name (FIXate), theme toggle, column
settings (gear icon), and a "Clear" button when data is loaded.

### 5.2 Input panel

- Textarea (monospace, soft-wrapped off, line numbers off — keep it simple).
- Drop zone overlay on the entire window when a file is dragged in.
- File picker button (`<input type="file" accept=".log,.txt,.fix,*">`).
- "Clear" button (only when there is content).
- A small badge shows detected version(s) and message count after parsing.

### 5.3 Grid

- TanStack Table v8 with TanStack Virtual row virtualization.
- Default visible columns:
  `8`, `35`, `49`, `56`, `52`, `34`, `11`, `37`, `17`, `55`, `54`, `38`,
  `44`, `40`, `59`, `39`, `150`, `6`, `14`, `151`.
- Column header shows: tag number, tag name (e.g. `35 MsgType`), and a
  per-column filter input (text or select-from-enum).
- Row click → selects, populates detail panel.
- Sticky header; row height fixed at ~28 px for density.
- Sortable columns where the type makes sense (timestamps, prices, ints).
- Right-click column header → quick "hide" / "pin".
- Column visibility, order, and width persist to `localStorage`.

### 5.4 Detail panel

For the selected message, a scrollable list of every field in original
order, each rendered as:

```
[tag]  Name                Type
       Value      ↳ EnumLabel (if applicable)
       Description (muted, optional)
```

Top of the panel shows resolved version, MsgType (name + code), and any
parse warnings as a small badge stack. A "Copy raw" button copies the
original message text.

### 5.5 Filtering

Two layers, both running in the worker:

1. **Global regex**: matches against each message's raw text. Invalid regex
   shows an inline error; valid regex is debounced (~150 ms).
2. **Per-column filters**: substring (default) or exact-match for enum-typed
   columns (rendered as multi-select chips).

Filters are AND-combined. Active filter count is shown in the filter bar
with a one-click "reset filters" affordance.

### 5.6 Theming

`next-themes` provides `system | light | dark`, persisted to
`localStorage`. shadcn tokens drive every component; the grid uses the same
tokens. The drop overlay and selection highlight use a single accent color
defined once in `globals.css`.

### 5.7 Settings (persisted)

`localStorage` key: `fixate:settings:v1`. Schema:

```ts
{
  theme: "system" | "light" | "dark";
  defaultFixtAppVersion: "FIX50SP2" | "FIX50SP1" | "FIX50" | "FIX44";
  columns: { tag: number; visible: boolean; width?: number; order: number }[];
  filterBarMode: "global" | "perColumn" | "both";
  splitRatio: number; // grid/detail split percentage
}
```

A `v1` suffix lets us migrate cleanly later.

---

## 6. State management

Light-touch: **Zustand** for the messages store and selection state;
`useSyncExternalStore` wrapper around the typed `storage.ts` for settings.
We avoid Redux — the surface area doesn't justify it.

Stores:

- `useMessagesStore` — `messages: ParsedMessage[]`, `filteredIndices: Uint32Array`,
  `selectedIndex: number | null`, `parseState: "idle" | "parsing" | "ready" | "error"`.
- `useSettingsStore` — persisted settings as above.

`filteredIndices` is a `Uint32Array` (not `number[]`) — significantly
smaller and faster to ship from worker to main thread for 100k messages.

---

## 7. Web Worker contract

Using Comlink for ergonomics:

```ts
// parser.worker.ts
export interface ParserWorker {
  parse(text: string | ArrayBuffer): Promise<{
    messages: ParsedMessage[];
    detectedVersions: FixVersion[];
    warnings: GlobalWarning[];
  }>;
  filter(args: {
    regex?: string;
    perColumn?: Array<{ tag: number; needle: string; mode: "substring" | "equals" }>;
  }): Promise<Uint32Array>;
  setDefaultAppVersion(v: FixVersion): void;
}
```

Files are read in the main thread with `File.stream()` +
`TextDecoderStream`, then handed to the worker. For very large files we
chunk by newlines and call `parse` per chunk, streaming partial results
into the store so the grid populates progressively.

---

## 8. Testing strategy

### 8.1 Parser (highest value)

- Table-driven Vitest tests in `tests/parser/`.
- Fixtures per version (4.2 / 4.4 / FIXT+5.0SP2) and per common MsgType
  (`D`, `8`, `F`, `G`, `9`, `0`, `5`, `A`, `W`, `X`).
- Delimiter variants: SOH, `|`, `^A`.
- Edge cases: missing checksum, trailing newline, mixed-version log,
  unknown tag, invalid enum, repeat groups, multi-line raw FIX.
- Property-based test (fast-check) for the tokenizer: any well-formed input
  round-trips through tokenize → render.

### 8.2 Components

- React Testing Library for `InputPanel`, `FilterBar`, `ColumnSettings`,
  `DetailPanel`.
- Snapshot the detail panel's rendered output against a known message —
  it's the most visible contract.

### 8.3 E2E

- Playwright, two specs:
  1. Paste a multi-message log → grid shows N rows → filter narrows it →
     click row → detail populates.
  2. Drop a file → progress indicator → grid populates → toggle a column
     → reload page → column toggle persists.

### 8.4 Performance

- A Vitest benchmark suite (`vitest bench`) on the parser against a
  generated 100k-message fixture. Asserts a wall-clock ceiling so
  regressions are visible in CI.

---

## 9. Build, CI, deploy

- **Dev**: `pnpm dev` (Vite).
- **Build**: `pnpm build` runs `scripts/build-dictionaries.ts` then
  `vite build`. Output: `dist/`, fully static.
- **Test**: `pnpm test` (Vitest), `pnpm test:e2e` (Playwright).
- **Lint/format**: ESLint (typescript-eslint) + Prettier; Tailwind plugin
  for class ordering.
- **CI**: GitHub Actions — install, typecheck, lint, unit tests, build,
  Playwright. Required before merge.
- **Deploy**: Cloudflare Pages, connected to the GitHub repo. `main`
  auto-deploys; PRs get preview URLs. Build command `pnpm build`, output
  `dist`. No env vars, no functions — pure static.

---

## 10. Privacy stance (explicit, surfaced in UI)

- No analytics, no telemetry, no error reporting service.
- No fonts loaded from third-party CDNs (self-host or use system fonts).
- CSP headers via `_headers` on Cloudflare Pages:
  `default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline';`
  (Tailwind generates a static stylesheet so `unsafe-inline` is only for
  shadcn's CSS variables; revisit if we can drop it.)
- An "About" link in the header states plainly: *"All parsing happens in
  your browser. Nothing is uploaded."*

---

## 11. Out of scope for v1

- Repeating-group reconstruction in the detail view (flat order only for now).
- Persisting parsed messages between sessions (OPFS / IndexedDB).
- Exporting filtered messages to CSV / JSON.
- Custom user-supplied dictionaries.
- Multi-file diffing / cross-correlation.
- FIX message construction / editing.

These are all reasonable v2 candidates and the architecture leaves room
for them.

---

## 12. Milestones

1. **M1 — Skeleton (1 PR).** Vite + React + TS + Tailwind + shadcn
   bootstrapped. Empty shell with theme toggle. CI + Cloudflare Pages
   wired up.
2. **M2 — Parser core.** `tokenize` + `parse` + `detect` + dictionary
   build step. Full parser test suite. No UI yet.
3. **M3 — Worker + minimal grid.** Worker wired, paste → parse → render
   a non-virtualized table of all fields. Detail panel scaffold.
4. **M4 — Production grid.** TanStack Table + Virtual, default columns,
   column settings, persistence, sort.
5. **M5 — Filters.** Per-column + global regex, debounced, in-worker.
6. **M6 — File input.** Drop zone, file picker, streaming reads,
   progressive population.
7. **M7 — Polish.** Empty / single-message states, warnings UI, copy raw,
   resizable split, accessibility pass.
8. **M8 — Perf + E2E.** 100k fixture, bench suite, Playwright specs,
   lighthouse audit.

Each milestone is a mergeable PR.
