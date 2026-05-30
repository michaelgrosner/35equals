import { create } from 'zustand';
import type { ParsedMessage } from '@/parser/types';

export type ParseState = 'idle' | 'parsing' | 'ready' | 'error';

interface MessagesStore {
  messages: ParsedMessage[];
  selectedIndex: number | null;
  parseState: ParseState;
  errorMessage: string | null;
  filteredIndices: Uint32Array | null;
  setMessages: (msgs: ParsedMessage[]) => void;
  setSelectedIndex: (i: number | null) => void;
  setParseState: (s: ParseState) => void;
  setError: (msg: string) => void;
  setFilteredIndices: (indices: Uint32Array | null) => void;
  clear: () => void;
}

export const useMessagesStore = create<MessagesStore>((set) => ({
  messages: [],
  selectedIndex: null,
  parseState: 'idle',
  errorMessage: null,
  filteredIndices: null,
  setMessages: (msgs) => { set({ messages: msgs, filteredIndices: null }); },
  setSelectedIndex: (i) => { set({ selectedIndex: i }); },
  setParseState: (s) => { set({ parseState: s }); },
  setError: (msg) => { set({ parseState: 'error', errorMessage: msg }); },
  setFilteredIndices: (indices) => { set({ filteredIndices: indices }); },
  clear: () => {
    set({
      messages: [],
      selectedIndex: null,
      parseState: 'idle',
      errorMessage: null,
      filteredIndices: null,
    });
  },
}));
