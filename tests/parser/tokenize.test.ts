import { describe, it, expect } from "vitest";
import { tokenize } from "../../src/parser/tokenize.js";

describe("tokenize", () => {
  // -------------------------------------------------------------------------
  // Empty input
  // -------------------------------------------------------------------------
  it("returns [] for empty string", () => {
    expect(tokenize("")).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // SOH-delimited single message
  // -------------------------------------------------------------------------
  it("parses a SOH-delimited single message", () => {
    const SOH = "\x01";
    const raw = `8=FIX.4.2${SOH}9=65${SOH}35=D${SOH}49=SENDER${SOH}56=TARGET${SOH}10=123${SOH}`;
    const result = tokenize(raw);
    expect(result).toHaveLength(1);
    const msg = result[0]!;
    expect(msg.pairs).toEqual([
      [8, "FIX.4.2"],
      [9, "65"],
      [35, "D"],
      [49, "SENDER"],
      [56, "TARGET"],
      [10, "123"],
    ]);
  });

  // -------------------------------------------------------------------------
  // Pipe-delimited single message
  // -------------------------------------------------------------------------
  it("parses a pipe-delimited single message", () => {
    const raw = "8=FIX.4.4|9=50|35=8|49=EXEC|56=CLIENT|10=099|";
    const result = tokenize(raw);
    expect(result).toHaveLength(1);
    const msg = result[0]!;
    expect(msg.pairs[0]).toEqual([8, "FIX.4.4"]);
    expect(msg.pairs[2]).toEqual([35, "8"]);
    expect(msg.pairs[5]).toEqual([10, "099"]);
  });

  // -------------------------------------------------------------------------
  // ^A literal two-char delimiter
  // -------------------------------------------------------------------------
  it("parses a ^A-delimited single message", () => {
    const raw = "8=FIX.4.2^A9=30^A35=0^A10=100^A";
    const result = tokenize(raw);
    expect(result).toHaveLength(1);
    const msg = result[0]!;
    expect(msg.pairs[0]).toEqual([8, "FIX.4.2"]);
    expect(msg.pairs[2]).toEqual([35, "0"]);
    expect(msg.pairs[3]).toEqual([10, "100"]);
  });

  // -------------------------------------------------------------------------
  // Space-delimited single message
  // -------------------------------------------------------------------------
  it("parses a space-delimited single message", () => {
    const raw = "8=FIX.4.2 9=263 35=8 34=547 10=089";
    const result = tokenize(raw);
    expect(result).toHaveLength(1);
    const msg = result[0]!;
    expect(msg.pairs[0]).toEqual([8, "FIX.4.2"]);
    expect(msg.pairs[1]).toEqual([9, "263"]);
    expect(msg.pairs[2]).toEqual([35, "8"]);
    expect(msg.pairs[3]).toEqual([34, "547"]);
    expect(msg.pairs[4]).toEqual([10, "089"]);
  });

  // -------------------------------------------------------------------------
  // Multi-message input (3 messages, pipe-delimited)
  // -------------------------------------------------------------------------
  it("splits three pipe-delimited messages", () => {
    const make = (type: string, seq: number) =>
      `8=FIX.4.2|9=40|35=${type}|34=${seq}|10=000|`;
    const raw = make("0", 1) + make("1", 2) + make("0", 3);
    const result = tokenize(raw);
    expect(result).toHaveLength(3);
    expect(result[0]!.pairs.find(([t]) => t === 35)?.[1]).toBe("0");
    expect(result[1]!.pairs.find(([t]) => t === 35)?.[1]).toBe("1");
    expect(result[2]!.pairs.find(([t]) => t === 34)?.[1]).toBe("3");
  });

  // -------------------------------------------------------------------------
  // Two SOH-delimited messages without trailing SOH on last field
  // -------------------------------------------------------------------------
  it("parses two SOH-delimited messages, last has no trailing delimiter", () => {
    const SOH = "\x01";
    const raw =
      `8=FIX.4.2${SOH}35=0${SOH}10=001${SOH}` +
      `8=FIX.4.2${SOH}35=1${SOH}10=002`;
    const result = tokenize(raw);
    expect(result).toHaveLength(2);
    expect(result[1]!.pairs.find(([t]) => t === 10)?.[1]).toBe("002");
  });

  // -------------------------------------------------------------------------
  // rawText round-trip
  // -------------------------------------------------------------------------
  it("rawText of each message contains only that message's content", () => {
    const raw = "8=FIX.4.2|35=D|10=001|8=FIX.4.4|35=8|10=002|";
    const result = tokenize(raw);
    expect(result).toHaveLength(2);
    expect(result[0]!.rawText).not.toContain("FIX.4.4");
    expect(result[1]!.rawText).not.toContain("FIX.4.2");
  });

  // -------------------------------------------------------------------------
  // Log prefix stripping
  // -------------------------------------------------------------------------
  it("strips log-line prefixes before 8=FIX and still parses all fields", () => {
    const line1 = "2024-01-15 09:30:00.123 INFO [main] 8=FIX.4.2|9=40|35=D|34=1|10=000|";
    const line2 = "2024-01-15 09:30:00.456 INFO [main] 8=FIX.4.2|9=40|35=8|34=2|10=001|";
    const result = tokenize(line1 + "\n" + line2);
    expect(result).toHaveLength(2);
    // Tag 8 must be present in each message (not lost to prefix skip)
    expect(result[0]!.pairs.find(([t]) => t === 8)?.[1]).toBe("FIX.4.2");
    expect(result[1]!.pairs.find(([t]) => t === 8)?.[1]).toBe("FIX.4.2");
    // rawText must not include log prefix
    expect(result[0]!.rawText).not.toContain("INFO");
    expect(result[1]!.rawText).not.toContain("INFO");
    // Line numbers are tracked
    expect(result[0]!.lineNumber).toBe(1);
    expect(result[1]!.lineNumber).toBe(2);
  });

  it("parses a clean (no prefix) log at the correct line number", () => {
    const raw = "8=FIX.4.2|35=0|10=001|\n8=FIX.4.2|35=1|10=002|\n8=FIX.4.2|35=0|10=003|";
    const result = tokenize(raw);
    expect(result).toHaveLength(3);
    expect(result[0]!.lineNumber).toBe(1);
    expect(result[1]!.lineNumber).toBe(2);
    expect(result[2]!.lineNumber).toBe(3);
  });
});
