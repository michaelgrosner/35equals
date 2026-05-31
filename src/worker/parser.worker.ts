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

    const versions = sniffVersions(tokens);
    const entries = await Promise.all(
      Array.from(versions).map(async (v) => {
        const dict = await loadDictionary(v);
        return [v, dict] as [FixVersion, DictionaryData];
      })
    );
    const dictMap = new Map<FixVersion, DictionaryData>(entries);

    const parsed = parseMessages(tokens, (v) => dictMap.get(v) ?? { fields: {}, msgTypes: {} });

    return parsed.map((msg) => {
      const { byTag, ...rest } = msg;
      return { ...rest, byTagEntries: Array.from(byTag.entries()) };
    });
  },
};

Comlink.expose(api);
