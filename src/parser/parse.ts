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

function computeChecksum(rawText: string, tag10Value: string): number {
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
// Main parse function (synchronous)
// ---------------------------------------------------------------------------

const EMPTY_DICT: DictionaryData = { fields: {}, msgTypes: {} };

/**
 * Parse an array of tokenized messages into fully resolved ParsedMessage[].
 *
 * @param tokens   Output of tokenize()
 * @param getDict  Synchronous dict lookup by version. Omit for no enrichment.
 */
export function parseMessages(
  tokens: TokenizedMessage[],
  getDict?: (version: import("./types.js").FixVersion) => DictionaryData
): ParsedMessage[] {
  const resolvedGetDict =
    getDict ?? ((): DictionaryData => EMPTY_DICT);
  const results: ParsedMessage[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok === undefined) continue;
    results.push(parseSingle(tok, i, resolvedGetDict));
  }

  return results;
}

function parseSingle(
  tok: TokenizedMessage,
  index: number,
  getDict: (version: import("./types.js").FixVersion) => DictionaryData
): ParsedMessage {
  const warnings: Warning[] = [];

  const byTag = new Map<number, string>();
  for (const [tag, value] of tok.pairs) {
    if (!byTag.has(tag)) {
      byTag.set(tag, value);
    }
  }

  const version = detectVersion(byTag);
  if (version === "UNKNOWN") {
    warnings.push({
      type: "UNKNOWN_VERSION",
      detail: `BeginString (tag 8) value '${byTag.get(8) ?? ""}' is not a recognised FIX version`,
    });
  }

  const dict = getDict(version === "UNKNOWN" ? "FIX.4.2" : version);

  const rawMsgType = byTag.get(35);
  const msgTypeName =
    rawMsgType !== undefined ? dict.msgTypes[rawMsgType] : undefined;

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
