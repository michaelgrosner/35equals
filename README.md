# 35equals

A browser-based FIX protocol log analyzer. Paste or drop a FIX log and get an interactive, field-level view of every message — no server, no uploads, fully private.

## Features

- **Multi-version support** — FIX 4.0 through 5.0SP2 and FIXT 1.1
- **Field decoding** — tag names, enumeration values, and repeating group structure from built-in FIX dictionaries
- **Interactive grid** — sortable, reorderable columns with virtual scrolling for large logs
- **Advanced filtering** — per-field filters with regex support and composable filter trees
- **Detail panel** — grouped field view with checksum validation and warnings for unknown tags or missing required fields
- **Keyboard navigation** — arrow keys, vim bindings, Enter/Escape
- **Dark mode**
- **Entirely client-side** — parsing runs in a Web Worker; nothing leaves your browser

## Getting Started

**Requirements:** Node ≥ 20, pnpm ≥ 9

```bash
pnpm install
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173).

## Build

```bash
pnpm build
pnpm preview
```

## Testing

```bash
pnpm test          # unit tests (Vitest)
pnpm test:e2e      # end-to-end tests (Playwright)
```

## Tech Stack

- React 18 + TypeScript
- Vite
- Tailwind CSS + Radix UI
- TanStack Table + TanStack Virtual
- Zustand
- Comlink (Web Worker bridge)

## License

MIT — see [LICENSE](LICENSE).
