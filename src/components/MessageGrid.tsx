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

const ROW_HEIGHT = 28;

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
      <div ref={parentRef} className="flex-1 overflow-auto">
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
              return (
                <tr
                  key={row.id}
                  role="row"
                  aria-selected={isSelected}
                  style={{ height: ROW_HEIGHT }}
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
                    const isIndex = cell.column.id === '0';
                    const displayValue = isIndex
                      ? String(cell.row.index + 1)
                      : String(cell.getValue<string | number>() ?? '');
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
                        className={cn(
                          'font-mono',
                          isIndex ? 'text-muted-foreground' : ''
                        )}
                        title={displayValue}
                      >
                        {displayValue}
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
