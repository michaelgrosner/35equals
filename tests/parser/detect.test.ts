import { describe, it, expect } from "vitest";
import { detectVersion } from "../../src/parser/detect.js";

function map(tag8: string, tag1128?: string): Map<number, string> {
  const m = new Map<number, string>();
  m.set(8, tag8);
  if (tag1128 !== undefined) m.set(1128, tag1128);
  return m;
}

describe("detectVersion", () => {
  it("FIX.4.0 → FIX.4.0", () => {
    expect(detectVersion(map("FIX.4.0"))).toBe("FIX.4.0");
  });

  it("FIX.4.1 → FIX.4.1", () => {
    expect(detectVersion(map("FIX.4.1"))).toBe("FIX.4.1");
  });

  it("FIX.4.2 → FIX.4.2", () => {
    expect(detectVersion(map("FIX.4.2"))).toBe("FIX.4.2");
  });

  it("FIX.4.3 → FIX.4.3", () => {
    expect(detectVersion(map("FIX.4.3"))).toBe("FIX.4.3");
  });

  it("FIX.4.4 → FIX.4.4", () => {
    expect(detectVersion(map("FIX.4.4"))).toBe("FIX.4.4");
  });

  it("FIX.5.0 → FIX.5.0", () => {
    expect(detectVersion(map("FIX.5.0"))).toBe("FIX.5.0");
  });

  it("FIX.5.0SP1 → FIX.5.0SP1", () => {
    expect(detectVersion(map("FIX.5.0SP1"))).toBe("FIX.5.0SP1");
  });

  it("FIX.5.0SP2 → FIX.5.0SP2", () => {
    expect(detectVersion(map("FIX.5.0SP2"))).toBe("FIX.5.0SP2");
  });

  it("FIXT.1.1 + ApplVerID 9 → FIX.5.0SP2", () => {
    expect(detectVersion(map("FIXT.1.1", "9"))).toBe("FIX.5.0SP2");
  });

  it("FIXT.1.1 + ApplVerID 8 → FIX.4.4", () => {
    expect(detectVersion(map("FIXT.1.1", "8"))).toBe("FIX.4.4");
  });

  it("FIXT.1.1 + ApplVerID 6 → FIX.4.2", () => {
    expect(detectVersion(map("FIXT.1.1", "6"))).toBe("FIX.4.2");
  });

  it("FIXT.1.1 + no ApplVerID → FIX.5.0SP2 (default)", () => {
    expect(detectVersion(map("FIXT.1.1"))).toBe("FIX.5.0SP2");
  });

  it("FIXT.1.1 + unknown ApplVerID → FIX.5.0SP2 (default)", () => {
    expect(detectVersion(map("FIXT.1.1", "99"))).toBe("FIX.5.0SP2");
  });

  it("unknown BeginString → UNKNOWN", () => {
    expect(detectVersion(map("FIX.3.0"))).toBe("UNKNOWN");
  });

  it("missing tag 8 → UNKNOWN", () => {
    expect(detectVersion(new Map())).toBe("UNKNOWN");
  });
});
