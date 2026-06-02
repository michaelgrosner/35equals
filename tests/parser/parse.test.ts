import { describe, it, expect } from "vitest";
import { tokenize } from "../../src/parser/tokenize.js";
import { parseMessages } from "../../src/parser/parse.js";
import type { DictionaryData, FixVersion } from "../../src/parser/types.js";

// ---------------------------------------------------------------------------
// Minimal stub dictionary (covers tags used in tests)
// ---------------------------------------------------------------------------

const stubDict: DictionaryData = {
  fields: {
    8:  { name: "BeginString",   type: "STRING" },
    9:  { name: "BodyLength",    type: "LENGTH" },
    10: { name: "CheckSum",      type: "STRING" },
    34: { name: "MsgSeqNum",     type: "SEQNUM" },
    35: {
      name: "MsgType", type: "STRING",
      values: { D: "New Order Single", "8": "Execution Report", "0": "Heartbeat" },
    },
    49: { name: "SenderCompID",  type: "STRING" },
    52: { name: "SendingTime",   type: "UTCTIMESTAMP" },
    54: {
      name: "Side", type: "CHAR",
      values: { "1": "Buy", "2": "Sell" },
    },
    55: { name: "Symbol",        type: "STRING" },
    56: { name: "TargetCompID",  type: "STRING" },
    11: { name: "ClOrdID",       type: "STRING" },
    38: { name: "OrderQty",      type: "QTY" },
    40: {
      name: "OrdType", type: "CHAR",
      values: { "1": "Market", "2": "Limit" },
    },
    44: { name: "Price",         type: "PRICE" },
    1128: { name: "ApplVerID",   type: "STRING" },
  },
  msgTypes: {
    D: "New Order Single",
    "8": "Execution Report",
    "0": "Heartbeat",
  },
};

const getDict = (_v: FixVersion): DictionaryData => stubDict;

// ---------------------------------------------------------------------------
// Checksum helpers
// ---------------------------------------------------------------------------

function computeChecksum(body: string): string {
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    sum += body.charCodeAt(i);
  }
  const cs = (sum & 0xff).toString().padStart(3, "0");
  return cs;
}

function buildMessage(fields: string, delim = "|"): string {
  const body = fields + delim;
  const cs = computeChecksum(body);
  return body + `10=${cs}${delim}`;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("parseMessages", () => {
  // -------------------------------------------------------------------------
  // FIX 4.2 NewOrderSingle
  // -------------------------------------------------------------------------
  it("parses a FIX 4.2 NewOrderSingle (35=D) with pipe delimiter", () => {
    const inner = "8=FIX.4.2|9=100|35=D|49=SENDER|56=TARGET|11=ORD001|55=AAPL|54=1|38=100|40=2|44=150.00";
    const raw = buildMessage(inner, "|");
    const tokens = tokenize(raw);
    const msgs = parseMessages(tokens, getDict);

    expect(msgs).toHaveLength(1);
    const msg = msgs[0]!;
    expect(msg.version).toBe("FIX.4.2");
    expect(msg.msgType).toBe("New Order Single");
    expect(msg.byTag.get(35)).toBe("D");
    expect(msg.byTag.get(55)).toBe("AAPL");

    const sideField = msg.fields.find((f) => f.tag === 54);
    expect(sideField?.name).toBe("Side");
    expect(sideField?.enumLabel).toBe("Buy");

    const ordTypeField = msg.fields.find((f) => f.tag === 40);
    expect(ordTypeField?.enumLabel).toBe("Limit");
  });

  // -------------------------------------------------------------------------
  // FIX 4.4 ExecutionReport
  // -------------------------------------------------------------------------
  it("parses a FIX 4.4 ExecutionReport (35=8)", () => {
    const inner = "8=FIX.4.4|9=80|35=8|49=EXEC|56=CLIENT|55=MSFT|54=2";
    const raw = buildMessage(inner, "|");
    const tokens = tokenize(raw);
    const msgs = parseMessages(tokens, getDict);

    expect(msgs).toHaveLength(1);
    const msg = msgs[0]!;
    expect(msg.version).toBe("FIX.4.4");
    expect(msg.msgType).toBe("Execution Report");
    const sideField = msg.fields.find((f) => f.tag === 54);
    expect(sideField?.enumLabel).toBe("Sell");
  });

  // -------------------------------------------------------------------------
  // FIXT.1.1 with ApplVerID=9 → FIX.5.0SP2
  // -------------------------------------------------------------------------
  it("handles FIXT.1.1 with tag 1128=9 as FIX.5.0SP2", () => {
    const inner = "8=FIXT.1.1|9=50|1128=9|35=D|49=SENDER|56=TARGET";
    const raw = buildMessage(inner, "|");
    const tokens = tokenize(raw);
    const msgs = parseMessages(tokens, getDict);

    expect(msgs).toHaveLength(1);
    const msg = msgs[0]!;
    expect(msg.version).toBe("FIX.5.0SP2");
  });

  // -------------------------------------------------------------------------
  // Valid checksum passes (no BAD_CHECKSUM warning)
  // -------------------------------------------------------------------------
  it("valid checksum produces no BAD_CHECKSUM warning", () => {
    const inner = "8=FIX.4.2|9=30|35=0|49=A|56=B";
    const raw = buildMessage(inner, "|");
    const tokens = tokenize(raw);
    const msgs = parseMessages(tokens, getDict);

    const msg = msgs[0]!;
    const badCs = msg.warnings.filter((w) => w.type === "BAD_CHECKSUM");
    expect(badCs).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Bad checksum adds warning
  // -------------------------------------------------------------------------
  it("bad checksum adds BAD_CHECKSUM warning", () => {
    const raw = "8=FIX.4.2|9=30|35=0|49=A|56=B|10=999|";
    const tokens = tokenize(raw);
    const msgs = parseMessages(tokens, getDict);

    const msg = msgs[0]!;
    const badCs = msg.warnings.filter((w) => w.type === "BAD_CHECKSUM");
    expect(badCs.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // Missing tag 10 → no warning
  // -------------------------------------------------------------------------
  it("missing tag 10 produces no BAD_CHECKSUM warning", () => {
    const raw = "8=FIX.4.2|9=30|35=0|49=A|56=B|";
    const tokens = tokenize(raw);
    const msgs = parseMessages(tokens, getDict);

    const msg = msgs[0]!;
    const badCs = msg.warnings.filter((w) => w.type === "BAD_CHECKSUM");
    expect(badCs).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Unknown tag → UNKNOWN_TAG warning
  // -------------------------------------------------------------------------
  it("unknown tag produces UNKNOWN_TAG warning", () => {
    const raw = "8=FIX.4.2|9=30|35=0|9999=WEIRDVALUE|";
    const tokens = tokenize(raw);
    const msgs = parseMessages(tokens, getDict);

    const msg = msgs[0]!;
    const unknownTags = msg.warnings.filter((w) => w.type === "UNKNOWN_TAG");
    expect(unknownTags.length).toBeGreaterThan(0);
    expect(unknownTags[0]?.detail).toContain("9999");
  });

  // -------------------------------------------------------------------------
  // lineNumber is propagated from tokenizer to ParsedMessage
  // -------------------------------------------------------------------------
  it("preserves lineNumber from tokenizer (one message per line)", () => {
    const raw =
      "8=FIX.4.2|35=0|\n" +
      "8=FIX.4.2|35=D|\n" +
      "8=FIX.4.2|35=8|";
    const tokens = tokenize(raw);
    const msgs = parseMessages(tokens, getDict);

    expect(msgs).toHaveLength(3);
    expect(msgs[0]!.lineNumber).toBe(1);
    expect(msgs[1]!.lineNumber).toBe(2);
    expect(msgs[2]!.lineNumber).toBe(3);
  });

  it("preserves lineNumber when messages are on non-sequential lines (log prefixes)", () => {
    // Line 1 has no FIX message, lines 2 and 4 have messages, line 3 is blank.
    const raw =
      "not a fix message\n" +
      "8=FIX.4.2|35=0|\n" +
      "\n" +
      "8=FIX.4.2|35=D|";
    const tokens = tokenize(raw);
    const msgs = parseMessages(tokens, getDict);

    expect(msgs).toHaveLength(2);
    expect(msgs[0]!.lineNumber).toBe(2);
    expect(msgs[1]!.lineNumber).toBe(4);
  });

  // -------------------------------------------------------------------------
  // index is set correctly for multiple messages
  // -------------------------------------------------------------------------
  it("assigns correct index to each message", () => {
    const make = (type: string) => `8=FIX.4.2|35=${type}|`;
    const raw = make("0") + make("D") + make("8");
    const tokens = tokenize(raw);
    const msgs = parseMessages(tokens, getDict);

    expect(msgs).toHaveLength(3);
    expect(msgs[0]!.index).toBe(0);
    expect(msgs[1]!.index).toBe(1);
    expect(msgs[2]!.index).toBe(2);
  });
});
