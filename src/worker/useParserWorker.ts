import { useCallback } from 'react';
import * as Comlink from 'comlink';
import { useMessagesStore } from '@/state/messages';
import type { ParsedMessage, ParsedField, FixVersion } from '@/parser/types';
import type { FilterTree } from '@/parser/filter/types';
import type { TransferableMessage } from './parser.worker';

type WorkerApi = {
  parse(text: string): Promise<TransferableMessage[]>;
  getDetail(rawText: string, version: FixVersion): Promise<ParsedField[]>;
  filter(tree: FilterTree | null, globalRegex?: string): Promise<Uint32Array>;
};

function deserialize(msg: TransferableMessage): ParsedMessage {
  const { byTagEntries, ...rest } = msg;
  return {
    ...rest,
    byTag: new Map(byTagEntries),
  };
}

let sharedWorker: Worker | null = null;
let sharedApi: Comlink.Remote<WorkerApi> | null = null;

function getSharedWorker(): Comlink.Remote<WorkerApi> {
  if (!sharedWorker) {
    sharedWorker = new Worker(
      new URL('./parser.worker.ts', import.meta.url),
      { type: 'module' }
    );
    sharedApi = Comlink.wrap<WorkerApi>(sharedWorker);
  }
  if (sharedApi === null) throw new Error('Worker API not initialised');
  return sharedApi;
}

export function useParserWorker() {
  const { setMessages, setFilteredIndices, setParseState, setParseProgress, setError, setFilename } =
    useMessagesStore();

  const parse = useCallback(
    async (text: string): Promise<void> => {
      const api = getSharedWorker();
      setFilename(null);
      setParseState('parsing');
      try {
        const transferable = await api.parse(text);
        const messages = transferable.map(deserialize);
        setMessages(messages);
        setParseState('ready');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
      }
    },
    [setMessages, setParseState, setError, setFilename]
  );

  const parseFile = useCallback(
    async (file: File): Promise<void> => {
      const api = getSharedWorker();
      setParseState('parsing');
      setParseProgress(0);
      setFilename(file.name);
      try {
        const text = await file.text();
        setParseProgress(50);
        const transferable = await api.parse(text);
        const messages = transferable.map(deserialize);
        setMessages(messages);
        setParseState('ready');
        setParseProgress(100);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'File read failed';
        setError(msg);
      }
    },
    [setMessages, setParseState, setParseProgress, setError, setFilename]
  );

  const getDetail = useCallback(
    async (rawText: string, version: FixVersion): Promise<ParsedField[]> => {
      const api = getSharedWorker();
      return api.getDetail(rawText, version);
    },
    []
  );

  const filter = useCallback(
    async (tree: FilterTree | null, globalRegex?: string): Promise<void> => {
      const api = getSharedWorker();
      const indices = await api.filter(tree, globalRegex);
      setFilteredIndices(indices);
    },
    [setFilteredIndices]
  );

  return { parse, parseFile, getDetail, filter };
}
