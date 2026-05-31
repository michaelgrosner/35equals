/**
 * Deterministic 100k-message FIX log fixture generator.
 * Run: tsx tests/fixtures/generate.ts
 * Output: tests/fixtures/100k-messages.log (pipe-delimited)
 */

import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Deterministic pseudo-random (LCG — no external deps, fully reproducible)
// ---------------------------------------------------------------------------

class LCG {
  private state: number;
  constructor(seed: number) {
    this.state = seed >>> 0;
  }
  next(): number {
    // Knuth multiplicative LCG
    this.state = Math.imul(1664525, this.state) + 1013904223;
    this.state = this.state >>> 0;
    return this.state / 0x100000000;
  }
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)] as T;
  }
}

const rng = new LCG(0xdeadbeef);

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

const SYMBOLS = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META", "JPM", "BAC", "GS"] as const;
const SENDERS = ["CLIENT1", "CLIENT2", "CLIENT3"] as const;
const BROKERS = ["BROKER1", "BROKER2"] as const;
const SIDES = ["1", "2"] as const;   // Buy, Sell
const ORD_TYPES = ["1", "2"] as const; // Market, Limit
const TIF = ["0", "1", "3"] as const;  // Day, GTC, IOC

// Message types with weighted distribution (realistic traffic mix)
const MSG_TYPE_WEIGHTS: Array<[string, number]> = [
  ["D", 30],  // NewOrderSingle — most common
  ["8", 40],  // ExecutionReport — fills/acks per order
  ["F", 10],  // OrderCancelRequest
  ["G", 8],   // OrderCancelReplaceRequest
  ["9", 5],   // OrderCancelReject
  ["0", 7],   // Heartbeat
];

// Build cumulative weights for O(1) selection
const TOTAL_WEIGHT = MSG_TYPE_WEIGHTS.reduce((s, [, w]) => s + w, 0);
const CUM_WEIGHTS: Array<[string, number]> = [];
let cumsum = 0;
for (const [type, weight] of MSG_TYPE_WEIGHTS) {
  cumsum += weight;
  CUM_WEIGHTS.push([type, cumsum]);
}

function pickMsgType(): string {
  const r = rng.next() * TOTAL_WEIGHT;
  for (const [type, cum] of CUM_WEIGHTS) {
    if (r < cum) return type;
  }
  return "0";
}

// ---------------------------------------------------------------------------
// Timestamp generation (sequential within trading day)
// ---------------------------------------------------------------------------

function makeTimestamp(baseMs: number, offsetMs: number): string {
  const d = new Date(baseMs + offsetMs);
  const yy = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  const ms = String(d.getUTCMilliseconds()).padStart(3, "0");
  return `${yy}${mo}${dd}-${hh}:${mm}:${ss}.${ms}`;
}

// ---------------------------------------------------------------------------
// Checksum computation
// ---------------------------------------------------------------------------

function computeChecksum(body: string): string {
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    sum += body.charCodeAt(i);
  }
  return String(sum & 0xff).padStart(3, "0");
}

// ---------------------------------------------------------------------------
// Message builders
// ---------------------------------------------------------------------------

function buildFields(fields: Array<[number, string | number]>): string {
  return fields.map(([tag, val]) => `${tag}=${val}`).join("|") + "|";
}

function finalizeMessage(body: string): string {
  const cs = computeChecksum(body);
  return body + `10=${cs}|`;
}

type MsgBuilder = (seq: number, sender: string, target: string, ts: string) => string;

const builders: Record<string, MsgBuilder> = {
  D(seq, sender, target, ts) {
    const clOrdId = `ORD${String(seq).padStart(8, "0")}`;
    const sym = rng.pick(SYMBOLS);
    const side = rng.pick(SIDES);
    const qty = rng.int(100, 10000);
    const price = (rng.int(1000, 50000) / 100).toFixed(2);
    const ordType = rng.pick(ORD_TYPES);
    const tif = rng.pick(TIF);
    const body = buildFields([
      [8, "FIX.4.2"], [9, 150], [35, "D"],
      [49, sender], [56, target], [34, seq],
      [52, ts], [11, clOrdId], [55, sym],
      [54, side], [38, qty], [44, price],
      [40, ordType], [59, tif],
    ]);
    return finalizeMessage(body);
  },

  "8"(seq, sender, target, ts) {
    const clOrdId = `ORD${String(rng.int(1, seq)).padStart(8, "0")}`;
    const execId = `EXEC${String(seq).padStart(8, "0")}`;
    const sym = rng.pick(SYMBOLS);
    const side = rng.pick(SIDES);
    const qty = rng.int(100, 10000);
    const price = (rng.int(1000, 50000) / 100).toFixed(2);
    const ordStatus = rng.pick(["0", "1", "2", "4"] as const); // New/PartFill/Fill/Cancel
    const execType = ordStatus;
    const leavesQty = ordStatus === "2" ? 0 : rng.int(0, qty);
    const cumQty = qty - leavesQty;
    const body = buildFields([
      [8, "FIX.4.2"], [9, 200], [35, "8"],
      [49, sender], [56, target], [34, seq],
      [52, ts], [11, clOrdId],
      [37, `ORD${String(rng.int(1, seq)).padStart(8, "0")}`],
      [17, execId], [55, sym], [54, side],
      [38, qty], [44, price],
      [14, cumQty], [151, leavesQty],
      [39, ordStatus], [150, execType], [6, 0],
    ]);
    return finalizeMessage(body);
  },

  F(seq, sender, target, ts) {
    const origClOrdId = `ORD${String(rng.int(1, Math.max(1, seq - 1))).padStart(8, "0")}`;
    const clOrdId = `CXLORD${String(seq).padStart(6, "0")}`;
    const body = buildFields([
      [8, "FIX.4.2"], [9, 120], [35, "F"],
      [49, sender], [56, target], [34, seq],
      [52, ts], [41, origClOrdId], [11, clOrdId],
      [55, rng.pick(SYMBOLS)], [54, rng.pick(SIDES)],
    ]);
    return finalizeMessage(body);
  },

  G(seq, sender, target, ts) {
    const origClOrdId = `ORD${String(rng.int(1, Math.max(1, seq - 1))).padStart(8, "0")}`;
    const clOrdId = `REPLORD${String(seq).padStart(5, "0")}`;
    const sym = rng.pick(SYMBOLS);
    const newQty = rng.int(100, 10000);
    const newPrice = (rng.int(1000, 50000) / 100).toFixed(2);
    const body = buildFields([
      [8, "FIX.4.2"], [9, 160], [35, "G"],
      [49, sender], [56, target], [34, seq],
      [52, ts], [41, origClOrdId], [11, clOrdId],
      [55, sym], [54, rng.pick(SIDES)],
      [38, newQty], [44, newPrice], [40, "2"],
    ]);
    return finalizeMessage(body);
  },

  "9"(seq, sender, target, ts) {
    const origClOrdId = `ORD${String(rng.int(1, Math.max(1, seq - 1))).padStart(8, "0")}`;
    const clOrdId = `CXLORD${String(seq).padStart(6, "0")}`;
    const body = buildFields([
      [8, "FIX.4.2"], [9, 110], [35, "9"],
      [49, sender], [56, target], [34, seq],
      [52, ts], [41, origClOrdId], [11, clOrdId],
      [39, "4"], [102, rng.pick(["1", "2", "6"])],
    ]);
    return finalizeMessage(body);
  },

  "0"(seq, sender, target, ts) {
    const body = buildFields([
      [8, "FIX.4.2"], [9, 60], [35, "0"],
      [49, sender], [56, target], [34, seq], [52, ts],
    ]);
    return finalizeMessage(body);
  },
};

// ---------------------------------------------------------------------------
// Main generation loop
// ---------------------------------------------------------------------------

const TARGET_MESSAGES = 100_000;
const BASE_DATE_MS = new Date("2024-01-15T09:30:00.000Z").getTime();
// Spread 100k messages over 6.5 hours (trading day) in milliseconds
const TRADING_DAY_MS = 6.5 * 60 * 60 * 1000;
const MS_PER_MSG = TRADING_DAY_MS / TARGET_MESSAGES;

const chunks: string[] = [];
let totalBytes = 0;

for (let i = 0; i < TARGET_MESSAGES; i++) {
  const seq = i + 1;
  const sender = rng.pick(SENDERS);
  const target = rng.pick(BROKERS);
  const ts = makeTimestamp(BASE_DATE_MS, Math.floor(i * MS_PER_MSG));
  const msgType = pickMsgType();
  const builder = builders[msgType];
  if (builder === undefined) continue;
  const msg = builder(seq, sender, target, ts);
  chunks.push(msg + "\n");
  totalBytes += msg.length + 1;
}

const outPath = join(__dirname, "100k-messages.log");
writeFileSync(outPath, chunks.join(""), "utf8");

const mb = (totalBytes / 1024 / 1024).toFixed(2);
console.log(`Generated ${TARGET_MESSAGES.toLocaleString()} messages → ${outPath} (${mb} MB)`);
