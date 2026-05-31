import * as Comlink from 'comlink';
import { tokenize } from '@/parser/tokenize';
import { parseMessages } from '@/parser/parse';
import { loadDictionary } from '@/parser/dictionary';
import { detectVersion } from '@/parser/detect';
import type { DictionaryData, FixVersion, ParsedField, ParsedMessage } from '@/parser/types';

export interface TransferableMessage
  extends Omit<ParsedMessage, 'byTag' | 'fields'> {
  byTagEntries: [number, string][];
}

// Retained after parse() so getDetail() can reuse the same dicts without
// re-loading them from disk on every row click.
let cachedDictMap: Map<FixVersion, DictionaryData> | null = null;

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

    const versions = sniffVersions(tokens);
    const entries = await Promise.all(
      Array.from(versions).map(async (v) => {
        const dict = await loadDictionary(v);
        return [v, dict] as [FixVersion, DictionaryData];
      })
    );
    cachedDictMap = new Map<FixVersion, DictionaryData>(entries);

    const parsed = parseMessages(tokens, (v) => cachedDictMap!.get(v) ?? { fields: {}, msgTypes: {} });

    // Strip `fields` — they're expensive to clone at scale (~6 KB per message).
    // Use getDetail() to fetch fields for a single selected message instead.
    return parsed.map((msg) => {
      const { byTag, fields: _fields, ...rest } = msg;
      return { ...rest, byTagEntries: Array.from(byTag.entries()) };
    });
  },

  async getDetail(rawText: string, _version: FixVersion): Promise<ParsedField[]> {
    const dictMap = cachedDictMap ?? new Map<FixVersion, DictionaryData>();
    const tokens = tokenize(rawText);
    if (tokens.length === 0) return [];
    const messages = parseMessages(tokens, (v) => dictMap.get(v) ?? { fields: {}, msgTypes: {} });
    return messages[0]?.fields ?? [];
  },
};

Comlink.expose(api);
