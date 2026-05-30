import { create } from 'zustand';
import type { ParsedMessage } from '@/parser/types';

export type ParseState = 'idle' | 'parsing' | 'ready' | 'error';

interface MessagesStore {
  messages: ParsedMessage[];
  selectedIndex: number | null;
  parseState: ParseState;
  errorMessage: string | null;
  setMessages: (msgs: ParsedMessage[]) => void;
  setSelectedIndex: (i: number | null) => void;
  setParseState: (s: ParseState) => void;
  setError: (msg: string) => void;
  clear: () => void;
}

export const useMessagesStore = create<MessagesStore>((set) => ({
  messages: [],
  selectedIndex: null,
  parseState: 'idle',
  errorMessage: null,
  setMessages: (msgs) => { set({ messages: msgs }); },
  setSelectedIndex: (i) => { set({ selectedIndex: i }); },
  setParseState: (s) => { set({ parseState: s }); },
  setError: (msg) => { set({ parseState: 'error', errorMessage: msg }); },
  clear: () => {
    set({
      messages: [],
      selectedIndex: null,
      parseState: 'idle',
      errorMessage: null,
    });
  },
}));
