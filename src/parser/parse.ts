import type {
  DictionaryData,
  ParsedField,
  ParsedMessage,
  Warning,
} from "./types.js";
import type { TokenizedMessage } from "./tokenize.js";
import { detectVersion } from "./detect.js";
import { lookupField } from "./dictionary.js";

// ---------------------------------------------------------------------------
// Checksum validation
// ---------------------------------------------------------------------------

/**
 * Compute the FIX checksum over `rawText` up to (but not including) the
 * "10=<checksum>" field+delimiter suffix.
 *
 * FIX checksum = sum of all byte values (mod 256) for every character in the
 * message body, using the delimiter that was actually present in rawText.
 * The "10=XXX<delim>" field itself is excluded.
 */
function computeChecksum(rawText: string, tag10Value: string): number {
  // Find the start of the "10=" segment by searching backwards from end.
  // We need to exclude the trailing "10=<val><delim>" from the sum.
  // The segment to exclude is: "10=" + tag10Value + (optional trailing delim)
  const suffix = `10=${tag10Value}`;
  const suffixIdx = rawText.lastIndexOf(suffix);
  const textToSum =
    suffixIdx === -1 ? rawText : rawText.slice(0, suffixIdx);

  let sum = 0;
  const len = textToSum.length;
  for (let i = 0; i < len; i++) {
    sum += textToSum.charCodeAt(i);
  }
  return sum & 0xff;
}

// ---------------------------------------------------------------------------
// Main parse function
// ---------------------------------------------------------------------------

/**
 * Parse an array of tokenized messages into fully resolved ParsedMessage[].
 *
 * @param tokens   Output of tokenize()
 * @param getDict  Async function that returns DictionaryData for a version.
 *                 Passing it as a parameter keeps this module testable without
 *                 real JSON blobs.
 */
export async function parseMessages(
  tokens: TokenizedMessage[],
  getDict: (version: import("./types.js").FixVersion) => Promise<DictionaryData>
): Promise<ParsedMessage[]> {
  const results: ParsedMessage[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok === undefined) continue;
    results.push(await parseSingle(tok, i, getDict));
  }

  return results;
}

async function parseSingle(
  tok: TokenizedMessage,
  index: number,
  getDict: (version: import("./types.js").FixVersion) => Promise<DictionaryData>
): Promise<ParsedMessage> {
  const warnings: Warning[] = [];

  // Build byTag map first (needed for version detection)
  const byTag = new Map<number, string>();
  for (const [tag, value] of tok.pairs) {
    // Keep first occurrence (standard FIX behaviour for duplicates)
    if (!byTag.has(tag)) {
      byTag.set(tag, value);
    }
  }

  // Detect version
  const version = detectVersion(byTag);
  if (version === "UNKNOWN") {
    warnings.push({
      type: "UNKNOWN_VERSION",
      detail: `BeginString (tag 8) value '${byTag.get(8) ?? ""}' is not a recognised FIX version`,
    });
  }

  // Load dictionary (falls back gracefully for unknown versions)
  const dict = await getDict(version === "UNKNOWN" ? "FIX.4.2" : version);

  // Resolve msgType name
  const rawMsgType = byTag.get(35);
  const msgTypeName =
    rawMsgType !== undefined ? dict.msgTypes[rawMsgType] : undefined;

  // Validate checksum
  const tag10Raw = byTag.get(10);
  if (tag10Raw !== undefined) {
    const expected = computeChecksum(tok.rawText, tag10Raw);
    const declared = parseInt(tag10Raw, 10);
    if (!isNaN(declared) && declared !== expected) {
      warnings.push({
        type: "BAD_CHECKSUM",
        detail: `Checksum mismatch: declared ${String(declared)}, computed ${String(expected)}`,
      });
    }
  }

  // Build enriched fields array
  const fields: ParsedField[] = [];
  for (const [tag, rawValue] of tok.pairs) {
    const def = lookupField(dict, tag);
    if (def === undefined) {
      warnings.push({
        type: "UNKNOWN_TAG",
        detail: `Tag ${String(tag)} not found in dictionary`,
      });
      fields.push({ tag, rawValue });
      continue;
    }

    const enumLabel =
      def.values !== undefined ? def.values[rawValue] : undefined;

    const field: ParsedField = {
      tag,
      rawValue,
      name: def.name,
      type: def.type,
    };
    if (enumLabel !== undefined) {
      field.enumLabel = enumLabel;
    }
    fields.push(field);
  }

  return {
    index,
    rawText: tok.rawText,
    fields,
    byTag,
    version,
    ...(msgTypeName !== undefined ? { msgType: msgTypeName } : {}),
    warnings,
  };
}
