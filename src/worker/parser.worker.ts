import * as Comlink from 'comlink';
import { tokenize } from '@/parser/tokenize';
import { parseMessages } from '@/parser/parse';
import { loadDictionary } from '@/parser/dictionary';
import { detectVersion } from '@/parser/detect';
import type { DictionaryData, FixVersion, ParsedMessage } from '@/parser/types';

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

let storedMessages: ParsedMessage[] = [];

/**
 * Sniff unique FixVersions needed from a token stream without fully parsing.
 * This lets us pre-load only the dicts we'll actually use.
 */
function sniffVersions(tokens: ReturnType<typeof tokenize>): Set<FixVersion> {
  const versions = new Set<FixVersion>();
  for (const tok of tokens) {
    const byTag = new Map<number, string>();
    for (const [tag, value] of tok.pairs) {
      if (tag === 8 || tag === 1128) byTag.set(tag, value);
    }
    const v = detectVersion(byTag);
    versions.add(v === 'UNKNOWN' ? 'FIX.4.2' : v);
  }
  return versions;
}

const api = {
  async parse(text: string): Promise<TransferableMessage[]> {
    const tokens = tokenize(text);

    // Pre-load all needed dictionaries in parallel (each is cached after first load)
    const versions = sniffVersions(tokens);
    const entries = await Promise.all(
      Array.from(versions).map(async (v) => {
        const dict = await loadDictionary(v);
        return [v, dict] as [FixVersion, DictionaryData];
      })
    );
    const dictMap = new Map<FixVersion, DictionaryData>(entries);

    // Synchronous parse — no await in the hot loop
    const parsed = parseMessages(tokens, (v) => dictMap.get(v) ?? { fields: {}, msgTypes: {} });
    storedMessages = parsed;

    return parsed.map((msg) => {
      const { byTag, ...rest } = msg;
      return { ...rest, byTagEntries: Array.from(byTag.entries()) };
    });
  },

  filter(args: FilterArgs): Uint32Array {
    const msgs = storedMessages;
    const total = msgs.length;

    const hasRegex = args.regex !== undefined && args.regex.length > 0;
    const hasPerColumn =
      args.perColumn !== undefined && args.perColumn.length > 0;

    if (!hasRegex && !hasPerColumn) {
      const all = new Uint32Array(total);
      for (let i = 0; i < total; i++) all[i] = i;
      return Comlink.transfer(all, [all.buffer]);
    }

    let rx: RegExp | null = null;
    if (hasRegex && args.regex !== undefined) {
      try { rx = new RegExp(args.regex, 'i'); } catch { rx = null; }
    }

    const perCol = args.perColumn ?? [];
    const loweredNeedles = perCol.map((f) =>
      f.mode === 'substring' ? f.needle.toLowerCase() : f.needle
    );

    const buf = new Uint32Array(total);
    let count = 0;

    for (let i = 0; i < total; i++) {
      const msg = msgs[i];
      if (msg === undefined) continue;

      if (rx !== null && !rx.test(msg.rawText)) continue;

      let pass = true;
      for (let j = 0; j < perCol.length; j++) {
        const f = perCol[j];
        if (f === undefined) continue;
        const value = msg.byTag.get(f.tag);
        if (value === undefined) {
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
            pass = false; break;
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
