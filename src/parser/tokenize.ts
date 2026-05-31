/**
 * Single-pass FIX message tokenizer.
 *
 * Delimiter detection: one sniff over the first 512 chars finds the first
 * usable delimiter (SOH preferred, then '|', then literal '^A'). The hot
 * loop is a single pass with no per-segment string slicing — we work in
 * input-string indices and only allocate the value substring (and the
 * tuple) at the moment we commit a field.
 */

export interface TokenizedMessage {
  rawText: string;
  pairs: [tag: number, value: string][];
}

// ---------------------------------------------------------------------------
// Delimiter detection (one pass, max 512 chars)
// ---------------------------------------------------------------------------

interface DelimSpec {
  /** Single-char delim byte (or first byte of two-char delim). */
  ch: number;
  /** True if the delimiter is the two-byte literal sequence `^A`. */
  isCaret: boolean;
}

function detectDelim(input: string): DelimSpec {
  const len = input.length;
  const sniff = len > 512 ? 512 : len;
  let pipeAt = -1;
  let caretAt = -1;
  for (let i = 0; i < sniff; i++) {
    const c = input.charCodeAt(i);
    if (c === 0x01) return { ch: 0x01, isCaret: false };
    if (c === 0x7c) {
      if (pipeAt < 0) pipeAt = i;
    } else if (c === 0x5e && caretAt < 0 && i + 1 < sniff &&
               input.charCodeAt(i + 1) === 0x41) {
      caretAt = i;
    }
  }
  if (pipeAt >= 0) return { ch: 0x7c, isCaret: false };
  if (caretAt >= 0) return { ch: 0x5e, isCaret: true };
  // Nothing found — default to SOH (input will be treated as one segment).
  return { ch: 0x01, isCaret: false };
}

// ---------------------------------------------------------------------------
// Main tokenizer
// ---------------------------------------------------------------------------

/**
 * Tokenize a raw FIX log input into an array of messages.
 *
 * A message boundary is tag `8` (BeginString) appearing at the start of a
 * new field. Leading whitespace between fields is skipped so logs with one
 * message per line are split correctly.
 */
export function tokenize(input: string): TokenizedMessage[] {
  const len = input.length;
  if (len === 0) return [];

  const delim = detectDelim(input);
  const delimCh = delim.ch;
  const isCaret = delim.isCaret;

  const result: TokenizedMessage[] = [];
  let msgStart = 0;
  let pairs: [number, string][] = [];
  let pos = 0;

  while (pos < len) {
    // Skip leading whitespace before this field's tag digits.
    const wsStart = pos;
    while (pos < len && input.charCodeAt(pos) <= 0x20) pos++;
    if (pos >= len) break;
    const fieldStart = pos;

    // Scan tag digits, expect '=' at the end.
    let tag = 0;
    let tagOk = false;
    while (pos < len) {
      const c = input.charCodeAt(pos);
      if (c === 0x3d) {
        tagOk = pos > fieldStart && tag > 0;
        break;
      }
      const d = c - 0x30;
      if (d < 0 || d > 9) break;
      tag = tag * 10 + d;
      pos++;
    }

    if (!tagOk) {
      // Malformed field — skip to the next delimiter and continue.
      if (isCaret) {
        while (pos < len) {
          if (input.charCodeAt(pos) === 0x5e && pos + 1 < len &&
              input.charCodeAt(pos + 1) === 0x41) {
            pos += 2;
            break;
          }
          pos++;
        }
      } else {
        while (pos < len) {
          if (input.charCodeAt(pos) === delimCh) { pos++; break; }
          pos++;
        }
      }
      continue;
    }

    // pos is at '=', advance past it. Now scan value until next delim or EOF.
    pos++;
    const valueStart = pos;
    let valueEnd = len;
    if (isCaret) {
      while (pos < len) {
        if (input.charCodeAt(pos) === 0x5e && pos + 1 < len &&
            input.charCodeAt(pos + 1) === 0x41) {
          valueEnd = pos;
          pos += 2;
          break;
        }
        pos++;
      }
    } else {
      while (pos < len) {
        if (input.charCodeAt(pos) === delimCh) {
          valueEnd = pos;
          pos++;
          break;
        }
        pos++;
      }
    }

    // Tag 8 starts a new message — flush prior (if any) before pushing.
    if (tag === 8 && pairs.length > 0) {
      result.push({ rawText: input.slice(msgStart, wsStart), pairs });
      msgStart = fieldStart;
      pairs = [];
    }
    pairs.push([tag, input.slice(valueStart, valueEnd)]);
  }

  if (pairs.length > 0) {
    result.push({ rawText: input.slice(msgStart, len), pairs });
  }
  return result;
}
