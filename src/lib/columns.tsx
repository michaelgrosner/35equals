import { createColumnHelper } from '@tanstack/react-table';
import type { ParsedMessage } from '@/parser/types';

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
const TAG_NAMES: Record<number, string> = {
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

// Enum label overrides for tag 35 (MsgType)
const MSG_TYPE_LABELS: Record<string, string> = {
  '0': 'Heartbeat',
  '1': 'TestRequest',
  '2': 'ResendRequest',
  '3': 'Reject',
  '4': 'SequenceReset',
  '5': 'Logout',
  '6': 'IndicationofInterest',
  '7': 'Advertisement',
  '8': 'ExecutionReport',
  '9': 'OrderCancelReject',
  A: 'Logon',
  B: 'News',
  C: 'Email',
  D: 'NewOrderSingle',
  E: 'NewOrderList',
  F: 'OrderCancelRequest',
  G: 'OrderCancelReplaceRequest',
  H: 'OrderStatusRequest',
  J: 'Allocation',
  K: 'ListCancelRequest',
  L: 'ListExecute',
  M: 'ListStatusRequest',
  N: 'ListStatus',
  P: 'AllocationACK',
  Q: 'DontKnowTrade',
  R: 'QuoteRequest',
  S: 'Quote',
  T: 'SettlementInstructions',
  V: 'MarketDataRequest',
  W: 'MarketDataSnapshotFullRefresh',
  X: 'MarketDataIncrementalRefresh',
  Y: 'MarketDataRequestReject',
  Z: 'QuoteCancel',
  a: 'QuoteStatusRequest',
  b: 'QuoteAcknowledgement',
  c: 'SecurityDefinitionRequest',
  d: 'SecurityDefinition',
  e: 'SecurityStatusRequest',
  f: 'SecurityStatus',
  g: 'TradingSessionStatusRequest',
  h: 'TradingSessionStatus',
  i: 'MassQuote',
  j: 'BusinessMessageReject',
  k: 'BidRequest',
  l: 'BidResponse',
  m: 'ListStrikePrice',
};

// Enum label overrides for tag 54 (Side)
const SIDE_LABELS: Record<string, string> = {
  '1': 'Buy',
  '2': 'Sell',
  '3': 'BuyMinus',
  '4': 'SellPlus',
  '5': 'SellShort',
  '6': 'SellShortExempt',
  '7': 'Undisclosed',
  '8': 'Cross',
  '9': 'CrossShort',
};

function cellValue(tag: number, row: GridRow): string {
  const raw = row.byTag.get(tag) ?? '';
  if (tag === 35) {
    // Prefer the parsed msgType label, then enum lookup, then raw
    if (row.msgType !== undefined) return row.msgType;
    return MSG_TYPE_LABELS[raw] ?? raw;
  }
  if (tag === 54) {
    return SIDE_LABELS[raw] ?? raw;
  }
  return raw;
}

/** The default ordered list of visible tags (not including index col 0). */
export const DEFAULT_VISIBLE_TAGS = [
  8, 35, 49, 56, 52, 34, 11, 37, 17, 55, 54, 38, 44, 40, 59, 39, 150, 6, 14,
  151,
] as const;

/** Column definition for the row-index column (always first). */
export const indexColumn = helper.display({
  id: '0',
  header: '#',
  cell: (info) => info.row.index + 1,
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
