/**
 * Single-pass FIX message tokenizer.
 *
 * Delimiter detection: sniff first 512 chars for \x01 (SOH), then '|', then
 * the two-char literal sequence '^A'. All hot-path scanning is done with
 * manual index arithmetic — no regex.
 */

export interface TokenizedMessage {
  rawText: string;
  pairs: [tag: number, value: string][];
}

// ---------------------------------------------------------------------------
// Delimiter detection
// ---------------------------------------------------------------------------

type Delimiter = "SOH" | "PIPE" | "CARET_A";

function detectDelimiter(input: string): Delimiter {
  const sniff = input.length > 512 ? input.slice(0, 512) : input;
  const len = sniff.length;
  for (let i = 0; i < len; i++) {
    const ch = sniff.charCodeAt(i);
    if (ch === 0x01) return "SOH";
  }
  for (let i = 0; i < len; i++) {
    if (sniff.charCodeAt(i) === 0x7c) return "PIPE"; // '|'
  }
  for (let i = 0; i < len - 1; i++) {
    if (sniff.charCodeAt(i) === 0x5e && sniff.charCodeAt(i + 1) === 0x41) {
      return "CARET_A"; // '^A'
    }
  }
  // default
  return "SOH";
}

// ---------------------------------------------------------------------------
// Low-level helpers: find next delimiter position
// ---------------------------------------------------------------------------

/** Returns index of next delimiter starting at `from`, or -1 if not found. */
function nextDelim(input: string, from: number, delim: Delimiter): number {
  const len = input.length;
  if (delim === "SOH") {
    for (let i = from; i < len; i++) {
      if (input.charCodeAt(i) === 0x01) return i;
    }
    return -1;
  }
  if (delim === "PIPE") {
    for (let i = from; i < len; i++) {
      if (input.charCodeAt(i) === 0x7c) return i;
    }
    return -1;
  }
  // CARET_A — two-char sequence
  for (let i = from; i < len - 1; i++) {
    if (input.charCodeAt(i) === 0x5e && input.charCodeAt(i + 1) === 0x41) {
      return i;
    }
  }
  return -1;
}

/** Width of the delimiter in characters (1 for SOH/PIPE, 2 for ^A). */
function delimWidth(delim: Delimiter): number {
  return delim === "CARET_A" ? 2 : 1;
}

// ---------------------------------------------------------------------------
// Parse a single "tag=value" segment into [tag, value], or null if malformed.
// ---------------------------------------------------------------------------

function parseSegment(
  segment: string
): [tag: number, value: string] | null {
  const len = segment.length;
  // Find '=' without String methods in the hot path
  let eqPos = -1;
  for (let i = 0; i < len; i++) {
    if (segment.charCodeAt(i) === 0x3d) {
      // '='
      eqPos = i;
      break;
    }
  }
  if (eqPos <= 0) return null;

  // Parse tag as integer manually
  let tag = 0;
  for (let i = 0; i < eqPos; i++) {
    const d = segment.charCodeAt(i) - 0x30;
    if (d < 0 || d > 9) return null; // non-digit in tag
    tag = tag * 10 + d;
  }
  if (tag === 0) return null;

  const value = segment.slice(eqPos + 1);
  return [tag, value];
}

// ---------------------------------------------------------------------------
// Main tokenizer
// ---------------------------------------------------------------------------

/**
 * Tokenize a raw FIX log input into an array of messages.
 *
 * Each message starts at a "8=" sequence that appears either at the beginning
 * of the input or immediately after a delimiter. A new message boundary is
 * detected when we encounter "8=" as a tag (tag number 8).
 */
export function tokenize(input: string): TokenizedMessage[] {
  if (input.length === 0) return [];

  const delim = detectDelimiter(input);
  const dw = delimWidth(delim);
  const result: TokenizedMessage[] = [];

  // Collect segments for the current message
  let msgStart = 0;
  let msgPairs: [tag: number, value: string][] = [];
  let pos = 0;
  const len = input.length;

  while (pos < len) {
    // Find the end of this segment (next delimiter or end of string)
    const delimPos = nextDelim(input, pos, delim);
    const segEnd = delimPos === -1 ? len : delimPos;
    const segment = input.slice(pos, segEnd);

    if (segment.length > 0) {
      // Skip leading whitespace so that newline-separated messages (e.g. one
      // message per line) are still split correctly on the tag-8 boundary.
      let wsLen = 0;
      while (wsLen < segment.length && segment.charCodeAt(wsLen) <= 0x20) wsLen++;
      const trimmed = wsLen > 0 ? segment.slice(wsLen) : segment;

      const pair = parseSegment(trimmed);
      if (pair !== null) {
        const [tag] = pair;
        // Tag 8 (BeginString) starts a new message — flush previous if any
        if (tag === 8 && msgPairs.length > 0) {
          result.push(finalizeMessage(input, msgStart, pos, dw, msgPairs));
          msgStart = pos + wsLen;
          msgPairs = [];
        }
        msgPairs.push(pair);
      }
    }

    if (delimPos === -1) break;
    pos = delimPos + dw;
  }

  // Flush final message
  if (msgPairs.length > 0) {
    result.push(finalizeMessage(input, msgStart, len, dw, msgPairs));
  }

  return result;
}

function finalizeMessage(
  input: string,
  start: number,
  end: number,
  _dw: number,
  pairs: [tag: number, value: string][]
): TokenizedMessage {
  // rawText = everything from start up to (but not including) the next msg's
  // leading delimiter-separated "8=" boundary. We just slice to `end`.
  const rawText = input.slice(start, end);
  return { rawText, pairs };
}
