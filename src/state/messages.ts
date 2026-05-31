import { create } from 'zustand';
import type { ParsedMessage } from '@/parser/types';

export type ParseState = 'idle' | 'parsing' | 'ready' | 'error';

interface MessagesStore {
  messages: ParsedMessage[];
  filteredIndices: Uint32Array | null;
  selectedIndex: number | null;
  parseState: ParseState;
  parseProgress: number;
  errorMessage: string | null;
  filename: string | null;
  setMessages: (msgs: ParsedMessage[]) => void;
  setFilteredIndices: (indices: Uint32Array | null) => void;
  setSelectedIndex: (i: number | null) => void;
  setParseState: (s: ParseState) => void;
  setParseProgress: (progress: number) => void;
  setError: (msg: string) => void;
  setFilename: (name: string | null) => void;
  clear: () => void;
}

export const useMessagesStore = create<MessagesStore>((set) => ({
  messages: [],
  filteredIndices: null,
  selectedIndex: null,
  parseState: 'idle',
  parseProgress: 0,
  errorMessage: null,
  filename: null,
  setMessages: (msgs) => { set({ messages: msgs, filteredIndices: null }); },
  setFilteredIndices: (indices) => { set({ filteredIndices: indices }); },
  setSelectedIndex: (i) => { set({ selectedIndex: i }); },
  setParseState: (s) => { set({ parseState: s }); },
  setParseProgress: (progress) => { set({ parseProgress: progress }); },
  setError: (msg) => { set({ parseState: 'error', errorMessage: msg }); },
  setFilename: (name) => { set({ filename: name }); },
  clear: () => {
    set({
      messages: [],
      filteredIndices: null,
      selectedIndex: null,
      parseState: 'idle',
      parseProgress: 0,
      errorMessage: null,
      filename: null,
    });
  },
}));
