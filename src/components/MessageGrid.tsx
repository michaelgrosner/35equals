import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type SortingState,
  type ColumnDef,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useMessagesStore } from '@/state/messages';
import { useSettingsStore } from '@/state/settings';
import { makeTagColumn, indexColumn, DEFAULT_VISIBLE_TAGS } from '@/lib/columns';
import type { GridRow } from '@/lib/columns';
import { cn } from '@/lib/utils';
import { formatValue, type Tone } from '@/lib/format';

const ROW_HEIGHT = 28;

const CHIP_BASE = 'inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase';
const CHIP_DEFAULT = `${CHIP_BASE} bg-secondary text-secondary-foreground`;

const TONE_CHIP: Record<string, string> = {
  rose:    `${CHIP_BASE} bg-tone-rose/15 text-tone-rose`,
  emerald: `${CHIP_BASE} bg-tone-emerald/15 text-tone-emerald`,
  amber:   `${CHIP_BASE} bg-tone-amber/15 text-tone-amber`,
  sky:     `${CHIP_BASE} bg-tone-sky/15 text-tone-sky`,
  indigo:  `${CHIP_BASE} bg-tone-indigo/15 text-tone-indigo`,
  violet:  `${CHIP_BASE} bg-tone-violet/15 text-tone-violet`,
  teal:    `${CHIP_BASE} bg-tone-teal/15 text-tone-teal`,
  slate:   `${CHIP_BASE} bg-tone-slate/15 text-tone-slate`,
  neutral: `${CHIP_BASE} bg-tone-neutral/15 text-tone-neutral`,
  muted:   `${CHIP_BASE} bg-tone-muted/15 text-tone-muted`,
  peach:   `${CHIP_BASE} bg-tone-peach/15 text-tone-peach`,
  pink:    `${CHIP_BASE} bg-tone-pink/15 text-tone-pink`,
};

const TONE_TEXT: Record<string, string> = {
  rose: 'text-tone-rose', emerald: 'text-tone-emerald', amber: 'text-tone-amber',
  sky: 'text-tone-sky', indigo: 'text-tone-indigo', violet: 'text-tone-violet',
  teal: 'text-tone-teal', slate: 'text-tone-slate', neutral: 'text-tone-neutral',
  muted: 'text-tone-muted', peach: 'text-tone-peach', pink: 'text-tone-pink',
};

function getToneClass(tone: Tone | undefined, isChip: boolean): string {
  if (!tone) return isChip ? CHIP_DEFAULT : '';
  return isChip ? (TONE_CHIP[tone] ?? CHIP_DEFAULT) : (TONE_TEXT[tone] ?? '');
}

export function MessageGrid() {
  const { messages, filteredIndices, selectedIndex, setSelectedIndex } =
    useMessagesStore();
  const { columns: colSettings, setColumnVisible } = useSettingsStore();

  const displayedMessages = useMemo(() => {
    if (!filteredIndices) return messages;
    const result = new Array(filteredIndices.length);
    for (let i = 0; i < filteredIndices.length; i++) {
      result[i] = messages[filteredIndices[i]!];
    }
    return result;
  }, [messages, filteredIndices]);

  const [sorting, setSorting] = useState<SortingState>([]);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    colId: string;
  } | null>(null);

  const parentRef = useRef<HTMLDivElement>(null);

  const visibilityMap = new Map(colSettings.map((c) => [c.tag, c.visible]));
  const widthMap = new Map(colSettings.map((c) => [c.tag, c.width]));

  const sortedSettings = [...colSettings].sort((a, b) => a.order - b.order);
  const visibleTagsOrdered = sortedSettings
    .filter((c) => c.visible)
    .map((c) => c.tag);

  const columnDefs: ColumnDef<GridRow>[] = [
    { ...indexColumn, size: 48 },
  ];

  const tagsToRender =
    visibleTagsOrdered.length > 0 ? visibleTagsOrdered : [...DEFAULT_VISIBLE_TAGS];

  for (const tag of tagsToRender) {
    if (visibilityMap.get(tag) !== false) {
      const col = makeTagColumn(tag) as ColumnDef<GridRow>;
      col.size = widthMap.get(tag) ?? 120;
      columnDefs.push(col);
    }
  }

  const table = useReactTable<GridRow>({
    data: displayedMessages,
    columns: columnDefs,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
  });

  const { rows } = table.getRowModel();

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const paddingTop = virtualItems.length > 0 ? (virtualItems[0]?.start ?? 0) : 0;
  const paddingBottom =
    virtualItems.length > 0
      ? totalSize - (virtualItems[virtualItems.length - 1]?.end ?? 0)
      : 0;

  useEffect(() => {
    if (selectedIndex === null) return;
    const rowIdx = rows.findIndex((r) => r.original.index === selectedIndex);
    if (rowIdx >= 0) {
      rowVirtualizer.scrollToIndex(rowIdx, { align: 'auto' });
    }
  }, [selectedIndex, rows, rowVirtualizer]);

  // Keep stable refs so the keydown closure never goes stale
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const selectedIndexRef = useRef(selectedIndex);
  selectedIndexRef.current = selectedIndex;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (e.target as Element).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const currentRows = rowsRef.current;
      const currentSelected = selectedIndexRef.current;
      if (currentRows.length === 0) return;

      const pos = currentSelected !== null
        ? currentRows.findIndex((r) => r.original.index === currentSelected)
        : -1;

      switch (e.key) {
        case 'ArrowUp':
        case 'k': {
          e.preventDefault();
          const next = pos <= 0 ? 0 : pos - 1;
          setSelectedIndex(currentRows[next]!.original.index);
          parentRef.current?.focus({ preventScroll: true });
          break;
        }
        case 'ArrowDown':
        case 'j': {
          e.preventDefault();
          const next = pos < 0 ? 0 : Math.min(pos + 1, currentRows.length - 1);
          setSelectedIndex(currentRows[next]!.original.index);
          parentRef.current?.focus({ preventScroll: true });
          break;
        }
        case 'g': {
          setSelectedIndex(currentRows[0]!.original.index);
          parentRef.current?.focus({ preventScroll: true });
          break;
        }
        case 'G': {
          setSelectedIndex(currentRows[currentRows.length - 1]!.original.index);
          parentRef.current?.focus({ preventScroll: true });
          break;
        }
        case 'Enter': {
          if (currentSelected !== null) {
            document.getElementById('detail-scroll')?.focus();
          }
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setSelectedIndex]);

  useEffect(() => {
    if (contextMenu === null) return;
    const handle = () => { setContextMenu(null); };
    window.addEventListener('click', handle);
    return () => { window.removeEventListener('click', handle); };
  }, [contextMenu]);

  const handleHeaderContextMenu = useCallback(
    (e: React.MouseEvent, colId: string) => {
      if (colId === '0') return;
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, colId });
    },
    []
  );

  const handleHideColumn = useCallback(() => {
    if (contextMenu === null) return;
    const tag = parseInt(contextMenu.colId, 10);
    setColumnVisible(tag, false);
    setContextMenu(null);
  }, [contextMenu, setColumnVisible]);

  if (messages.length === 0) return null;

  const colCount = columnDefs.length;
  const headerGroups = table.getHeaderGroups();

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Single scroll container — thead is sticky so header scrolls
          horizontally with the body, eliminating misalignment. */}
      <div ref={parentRef} id="grid-scroll" tabIndex={0} className="flex-1 overflow-auto focus:outline-none">
        <table
          className="border-collapse"
          style={{ width: 'max-content', minWidth: '100%' }}
        >
          <thead className="sticky top-0 z-10 bg-background">
            {headerGroups.map((hg) => (
              <tr key={hg.id} className="border-b border-border">
                {hg.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  const canSort = header.column.getCanSort();
                  return (
                    <th
                      key={header.id}
                      className="px-2 py-1.5 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap select-none"
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                      onContextMenu={(e) => { handleHeaderContextMenu(e, header.column.id); }}
                    >
                      <span
                        className={cn(
                          'flex items-center gap-1',
                          canSort && 'cursor-pointer hover:text-foreground'
                        )}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sorted === 'asc' && <span className="text-primary">▲</span>}
                        {sorted === 'desc' && <span className="text-primary">▼</span>}
                      </span>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {paddingTop > 0 && (
              <tr>
                <td colSpan={colCount} style={{ height: paddingTop }} />
              </tr>
            )}
            {virtualItems.map((virtualRow) => {
              const row = rows[virtualRow.index];
              if (row === undefined) return null;
              const isSelected = selectedIndex === row.original.index;
              const msg = row.original;
              const hasErrors = msg.warnings.some((w) => w.type === 'BAD_CHECKSUM');
              const hasWarnings = msg.warnings.length > 0;

              return (
                <tr
                  key={row.id}
                  role="row"
                  aria-selected={isSelected}
                  style={{ height: ROW_HEIGHT }}
                  className={cn(
                    'cursor-pointer border-b border-border transition-colors relative',
                    isSelected
                      ? 'bg-primary/10 hover:bg-primary/15'
                      : 'hover:bg-muted/50',
                    hasErrors && 'border-l-2 border-l-tone-rose',
                    !hasErrors && hasWarnings && 'border-l-2 border-l-tone-amber'
                  )}
                  onClick={() => {
                    setSelectedIndex(isSelected ? null : row.original.index);
                  }}
                >
                  {row.getVisibleCells().map((cell) => {
                    const isIndex = cell.column.id === '0';
                    if (isIndex) {
                      return (
                        <td
                          key={cell.id}
                          style={{
                            paddingLeft: 8,
                            paddingRight: 8,
                            fontSize: '0.75rem',
                            height: ROW_HEIGHT,
                            verticalAlign: 'middle',
                            whiteSpace: 'nowrap',
                          }}
                          className="font-mono text-muted-foreground"
                        >
                          {String(cell.row.index + 1)}
                        </td>
                      );
                    }

                    const tag = parseInt(cell.column.id, 10);
                    const rawValue = msg.byTag.get(tag) ?? '';
                    const formatted = formatValue(tag, rawValue);

                    return (
                      <td
                        key={cell.id}
                        style={{
                          paddingLeft: 8,
                          paddingRight: 8,
                          fontSize: '0.75rem',
                          height: ROW_HEIGHT,
                          verticalAlign: 'middle',
                          whiteSpace: 'nowrap',
                          textAlign: formatted.align ?? 'left',
                        }}
                        title={formatted.title ?? rawValue}
                      >
                        <div className={cn("flex items-baseline gap-1.5", formatted.align === 'right' ? "justify-end" : "")}>
                          <div className={cn('font-mono', getToneClass(formatted.tone, !!formatted.isChip))}>
                            {formatted.rendered ?? formatted.text}
                          </div>
                          {formatted.isChip && rawValue !== formatted.text && (
                            <span className="font-mono text-[10px] text-muted-foreground opacity-60">{rawValue}</span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {paddingBottom > 0 && (
              <tr>
                <td colSpan={colCount} style={{ height: paddingBottom }} />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {contextMenu !== null && (
        <div
          className="fixed z-50 rounded-md border bg-popover shadow-md py-1 text-sm"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => { e.stopPropagation(); }}
        >
          <button
            className="w-full px-4 py-1.5 text-left hover:bg-muted text-sm"
            onClick={handleHideColumn}
          >
            Hide column
          </button>
        </div>
      )}
    </div>
  );
}
