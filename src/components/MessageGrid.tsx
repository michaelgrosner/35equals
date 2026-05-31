import { useRef, useState, useCallback, useEffect } from 'react';
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

const ROW_HEIGHT = 28;
const ROW_HEIGHT_PX = '28px';

export function MessageGrid() {
  const { messages, selectedIndex, setSelectedIndex } =
    useMessagesStore();
  const { columns: colSettings, setColumnVisible } = useSettingsStore();

  const [sorting, setSorting] = useState<SortingState>([]);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    colId: string;
  } | null>(null);

  const parentRef = useRef<HTMLDivElement>(null);

  // Build column setting lookup maps
  const visibilityMap = new Map(colSettings.map((c) => [c.tag, c.visible]));
  const widthMap = new Map(colSettings.map((c) => [c.tag, c.width]));

  // Build the ordered list of visible column defs
  const sortedSettings = [...colSettings].sort((a, b) => a.order - b.order);
  const visibleTagsOrdered = sortedSettings
    .filter((c) => c.visible)
    .map((c) => c.tag);

  // Build column definitions: index col always first, then visible tag cols
  const columnDefs: ColumnDef<GridRow>[] = [
    { ...indexColumn, size: 60 },
  ];

  // Add tag columns in the settings-defined order; fall back to default order
  const tagsToRender =
    visibleTagsOrdered.length > 0 ? visibleTagsOrdered : [...DEFAULT_VISIBLE_TAGS];

  for (const tag of tagsToRender) {
    if (visibilityMap.get(tag) !== false) {
      const col = makeTagColumn(tag) as ColumnDef<GridRow>;
      const width = widthMap.get(tag) ?? 120;
      col.size = width;
      columnDefs.push(col);
    }
  }

  const tableData: GridRow[] = messages;

  const table = useReactTable<GridRow>({
    data: tableData,
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

  // Scroll selected row into view
  useEffect(() => {
    if (selectedIndex === null) return;
    const rowIdx = rows.findIndex((r) => r.original.index === selectedIndex);
    if (rowIdx >= 0) {
      rowVirtualizer.scrollToIndex(rowIdx, { align: 'auto' });
    }
  }, [selectedIndex, rows, rowVirtualizer]);

  // Close context menu on outside click
  useEffect(() => {
    if (contextMenu === null) return;
    const handle = () => { setContextMenu(null); };
    window.addEventListener('click', handle);
    return () => { window.removeEventListener('click', handle); };
  }, [contextMenu]);

  const handleHeaderContextMenu = useCallback(
    (e: React.MouseEvent, colId: string) => {
      if (colId === '0') return; // index col cannot be hidden
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

  const headerGroups = table.getHeaderGroups();

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Sticky header */}
      <div className="overflow-hidden border-b bg-background z-10 flex-shrink-0">
        <table className="border-collapse table-fixed" style={{ width: 'max-content' }}>
          <thead>
            {headerGroups.map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  const canSort = header.column.getCanSort();
                  return (
                    <th
                      key={header.id}
                      style={{ width: header.getSize() }}
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
        </table>
      </div>

      {/* Virtualized body */}
      <div
        ref={parentRef}
        className="flex-1 overflow-y-auto overflow-x-auto"
      >
        <div style={{ height: totalSize, position: 'relative', width: 'max-content', minWidth: '100%' }}>
          {virtualItems.map((virtualRow) => {
            const row = rows[virtualRow.index];
            if (row === undefined) return null;
            const isSelected = selectedIndex === row.original.index;
            return (
              <div
                key={row.id}
                role="row"
                aria-selected={isSelected}
                style={{
                  position: 'absolute',
                  top: virtualRow.start,
                  height: ROW_HEIGHT,
                  display: 'table',
                  tableLayout: 'fixed',
                  width: 'max-content',
                  minWidth: '100%',
                }}
                className={cn(
                  'cursor-pointer border-b border-border transition-colors',
                  isSelected
                    ? 'bg-primary/10 hover:bg-primary/15'
                    : 'hover:bg-muted/50'
                )}
                onClick={() => {
                  setSelectedIndex(isSelected ? null : row.original.index);
                }}
              >
                {row.getVisibleCells().map((cell) => {
                  const rawValue = cell.getValue<string | number>();
                  const displayValue = String(rawValue);
                  const isIndex = cell.column.id === '0';
                  return (
                    <div
                      key={cell.id}
                      style={{
                        width: cell.column.getSize(),
                        display: 'table-cell',
                        verticalAlign: 'middle',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        paddingLeft: 8,
                        paddingRight: 8,
                        fontSize: '0.75rem',
                        lineHeight: ROW_HEIGHT_PX,
                      }}
                      className={cn(
                        'font-mono',
                        isIndex ? 'text-muted-foreground' : ''
                      )}
                      title={displayValue}
                    >
                      {displayValue}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Context menu */}
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
