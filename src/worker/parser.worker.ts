import * as Comlink from 'comlink';
import { tokenize } from '@/parser/tokenize';
import { parseMessages } from '@/parser/parse';
import { loadDictionary } from '@/parser/dictionary';
import type { ParsedMessage } from '@/parser/types';

/** Wire-transfer shape: byTag serialised as entries array (Map is not cloneable). */
export interface TransferableMessage
  extends Omit<ParsedMessage, 'byTag'> {
  byTagEntries: [number, string][];
}

export interface PerColumnFilter {
  tag: number;
  needle: string;
  mode: 'substring' | 'equals';
}

export interface FilterArgs {
  regex?: string;
  perColumn?: PerColumnFilter[];
}

/** Module-level store: populated by parse(), read by filter(). */
let storedMessages: ParsedMessage[] = [];

const api = {
  async parse(text: string): Promise<TransferableMessage[]> {
    const tokens = tokenize(text);
    const parsed = await parseMessages(tokens, loadDictionary);
    storedMessages = parsed;
    return parsed.map((msg) => {
      const { byTag, ...rest } = msg;
      return {
        ...rest,
        byTagEntries: Array.from(byTag.entries()),
      };
    });
  },

  filter(args: FilterArgs): Uint32Array {
    const msgs = storedMessages;
    const total = msgs.length;

    // Fast path: no filters at all
    const hasRegex = args.regex !== undefined && args.regex.length > 0;
    const hasPerColumn =
      args.perColumn !== undefined && args.perColumn.length > 0;

    if (!hasRegex && !hasPerColumn) {
      const all = new Uint32Array(total);
      for (let i = 0; i < total; i++) {
        all[i] = i;
      }
      return Comlink.transfer(all, [all.buffer]);
    }

    // Compile regex once; fall back to null on invalid pattern
    let rx: RegExp | null = null;
    if (hasRegex && args.regex !== undefined) {
      try {
        rx = new RegExp(args.regex, 'i');
      } catch {
        rx = null;
      }
    }

    const perCol = args.perColumn ?? [];

    // Pre-lowercase needles for substring mode to avoid repeated work
    const loweredNeedles = perCol.map((f) =>
      f.mode === 'substring' ? f.needle.toLowerCase() : f.needle
    );

    // Collect matching indices into a pre-allocated buffer, then slice
    const buf = new Uint32Array(total);
    let count = 0;

    for (let i = 0; i < total; i++) {
      const msg = msgs[i];
      if (msg === undefined) continue;

      // Global regex filter
      if (rx !== null && !rx.test(msg.rawText)) continue;

      // Per-column filters (AND-combined)
      let pass = true;
      for (let j = 0; j < perCol.length; j++) {
        const f = perCol[j];
        if (f === undefined) continue;
        const value = msg.byTag.get(f.tag);
        // If the tag is absent the message cannot match
        if (value === undefined) {
          // For tag 35, also check msgType label
          if (f.tag === 35 && msg.msgType !== undefined) {
            const label = msg.msgType;
            const needle = loweredNeedles[j];
            if (needle === undefined) { pass = false; break; }
            if (f.mode === 'equals') {
              if (label !== needle) { pass = false; break; }
            } else {
              if (!label.toLowerCase().includes(needle)) { pass = false; break; }
            }
          } else {
            pass = false;
            break;
          }
          continue;
        }
        const needle = loweredNeedles[j];
        if (needle === undefined) { pass = false; break; }
        if (f.mode === 'equals') {
          if (value !== needle) { pass = false; break; }
        } else {
          if (!value.toLowerCase().includes(needle)) { pass = false; break; }
        }
      }
      if (!pass) continue;

      buf[count++] = i;
    }

    const result = buf.slice(0, count);
    return Comlink.transfer(result, [result.buffer]);
  },
};

Comlink.expose(api);
