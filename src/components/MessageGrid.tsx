import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type SortingState,
  type ColumnDef,
  type ColumnSizingState,
  type ColumnPinningState,
  type Header,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMessagesStore } from '@/state/messages';
import { useSettingsStore } from '@/state/settings';
import { makeTagColumn, indexColumn, DEFAULT_VISIBLE_TAGS, TAG_NAMES } from '@/lib/columns';
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

// ── Sortable header cell ────────────────────────────────────────────────────

interface SortableHeaderProps {
  header: Header<GridRow, unknown>;
  onContextMenu: (e: React.MouseEvent) => void;
}

function SortableHeader({ header, onContextMenu }: SortableHeaderProps) {
  const isIndex = header.column.id === '0';
  const isPinned = header.column.getIsPinned();
  const sorted = header.column.getIsSorted();
  const canSort = header.column.getCanSort();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: header.column.id, disabled: isIndex });

  const style: React.CSSProperties = {
    width: header.getSize(),
    minWidth: header.getSize(),
    position: isPinned ? 'sticky' : 'relative',
    left: isPinned === 'left' ? header.column.getStart('left') : undefined,
    right: isPinned === 'right' ? header.column.getAfter('right') : undefined,
    transform: isDragging ? CSS.Transform.toString(transform) : undefined,
    transition,
    zIndex: isDragging ? 30 : isPinned ? 20 : undefined,
  };

  return (
    <th
      ref={setNodeRef}
      style={style}
      className={cn(
        'text-left text-xs font-semibold text-muted-foreground whitespace-nowrap select-none relative',
        isPinned && 'bg-background shadow-[1px_0_0_0_hsl(var(--border))]',
        isDragging && 'opacity-60',
      )}
      onContextMenu={isIndex ? undefined : onContextMenu}
    >
      <div className="flex items-center gap-0.5 px-2 py-1.5">
        {/* Drag grip — only on non-index columns */}
        {!isIndex && (
          <span
            {...attributes}
            {...listeners}
            className="cursor-grab text-muted-foreground/25 hover:text-muted-foreground/60 select-none flex-shrink-0 leading-none"
            title="Drag to reorder"
          >
            ⠿
          </span>
        )}
        {/* Sort label */}
        <span
          className={cn(
            'flex items-center gap-1 flex-1 min-w-0',
            canSort && 'cursor-pointer hover:text-foreground'
          )}
          onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
        >
          {flexRender(header.column.columnDef.header, header.getContext())}
          {sorted === 'asc' && <span className="text-primary">▲</span>}
          {sorted === 'desc' && <span className="text-primary">▼</span>}
        </span>
      </div>
      {/* Resize handle */}
      {!isIndex && (
        <div
          onMouseDown={header.getResizeHandler()}
          onTouchStart={header.getResizeHandler()}
          className={cn(
            'absolute right-0 top-0 h-full w-1 cursor-col-resize touch-none select-none',
            header.column.getIsResizing() ? 'bg-primary' : 'hover:bg-primary/40'
          )}
        />
      )}
    </th>
  );
}

// ── Main grid component ─────────────────────────────────────────────────────

export function MessageGrid() {
  const { messages, filteredIndices, selectedIndex, setSelectedIndex } =
    useMessagesStore();
  const {
    columns: colSettings,
    setColumnVisible,
    setColumnWidth,
    setColumnOrder,
    setColumnPinned,
  } = useSettingsStore();

  const displayedMessages = useMemo(() => {
    if (!filteredIndices) return messages;
    const result = new Array(filteredIndices.length);
    for (let i = 0; i < filteredIndices.length; i++) {
      result[i] = messages[filteredIndices[i]!];
    }
    return result;
  }, [messages, filteredIndices]);

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
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

  // Derive pinning state from settings — index col always pinned left
  const columnPinning = useMemo((): ColumnPinningState => {
    const left: string[] = ['0'];
    const right: string[] = [];
    for (const c of colSettings) {
      if (c.pinned === 'left') left.push(String(c.tag));
      else if (c.pinned === 'right') right.push(String(c.tag));
    }
    return { left, right };
  }, [colSettings]);

  const table = useReactTable<GridRow>({
    data: displayedMessages,
    columns: columnDefs,
    state: { sorting, columnSizing, columnPinning },
    onSortingChange: setSorting,
    onColumnSizingChange: (updater) => {
      setColumnSizing((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        for (const [id, size] of Object.entries(next)) {
          if (prev[id] !== size) {
            const tag = parseInt(id, 10);
            if (!isNaN(tag)) setColumnWidth(tag, size);
          }
        }
        return next;
      });
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    columnResizeMode: 'onChange',
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

  // Stable refs for keydown handler (avoids stale closures)
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

  // ── DnD reorder ──────────────────────────────────────────────────────────

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeTag = parseInt(String(active.id), 10);
    const overTag = parseInt(String(over.id), 10);
    if (isNaN(activeTag) || isNaN(overTag)) return;

    const activeIdx = visibleTagsOrdered.indexOf(activeTag);
    const overIdx = visibleTagsOrdered.indexOf(overTag);
    if (activeIdx === -1 || overIdx === -1) return;

    const newVisible = [...visibleTagsOrdered];
    newVisible.splice(activeIdx, 1);
    newVisible.splice(overIdx, 0, activeTag);

    // Preserve hidden columns at the end in their current relative order
    const hiddenTags = colSettings
      .filter((c) => !c.visible)
      .sort((a, b) => a.order - b.order)
      .map((c) => c.tag);

    setColumnOrder([...newVisible, ...hiddenTags]);
  }, [visibleTagsOrdered, colSettings, setColumnOrder]);

  // ── Context menu handlers ─────────────────────────────────────────────────

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

  const handlePinColumn = useCallback((pinned: 'left' | 'right' | null) => {
    if (contextMenu === null) return;
    const tag = parseInt(contextMenu.colId, 10);
    setColumnPinned(tag, pinned);
    setContextMenu(null);
  }, [contextMenu, setColumnPinned]);

  const fitAllColumns = useCallback(() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Derive actual fonts from a rendered cell/header if available, else fall back
    const sampleTh = parentRef.current?.querySelector('th');
    const sampleTd = parentRef.current?.querySelector('td');
    const headerFont = sampleTh ? getComputedStyle(sampleTh).font : '600 12px sans-serif';
    const cellFont = sampleTd ? getComputedStyle(sampleTd).font : '400 12px monospace';

    const HEADER_PAD = 44; // grip(16) + sort arrow(10) + padding(18)
    const CELL_PAD = 20;   // 8px left + 8px right + 4px buffer

    const newSizing: ColumnSizingState = {};

    for (const tag of tagsToRender) {
      const id = String(tag);

      // Measure header text (name + tag number)
      ctx.font = headerFont;
      const name = TAG_NAMES[tag] ?? `Tag${String(tag)}`;
      let maxW = ctx.measureText(`${name} ${String(tag)}`).width + HEADER_PAD;

      // Measure every cell value in all displayed messages
      ctx.font = cellFont;
      for (const msg of displayedMessages) {
        const raw = msg.byTag.get(tag) ?? '';
        if (!raw) continue;
        const fmt = formatValue(tag, raw);
        // Chips show "LABEL raw" inline — measure the combined string
        const display = (fmt.isChip && raw !== fmt.text) ? `${fmt.text} ${raw}` : fmt.text;
        const w = ctx.measureText(display).width + CELL_PAD;
        if (w > maxW) maxW = w;
      }

      newSizing[id] = Math.max(60, Math.min(400, Math.ceil(maxW)));
    }

    setColumnSizing((prev) => {
      const merged = { ...prev, ...newSizing };
      for (const [id, size] of Object.entries(newSizing)) {
        const tag = parseInt(id, 10);
        if (!isNaN(tag)) setColumnWidth(tag, size);
      }
      return merged;
    });

    setContextMenu(null);
  }, [tagsToRender, displayedMessages, setColumnWidth]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (messages.length === 0) return null;

  const colCount = columnDefs.length;
  const headerGroups = table.getHeaderGroups();

  // IDs for SortableContext — exclude index column ('0')
  const sortableIds = headerGroups[0]?.headers
    .filter((h) => h.column.id !== '0')
    .map((h) => h.column.id) ?? [];

  const contextColPinned = contextMenu !== null
    ? (colSettings.find((c) => String(c.tag) === contextMenu.colId)?.pinned ?? null)
    : null;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div ref={parentRef} id="grid-scroll" tabIndex={0} className="flex-1 overflow-auto focus:outline-none">
          <table
            className="border-collapse"
            style={{ width: table.getTotalSize(), minWidth: '100%', tableLayout: 'fixed' }}
          >
            <thead className="sticky top-0 z-10 bg-background">
              {headerGroups.map((hg) => (
                <SortableContext
                  key={hg.id}
                  items={sortableIds}
                  strategy={horizontalListSortingStrategy}
                >
                  <tr className="border-b border-border">
                    {hg.headers.map((header) => (
                      <SortableHeader
                        key={header.id}
                        header={header}
                        onContextMenu={(e) => { handleHeaderContextMenu(e, header.column.id); }}
                      />
                    ))}
                  </tr>
                </SortableContext>
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
                      const isPinned = cell.column.getIsPinned();

                      const pinnedStyle: React.CSSProperties = isPinned ? {
                        position: 'sticky',
                        left: isPinned === 'left' ? cell.column.getStart('left') : undefined,
                        right: isPinned === 'right' ? cell.column.getAfter('right') : undefined,
                        zIndex: 10,
                      } : {};

                      // Pinned cells need a solid background to cover scrolling rows behind them
                      const pinnedBg = isPinned
                        ? (isSelected ? 'bg-primary/10' : 'bg-background')
                        : '';

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
                              width: cell.column.getSize(),
                              ...pinnedStyle,
                            }}
                            className={cn('font-mono text-muted-foreground overflow-hidden', pinnedBg)}
                          >
                            {String(cell.row.original.lineNumber)}
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
                            width: cell.column.getSize(),
                            ...pinnedStyle,
                          }}
                          className={cn('overflow-hidden', pinnedBg)}
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
      </DndContext>

      {contextMenu !== null && (
        <div
          className="fixed z-50 rounded-md border bg-popover shadow-md py-1 text-sm"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => { e.stopPropagation(); }}
        >
          <button
            className="w-full px-4 py-1.5 text-left hover:bg-muted text-sm"
            onClick={fitAllColumns}
          >
            Resize all to fit
          </button>
          <div className="border-t border-border mx-2 my-1" />
          {contextColPinned !== 'left' && (
            <button
              className="w-full px-4 py-1.5 text-left hover:bg-muted text-sm"
              onClick={() => { handlePinColumn('left'); }}
            >
              Pin left
            </button>
          )}
          {contextColPinned !== 'right' && (
            <button
              className="w-full px-4 py-1.5 text-left hover:bg-muted text-sm"
              onClick={() => { handlePinColumn('right'); }}
            >
              Pin right
            </button>
          )}
          {contextColPinned !== null && (
            <button
              className="w-full px-4 py-1.5 text-left hover:bg-muted text-sm"
              onClick={() => { handlePinColumn(null); }}
            >
              Unpin
            </button>
          )}
          {contextColPinned !== null && (
            <div className="border-t border-border mx-2 my-1" />
          )}
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
