import type {
  DictionaryData,
  FieldDef,
  FixVersion,
  ParsedField,
  ParsedMessage,
  Warning,
} from "./types.js";
import type { TokenizedMessage } from "./tokenize.js";

// ---------------------------------------------------------------------------
// Inlined version detection
// ---------------------------------------------------------------------------

const APPL_VER_MAP: Record<string, FixVersion> = {
  "1": "FIX.4.0", "4": "FIX.4.0", "5": "FIX.4.1", "6": "FIX.4.2",
  "7": "FIX.4.3", "8": "FIX.4.4", "9": "FIX.5.0SP2",
};

function resolveVersion(
  beginString: string | undefined,
  applVerID: string | undefined,
): FixVersion {
  if (beginString === undefined) return "UNKNOWN";
  switch (beginString) {
    case "FIX.4.0": return "FIX.4.0";
    case "FIX.4.1": return "FIX.4.1";
    case "FIX.4.2": return "FIX.4.2";
    case "FIX.4.3": return "FIX.4.3";
    case "FIX.4.4": return "FIX.4.4";
    case "FIX.5.0": return "FIX.5.0";
    case "FIX.5.0SP1": return "FIX.5.0SP1";
    case "FIX.5.0SP2": return "FIX.5.0SP2";
    case "FIXT.1.1": {
      if (applVerID !== undefined) {
        const m = APPL_VER_MAP[applVerID];
        if (m !== undefined) return m;
      }
      return "FIX.5.0SP2";
    }
    default: return "UNKNOWN";
  }
}

// ---------------------------------------------------------------------------
// Checksum
// ---------------------------------------------------------------------------

/**
 * Compute the expected checksum: sum of charCodes of all bytes before the
 * final `10=` tag, mod 256. Scans backwards for `10=` rather than building
 * a temporary needle string with lastIndexOf.
 */
function computeChecksum(rawText: string): number {
  let cutoff = rawText.length;
  for (let i = rawText.length - 1; i >= 2; i--) {
    if (
      rawText.charCodeAt(i) === 0x3d &&     // '='
      rawText.charCodeAt(i - 1) === 0x30 && // '0'
      rawText.charCodeAt(i - 2) === 0x31    // '1'
    ) {
      cutoff = i - 2;
      break;
    }
  }
  let sum = 0;
  for (let i = 0; i < cutoff; i++) sum += rawText.charCodeAt(i);
  return sum & 0xff;
}

// ---------------------------------------------------------------------------
// Main parse
// ---------------------------------------------------------------------------

/**
 * Parse an array of tokenized messages into fully resolved ParsedMessage[].
 *
 * When `getDict` is omitted, fields are returned with only `tag` + `rawValue`
 * and no per-tag enrichment work is done — useful for hot paths that don't
 * need names or enum labels.
 */
export function parseMessages(
  tokens: TokenizedMessage[],
  getDict?: (version: FixVersion) => DictionaryData,
): ParsedMessage[] {
  const n = tokens.length;
  const results: ParsedMessage[] = new Array(n);
  let outIdx = 0;
  for (let i = 0; i < n; i++) {
    const tok = tokens[i];
    if (tok === undefined) continue;
    results[outIdx++] = parseSingle(tok, i, getDict);
  }
  if (outIdx !== n) results.length = outIdx;
  return results;
}

function parseSingle(
  tok: TokenizedMessage,
  index: number,
  getDict: ((v: FixVersion) => DictionaryData) | undefined,
): ParsedMessage {
  const pairs = tok.pairs;
  const pn = pairs.length;
  const byTag = new Map<number, string>();

  // Single pass: populate byTag (first-wins) and capture key tags inline.
  let beginString: string | undefined;
  let applVerID: string | undefined;
  let rawMsgType: string | undefined;
  let tag10Raw: string | undefined;
  for (let i = 0; i < pn; i++) {
    const p = pairs[i];
    if (p === undefined) continue;
    const tag = p[0];
    if (byTag.has(tag)) continue;
    const val = p[1];
    byTag.set(tag, val);
    if (tag === 8) beginString = val;
    else if (tag === 35) rawMsgType = val;
    else if (tag === 10) tag10Raw = val;
    else if (tag === 1128) applVerID = val;
  }

  const version = resolveVersion(beginString, applVerID);
  let warnings: Warning[] | null = null;

  if (version === "UNKNOWN") {
    warnings = [{
      type: "UNKNOWN_VERSION",
      detail: `BeginString (tag 8) value '${beginString ?? ""}' is not a recognised FIX version`,
    }];
  }

  if (tag10Raw !== undefined) {
    const expected = computeChecksum(tok.rawText);
    const declared = parseInt(tag10Raw, 10);
    if (!isNaN(declared) && declared !== expected) {
      const w: Warning = {
        type: "BAD_CHECKSUM",
        detail: `Checksum mismatch: declared ${String(declared)}, computed ${String(expected)}`,
      };
      if (warnings === null) warnings = [w];
      else warnings.push(w);
    }
  }

  // Field enrichment. Fast path when no dict provided.
  const fields: ParsedField[] = new Array(pn);
  let msgTypeName: string | undefined;

  if (getDict === undefined) {
    for (let i = 0; i < pn; i++) {
      const p = pairs[i];
      if (p === undefined) continue;
      fields[i] = { tag: p[0], rawValue: p[1] };
    }
  } else {
    const dict = getDict(version === "UNKNOWN" ? "FIX.4.2" : version);
    const dictFields = dict.fields;
    if (rawMsgType !== undefined) msgTypeName = dict.msgTypes[rawMsgType];

    for (let i = 0; i < pn; i++) {
      const p = pairs[i];
      if (p === undefined) continue;
      const tag = p[0];
      const rawValue = p[1];
      const def: FieldDef | undefined = dictFields[tag];
      if (def === undefined) {
        if (warnings === null) warnings = [];
        warnings.push({
          type: "UNKNOWN_TAG",
          detail: `Tag ${String(tag)} not found in dictionary`,
        });
        fields[i] = { tag, rawValue };
        continue;
      }
      const values = def.values;
      const enumLabel = values !== undefined ? values[rawValue] : undefined;
      // Two object shapes for V8 to optimize: enriched, and enriched + enum.
      fields[i] = enumLabel !== undefined
        ? { tag, rawValue, name: def.name, type: def.type, enumLabel }
        : { tag, rawValue, name: def.name, type: def.type };
    }
  }

  const result: ParsedMessage = {
    index,
    rawText: tok.rawText,
    fields,
    byTag,
    version,
    warnings: warnings ?? [],
  };
  if (msgTypeName !== undefined) result.msgType = msgTypeName;
  return result;
}
