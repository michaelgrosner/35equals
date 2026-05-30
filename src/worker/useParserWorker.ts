import { useEffect, useRef, useCallback } from 'react';
import * as Comlink from 'comlink';
import { useMessagesStore } from '@/state/messages';
import type { ParsedMessage } from '@/parser/types';
import type { TransferableMessage } from './parser.worker';

type WorkerApi = {
  parse(text: string): Promise<TransferableMessage[]>;
};

function deserialize(msg: TransferableMessage): ParsedMessage {
  const { byTagEntries, ...rest } = msg;
  return {
    ...rest,
    byTag: new Map(byTagEntries),
  };
}

export function useParserWorker() {
  const workerRef = useRef<Worker | null>(null);
  const apiRef = useRef<Comlink.Remote<WorkerApi> | null>(null);

  const { setMessages, setParseState, setError } = useMessagesStore();

  useEffect(() => {
    const worker = new Worker(
      new URL('./parser.worker.ts', import.meta.url),
      { type: 'module' }
    );
    workerRef.current = worker;
    apiRef.current = Comlink.wrap<WorkerApi>(worker);

    return () => {
      apiRef.current?.[Comlink.releaseProxy]();
      worker.terminate();
      workerRef.current = null;
      apiRef.current = null;
    };
  }, []);

  const parse = useCallback(
    async (text: string): Promise<void> => {
      const api = apiRef.current;
      if (api === null) return;

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
    [setMessages, setParseState, setError]
  );

  return { parse };
}
