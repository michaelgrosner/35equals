import { createColumnHelper } from '@tanstack/react-table';
import type { ParsedMessage } from '@/parser/types';
import { ColumnSettings } from '@/components/ColumnSettings';

function TagHeader({ name, tag }: { name: string; tag: number }) {
  return (
    <span>
      {name}{' '}
      <span className="text-muted-foreground/50 font-normal">{tag}</span>
    </span>
  );
}

export type GridRow = ParsedMessage;

const helper = createColumnHelper<GridRow>();

// Tag -> header name mapping for default visible columns
export const TAG_NAMES: Record<number, string> = {
  8: 'BeginString',
  35: 'MsgType',
  49: 'SenderCompID',
  56: 'TargetCompID',
  52: 'SendingTime',
  34: 'MsgSeqNum',
  11: 'ClOrdID',
  37: 'OrderID',
  17: 'ExecID',
  55: 'Symbol',
  54: 'Side',
  38: 'OrderQty',
  44: 'Price',
  40: 'OrdType',
  59: 'TimeInForce',
  39: 'OrdStatus',
  150: 'ExecType',
  6: 'AvgPx',
  14: 'CumQty',
  151: 'LeavesQty',
};

// Tags where sorting makes sense (numeric / timestamp types)
const SORTABLE_TAGS = new Set<number>([52, 34, 38, 44, 6, 14, 151]);

function cellValue(tag: number, row: GridRow): string | number {
  const raw = row.byTag.get(tag) ?? '';
  // Tag 52 is a timestamp, lexicographical sort is correct.
  if (SORTABLE_TAGS.has(tag) && tag !== 52) {
    const num = parseFloat(raw);
    return isNaN(num) ? raw : num;
  }
  return raw;
}

/** The default ordered list of visible tags (not including index col 0). */
export const DEFAULT_VISIBLE_TAGS = [
  35, 49, 56, 52, 34, 11, 37, 17, 55, 54, 38, 44, 40, 59, 39, 150, 6, 14,
  151,
] as const;

/** Column definition for the row-index column (always first). */
export const indexColumn = helper.display({
  id: '0',
  header: () => <ColumnSettings />,
  cell: (info) => info.row.original.lineNumber,
  size: 60,
  enableSorting: false,
});

/** Build a column definition for a given FIX tag number. */
export function makeTagColumn(tag: number) {
  const name = TAG_NAMES[tag] ?? `Tag${String(tag)}`;
  return helper.accessor((row) => cellValue(tag, row), {
    id: String(tag),
    header: () => <TagHeader name={name} tag={tag} />,
    size: 120,
    enableSorting: SORTABLE_TAGS.has(tag),
  });
}

/** All default column definitions in order: index + visible tags. */
export const defaultColumns = [
  indexColumn,
  ...DEFAULT_VISIBLE_TAGS.map(makeTagColumn),
];
