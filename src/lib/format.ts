import React from 'react';
import type { FieldType } from '@/parser/types';

export type Tone =
  | 'rose'
  | 'emerald'
  | 'amber'
  | 'sky'
  | 'indigo'
  | 'violet'
  | 'teal'
  | 'slate'
  | 'neutral'
  | 'muted'
  | 'peach'
  | 'pink';

export interface FormattedValue {
  text: string;
  rendered?: React.ReactNode;
  title?: string;
  align?: 'left' | 'right';
  tone?: Tone | undefined;
  isChip?: boolean;
}

// Static mapping for common tags to avoid dictionary dependency for every cell
const COMMON_TAG_TYPES: Record<number, FieldType> = {
  6: 'PRICE',
  14: 'QTY',
  34: 'SEQNUM',
  35: 'STRING', // MsgType
  38: 'QTY',
  39: 'STRING', // OrdStatus
  40: 'CHAR',   // OrdType
  44: 'PRICE',
  52: 'UTCTIMESTAMP',
  54: 'CHAR',   // Side
  59: 'CHAR',   // TimeInForce
  60: 'UTCTIMESTAMP',
  150: 'CHAR',  // ExecType
  151: 'QTY',
};

// Enum label overrides for tag 35 (MsgType)
const MSG_TYPE_LABELS: Record<string, string> = {
  '0': 'Heartbeat',
  '1': 'Test Request',
  '2': 'Resend Request',
  '3': 'Reject',
  '4': 'Sequence Reset',
  '5': 'Logout',
  '6': 'Indication of Interest',
  '7': 'Advertisement',
  '8': 'Execution Report',
  '9': 'Order Cancel Reject',
  A: 'Logon',
  B: 'News',
  C: 'Email',
  D: 'New Order Single',
  E: 'New Order List',
  F: 'Order Cancel Request',
  G: 'Order Cancel Replace Request',
  H: 'Order Status Request',
  J: 'Allocation',
  K: 'List Cancel Request',
  L: 'List Execute',
  M: 'List Status Request',
  N: 'List Status',
  P: 'Allocation ACK',
  Q: 'Dont Know Trade',
  R: 'Quote Request',
  S: 'Quote',
  T: 'Settlement Instructions',
  V: 'Market Data Request',
  W: 'Market Data Snapshot Full Refresh',
  X: 'Market Data Incremental Refresh',
  Y: 'Market Data Request Reject',
  Z: 'Quote Cancel',
  a: 'Quote Status Request',
  b: 'Quote Acknowledgement',
  c: 'Security Definition Request',
  d: 'Security Definition',
  e: 'Security Status Request',
  f: 'Security Status',
  g: 'Trading Session Status Request',
  h: 'Trading Session Status',
  i: 'Mass Quote',
  j: 'Business Message Reject',
  k: 'Bid Request',
  l: 'Bid Response',
  m: 'List Strike Price',
  // FIX 4.4+
  AB: 'New Order Multileg',
  AC: 'Multileg Order Cancel Replace',
  AE: 'Trade Capture Report',
  AF: 'Order Mass Status Request',
  AK: 'Confirmation',
  AP: 'Position Report',
  AR: 'Trade Capture Report Ack',
  AS: 'Allocation Report',
  AU: 'Confirmation Ack',
  AX: 'Collateral Request',
  AY: 'Collateral Assignment',
  AZ: 'Collateral Response',
};

// Enum label overrides for tag 54 (Side)
const SIDE_LABELS: Record<string, string> = {
  '1': 'Buy',
  '2': 'Sell',
  '3': 'Buy Minus',
  '4': 'Sell Plus',
  '5': 'Sell Short',
  '6': 'Sell Short Exempt',
  '7': 'Undisclosed',
  '8': 'Cross',
  '9': 'Cross Short',
};

// Enum label overrides for tag 40 (OrdType)
const ORD_TYPE_LABELS: Record<string, string> = {
  '1': 'Market',
  '2': 'Limit',
  '3': 'Stop',
  '4': 'Stop Limit',
  'P': 'Pegged',
};

// Enum label overrides for tag 39 (OrdStatus)
const ORD_STATUS_LABELS: Record<string, string> = {
  '0': 'New',
  '1': 'Partial Fill',
  '2': 'Filled',
  '3': 'Done for Day',
  '4': 'Canceled',
  '5': 'Replaced',
  '6': 'Pending Cancel',
  '7': 'Stopped',
  '8': 'Rejected',
  '9': 'Suspended',
  'A': 'Pending New',
  'B': 'Calculated',
  'C': 'Expired',
  'D': 'Accepted for Bidding',
  'E': 'Pending Replace',
};

// Enum label overrides for tag 150 (ExecType)
const EXEC_TYPE_LABELS: Record<string, string> = {
  '0': 'New',
  '1': 'Partial Fill',
  '2': 'Fill',
  '3': 'Done for Day',
  '4': 'Canceled',
  '5': 'Replace',
  '6': 'Pending Cancel',
  '7': 'Stopped',
  '8': 'Rejected',
  '9': 'Suspended',
  'A': 'Pending New',
  'B': 'Calculated',
  'C': 'Expired',
  'D': 'Restated',
  'E': 'Pending Replace',
  'F': 'Trade',
  'G': 'Trade Correct',
  'H': 'Trade Cancel',
  'I': 'Order Status',
};

// Enum label overrides for tag 59 (TimeInForce)
const TIME_IN_FORCE_LABELS: Record<string, string> = {
  '0': 'Day',
  '1': 'GTC',
  '2': 'At Opening',
  '3': 'IOC',
  '4': 'FOK',
  '5': 'Good Till Crossing',
  '6': 'GTD',
  '7': 'At Close',
};

export function formatValue(
  tag: number,
  rawValue: string,
  type?: FieldType,
  enumLabel?: string
): FormattedValue {
  if (!rawValue) return { text: '', align: 'left' };

  const effectiveType = type ?? COMMON_TAG_TYPES[tag];

  // 1. Handle Enums — any resolved label becomes a chip
  const tone = getTone(tag, rawValue);

  let label = enumLabel;
  if (!label) {
    if (tag === 35) label = MSG_TYPE_LABELS[rawValue];
    if (tag === 39) label = ORD_STATUS_LABELS[rawValue];
    if (tag === 40) label = ORD_TYPE_LABELS[rawValue];
    if (tag === 54) label = SIDE_LABELS[rawValue];
    if (tag === 59) label = TIME_IN_FORCE_LABELS[rawValue];
    if (tag === 150) label = EXEC_TYPE_LABELS[rawValue];
  }

  if (label) {
    return {
      text: label,
      title: rawValue,
      align: 'left',
      tone,
      isChip: true,
    };
  }

  // 2. Handle types
  switch (effectiveType) {
    case 'UTCTIMESTAMP':
      return formatTimestamp(rawValue);
    case 'UTCTIMEONLY':
      return formatTimeOnly(rawValue);
    case 'UTCDATEONLY':
    case 'LOCALMKTDATE':
      return formatDateOnly(rawValue);
    case 'PRICE':
    case 'QTY':
    case 'AMT':
    case 'FLOAT':
    case 'PERCENTAGE':
    case 'PRICEOFFSET':
      return formatNumeric(rawValue);
    case 'INT':
    case 'SEQNUM':
    case 'LENGTH':
    case 'NUMINGROUP':
      return formatNumeric(rawValue);
    case 'BOOLEAN':
      return formatBoolean(rawValue);
    case 'CURRENCY':
    case 'EXCHANGE':
    case 'COUNTRY':
      return { text: rawValue, align: 'right' };
    case 'MULTIPLEVALUESTRING':
    case 'MULTIPLECHARVALUE':
      return { text: rawValue.split(' ').join(' · '), align: 'left' };
    default:
      return {
        text: rawValue,
        align: 'left',
      };
  }
}

function formatTimestamp(raw: string): FormattedValue {
  // YYYYMMDD-HH:MM:SS[.sss]
  if (raw.length < 17) return { text: raw, align: 'right' };
  
  const y = raw.slice(0, 4);
  const m = raw.slice(4, 6);
  const d = raw.slice(6, 8);
  const time = raw.slice(9);
  
  const formatted = `${y}-${m}-${d} ${time}Z`;

  // Try to calculate relative time
  let title = raw;
  try {
    const dateStr = `${y}-${m}-${d}T${time.replace(/:/g, ':')}Z`;
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      if (Math.abs(diffMin) < 60) {
        title = `${raw} (${String(Math.abs(diffMin))} min ${diffMin > 0 ? 'ago' : 'from now'})`;
      } else {
        const diffHours = Math.floor(diffMin / 60);
        if (Math.abs(diffHours) < 24) {
          title = `${raw} (${String(Math.abs(diffHours))} hours ${diffHours > 0 ? 'ago' : 'from now'})`;
        }
      }
    }
  } catch {
    // ignore
  }

  return { text: formatted, align: 'right', title };
}

function formatTimeOnly(raw: string): FormattedValue {
  // HH:MM:SS[.sss]
  const parts = raw.split('.');
  if (parts.length === 2) {
    return {
      text: raw,
      rendered: React.createElement(
        'span',
        null,
        parts[0],
        React.createElement(
          'span',
          { className: 'opacity-50 text-[0.9em]' },
          '.',
          parts[1]
        )
      ),
      align: 'right',
      title: raw
    };
  }
  return { text: raw, align: 'right', title: raw };
}

function formatDateOnly(raw: string): FormattedValue {
  // YYYYMMDD
  if (raw.length !== 8) return { text: raw, align: 'right' };
  const formatted = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  return { text: formatted, align: 'right', title: raw };
}

function formatNumeric(raw: string): FormattedValue {
  const num = parseFloat(raw);
  if (isNaN(num)) return { text: raw, align: 'right' };

  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 20,
  }).format(num);

  return { text: formatted, align: 'right', title: raw };
}

function formatBoolean(raw: string): FormattedValue {
  if (raw === 'Y') return { text: '✓', align: 'left', tone: 'emerald' };
  if (raw === 'N') return { text: '✗', align: 'left', tone: 'rose' };
  return { text: raw, align: 'left' };
}

function getTone(tag: number, raw: string): Tone | undefined {
  switch (tag) {
    case 35: // MsgType
      return getMsgTypeTone(raw);
    case 54: // Side
      if (raw === '1') return 'emerald'; // Buy
      if (['2', '5', '6'].includes(raw)) return 'rose'; // Sell variants
      return 'neutral';
    case 39: // OrdStatus — enum chip, no per-value coloring
    case 59: // TimeInForce — enum chip, no per-value coloring
    case 150: // ExecType — enum chip, no per-value coloring
      return undefined;
    case 40: // OrdType
      if (raw === '1') return 'amber'; // Market
      if (raw === '2') return 'sky'; // Limit
      if (['3', '4'].includes(raw)) return 'violet'; // Stop variants
      return undefined;
    default:
      return undefined;
  }
}

const MSG_TYPE_TONES: Record<string, Tone> = {
  // Session
  '0': 'slate',    // Heartbeat
  '1': 'sky',      // Test Request
  '2': 'amber',    // Resend Request
  '3': 'rose',     // Reject
  '4': 'violet',   // Sequence Reset
  '5': 'muted',    // Logout
  'A': 'emerald',  // Logon
  // Application — order flow
  'D': 'sky',      // New Order Single
  'E': 'teal',     // New Order List
  'F': 'amber',    // Order Cancel Request
  'G': 'violet',   // Order Cancel Replace
  'H': 'slate',    // Order Status Request
  '8': 'indigo',   // Execution Report
  '9': 'rose',     // Order Cancel Reject
  // Allocation
  'J': 'peach',    // Allocation
  'K': 'amber',    // List Cancel Request
  'L': 'teal',     // List Execute
  'M': 'slate',    // List Status Request
  'N': 'sky',      // List Status
  'P': 'emerald',  // Allocation ACK
  'Q': 'rose',     // Dont Know Trade
  // Quotes
  'R': 'violet',   // Quote Request
  'S': 'pink',     // Quote
  'Z': 'amber',    // Quote Cancel
  'a': 'sky',      // Quote Status Request
  'b': 'indigo',   // Quote Acknowledgement
  'i': 'pink',     // Mass Quote
  // Market data
  'V': 'teal',     // Market Data Request
  'W': 'emerald',  // Market Data Snapshot Full Refresh
  'X': 'sky',      // Market Data Incremental Refresh
  'Y': 'rose',     // Market Data Request Reject
  // Security / trading session
  'c': 'violet',   // Security Definition Request
  'd': 'teal',     // Security Definition
  'e': 'sky',      // Security Status Request
  'f': 'emerald',  // Security Status
  'g': 'slate',    // Trading Session Status Request
  'h': 'sky',      // Trading Session Status
  // Misc
  'B': 'peach',    // News
  'C': 'violet',   // Email
  'T': 'peach',    // Settlement Instructions
  'j': 'rose',     // Business Message Reject
  'k': 'amber',    // Bid Request
  'l': 'teal',     // Bid Response
  'm': 'sky',      // List Strike Price
  // Trade capture
  'AE': 'peach',   // Trade Capture Report
  'AR': 'amber',   // Trade Capture Ack
  // Multileg / FIX 4.4+
  'AB': 'teal',    // New Order Multileg
  'AC': 'violet',  // Multileg Order Cancel Replace
  'AK': 'emerald', // Confirmation
  'AP': 'sky',     // Position Report
  'AS': 'indigo',  // Allocation Report
  'AU': 'emerald', // Confirmation Ack
};

function getMsgTypeTone(raw: string): Tone {
  return MSG_TYPE_TONES[raw] ?? 'neutral';
}

