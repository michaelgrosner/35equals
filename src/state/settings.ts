import { create } from 'zustand';
import { storageGet, storageSet } from '@/lib/storage';
import { DEFAULT_VISIBLE_TAGS } from '@/lib/columns';

const STORAGE_KEY = 'fixate:settings:v1';

export interface ColumnSetting {
  tag: number;
  visible: boolean;
  width: number;
  order: number;
}

interface PersistedSettings {
  columns: ColumnSetting[];
  splitRatio: number;
}

function defaultColumns(): ColumnSetting[] {
  return DEFAULT_VISIBLE_TAGS.map((tag, i) => ({
    tag,
    visible: true,
    width: 120,
    order: i,
  }));
}

function loadInitial(): PersistedSettings {
  return storageGet<PersistedSettings>(STORAGE_KEY, {
    columns: defaultColumns(),
    splitRatio: 65,
  });
}

interface SettingsStore {
  columns: ColumnSetting[];
  splitRatio: number;
  setColumnVisible: (tag: number, visible: boolean) => void;
  setColumnWidth: (tag: number, width: number) => void;
  setColumnOrder: (orderedTags: number[]) => void;
  setSplitRatio: (ratio: number) => void;
  resetColumns: () => void;
}

function persist(state: Pick<SettingsStore, 'columns' | 'splitRatio'>): void {
  storageSet<PersistedSettings>(STORAGE_KEY, {
    columns: state.columns,
    splitRatio: state.splitRatio,
  });
}

const initial = loadInitial();

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  columns: initial.columns,
  splitRatio: initial.splitRatio,

  setColumnVisible: (tag, visible) => {
    set((s) => {
      const columns = s.columns.map((c) =>
        c.tag === tag ? { ...c, visible } : c
      );
      const next = { ...s, columns };
      persist(next);
      return { columns };
    });
  },

  setColumnWidth: (tag, width) => {
    set((s) => {
      const columns = s.columns.map((c) =>
        c.tag === tag ? { ...c, width } : c
      );
      const next = { ...s, columns };
      persist(next);
      return { columns };
    });
  },

  setColumnOrder: (orderedTags) => {
    set((s) => {
      const byTag = new Map(s.columns.map((c) => [c.tag, c]));
      const columns: ColumnSetting[] = orderedTags.map((tag, i) => {
        const existing = byTag.get(tag);
        return existing !== undefined
          ? { ...existing, order: i }
          : { tag, visible: true, width: 120, order: i };
      });
      const next = { ...s, columns };
      persist(next);
      return { columns };
    });
  },

  setSplitRatio: (ratio) => {
    set((s) => {
      const next = { ...s, splitRatio: ratio };
      persist(next);
      return { splitRatio: ratio };
    });
  },

  resetColumns: () => {
    const columns = defaultColumns();
    set((s) => {
      const next = { ...s, columns };
      persist(next);
      return { columns };
    });
    // Re-read to get current splitRatio
    const { splitRatio } = get();
    persist({ columns, splitRatio });
  },
}));
