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

const api = {
  async parse(text: string): Promise<TransferableMessage[]> {
    const tokens = tokenize(text);
    const parsed = await parseMessages(tokens, loadDictionary);
    return parsed.map((msg) => {
      const { byTag, ...rest } = msg;
      return {
        ...rest,
        byTagEntries: Array.from(byTag.entries()),
      };
    });
  },
};

Comlink.expose(api);
