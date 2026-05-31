/**
 * Parser micro- and meso-benchmarks.
 *
 * Goals:
 *  - Each bench finishes in a few seconds so the suite is runnable.
 *  - Per-message-type micros expose which MsgTypes (D, 8, F, G, 9, 0) are
 *    fastest/slowest in isolation.
 *  - Small batches (200 / 1000) catch overhead amortization without
 *    dominating runtime.
 *  - One realistic bench uses a stub dictionary so we don't only measure
 *    the degenerate no-dictionary path that floods warnings.
 */

import { bench, describe } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tokenize } from "../../src/parser/tokenize.js";
import type { TokenizedMessage } from "../../src/parser/tokenize.js";
import { parseMessages } from "../../src/parser/parse.js";
import type { DictionaryData, FixVersion } from "../../src/parser/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(__dirname, "../fixtures/100k-messages.log");

if (!existsSync(fixturePath)) {
  describe("parser performance", () => {
    bench("(fixture missing — run pnpm gen:fixture)", () => {});
  });
} else {
  // -----------------------------------------------------------------------
  // Load + slice fixture (I/O excluded from measurement)
  // -----------------------------------------------------------------------
  const fullInput = readFileSync(fixturePath, "utf8");
  const allTokens = tokenize(fullInput);

  const MSG_TYPES = ["D", "8", "F", "G", "9", "0"] as const;
  type MsgType = (typeof MSG_TYPES)[number];

  function msgTypeOf(t: TokenizedMessage): string | undefined {
    for (const pair of t.pairs) {
      if (pair[0] === 35) return pair[1];
    }
    return undefined;
  }

  // One representative message per type — used for per-message micros.
  const single: Record<MsgType, TokenizedMessage> = Object.fromEntries(
    MSG_TYPES.map((mt) => [mt, allTokens.find((t) => msgTypeOf(t) === mt)!]),
  ) as Record<MsgType, TokenizedMessage>;

  // Round-robin a diverse batch of N messages, one of each type at a time.
  function diverseBatch(n: number): TokenizedMessage[] {
    const out: TokenizedMessage[] = [];
    const byType: Record<MsgType, TokenizedMessage[]> = {
      D: [], "8": [], F: [], G: [], "9": [], "0": [],
    };
    for (const t of allTokens) {
      const mt = msgTypeOf(t) as MsgType | undefined;
      if (mt !== undefined && byType[mt].length < n) byType[mt].push(t);
    }
    for (let i = 0; i < n; i++) {
      for (const mt of MSG_TYPES) {
        const arr = byType[mt];
        if (arr[i] !== undefined) out.push(arr[i]!);
        if (out.length >= n) return out;
      }
    }
    return out;
  }

  const batch200 = diverseBatch(200);
  const batch1000 = diverseBatch(1000);
  const batch200Text = batch200.map((t) => t.rawText).join("");
  const batch1000Text = batch1000.map((t) => t.rawText).join("");

  // Stub dictionary: covers the tags actually emitted by generate.ts, so
  // parse benches exercise the lookup-hit path (not the warning-spam path).
  const STUB_DICT: DictionaryData = {
    fields: {
      6: { name: "AvgPx", type: "PRICE" },
      8: { name: "BeginString", type: "STRING" },
      9: { name: "BodyLength", type: "LENGTH" },
      10: { name: "CheckSum", type: "STRING" },
      11: { name: "ClOrdID", type: "STRING" },
      14: { name: "CumQty", type: "QTY" },
      17: { name: "ExecID", type: "STRING" },
      34: { name: "MsgSeqNum", type: "SEQNUM" },
      35: {
        name: "MsgType", type: "STRING",
        values: { D: "NewOrderSingle", "8": "ExecutionReport", F: "OrderCancelRequest", G: "OrderCancelReplaceRequest", "9": "OrderCancelReject", "0": "Heartbeat" },
      },
      37: { name: "OrderID", type: "STRING" },
      38: { name: "OrderQty", type: "QTY" },
      39: { name: "OrdStatus", type: "CHAR", values: { "0": "New", "1": "PartiallyFilled", "2": "Filled", "4": "Canceled" } },
      40: { name: "OrdType", type: "CHAR", values: { "1": "Market", "2": "Limit" } },
      41: { name: "OrigClOrdID", type: "STRING" },
      44: { name: "Price", type: "PRICE" },
      49: { name: "SenderCompID", type: "STRING" },
      52: { name: "SendingTime", type: "UTCTIMESTAMP" },
      54: { name: "Side", type: "CHAR", values: { "1": "Buy", "2": "Sell" } },
      55: { name: "Symbol", type: "STRING" },
      56: { name: "TargetCompID", type: "STRING" },
      59: { name: "TimeInForce", type: "CHAR", values: { "0": "Day", "1": "GTC", "3": "IOC" } },
      102: { name: "CxlRejReason", type: "INT" },
      150: { name: "ExecType", type: "CHAR" },
      151: { name: "LeavesQty", type: "QTY" },
    },
    msgTypes: {
      D: "NewOrderSingle", "8": "ExecutionReport", F: "OrderCancelRequest",
      G: "OrderCancelReplaceRequest", "9": "OrderCancelReject", "0": "Heartbeat",
    },
  };
  const getDict = (_v: FixVersion): DictionaryData => STUB_DICT;

  // -----------------------------------------------------------------------
  // Per-message-type tokenize micros
  // -----------------------------------------------------------------------
  describe("tokenize 1 message (per type)", () => {
    for (const mt of MSG_TYPES) {
      const raw = single[mt].rawText;
      bench(`tokenize 35=${mt}`, () => {
        tokenize(raw);
      });
    }
  });

  // -----------------------------------------------------------------------
  // Per-message-type parse micros (with stub dict — realistic path)
  // -----------------------------------------------------------------------
  describe("parse 1 message (per type, dict)", () => {
    for (const mt of MSG_TYPES) {
      const tok = [single[mt]];
      bench(`parse 35=${mt}`, () => {
        parseMessages(tok, getDict);
      });
    }
  });

  // -----------------------------------------------------------------------
  // Diverse small-batch end-to-end
  // -----------------------------------------------------------------------
  describe("diverse batch — 200 messages", () => {
    bench("tokenize", () => {
      tokenize(batch200Text);
    });
    bench("parse (dict)", () => {
      parseMessages(batch200, getDict);
    });
    bench("parse (no dict)", () => {
      parseMessages(batch200, undefined);
    });
    bench("tokenize + parse (dict)", () => {
      parseMessages(tokenize(batch200Text), getDict);
    });
  });

  // -----------------------------------------------------------------------
  // Larger batch — only one each, to keep wall-clock bounded
  // -----------------------------------------------------------------------
  describe("diverse batch — 1000 messages", () => {
    bench("tokenize", () => {
      tokenize(batch1000Text);
    });
    bench("parse (dict)", () => {
      parseMessages(batch1000, getDict);
    });
  });
}
