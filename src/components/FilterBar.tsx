import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { useMessagesStore } from '@/state/messages';
import { useParserWorker } from '@/worker/useParserWorker';
import type { FilterArgs } from '@/worker/parser.worker';
import { cn } from '@/lib/utils';

/** Tags shown as per-column filter inputs in the bar. */
const FILTER_TAGS = [35, 49, 56, 54, 39] as const;

const TAG_LABELS: Record<number, string> = {
  35: 'MsgType',
  49: 'Sender',
  56: 'Target',
  54: 'Side',
  39: 'Status',
};

interface ColFilter {
  tag: number;
  value: string;
}

function isRegexValid(pattern: string): boolean {
  if (pattern.length === 0) return true;
  try {
    new RegExp(pattern, 'i');
    return true;
  } catch {
    return false;
  }
}

export function FilterBar() {
  const { messages } = useMessagesStore();
  const { filter } = useParserWorker();

  const [globalRegex, setGlobalRegex] = useState('');
  const [colFilters, setColFilters] = useState<ColFilter[]>(
    FILTER_TAGS.map((tag) => ({ tag, value: '' }))
  );

  const regexValid = isRegexValid(globalRegex);

  // Count how many filters are active
  const activeCount =
    (globalRegex.length > 0 ? 1 : 0) +
    colFilters.filter((f) => f.value.length > 0).length;

  const buildArgs = useCallback(
    (regex: string, cols: ColFilter[]): FilterArgs => {
      const args: FilterArgs = {};
      if (regex.length > 0) {
        args.regex = regex;
      }
      const perColumn = cols
        .filter((f) => f.value.length > 0)
        .map((f) => ({
          tag: f.tag,
          needle: f.value,
          mode: 'substring' as const,
        }));
      if (perColumn.length > 0) {
        args.perColumn = perColumn;
      }
      return args;
    },
    []
  );

  // Debounced filter call: fires 150 ms after last change
  useEffect(() => {
    if (messages.length === 0) return;
    const id = setTimeout(() => {
      const args = buildArgs(globalRegex, colFilters);
      void filter(args);
    }, 150);
    return () => { clearTimeout(id); };
  }, [globalRegex, colFilters, filter, messages.length, buildArgs]);

  const handleReset = useCallback(() => {
    setGlobalRegex('');
    setColFilters(FILTER_TAGS.map((tag) => ({ tag, value: '' })));
  }, []);

  const handleColChange = useCallback((tag: number, value: string) => {
    setColFilters((prev) =>
      prev.map((f) => (f.tag === tag ? { tag, value } : f))
    );
  }, []);

  return (
    <div className="flex flex-shrink-0 items-center gap-2 border-b bg-background px-3 py-1.5 overflow-x-auto">
      {/* Global regex input */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
          regex
        </span>
        <input
          type="text"
          value={globalRegex}
          onChange={(e) => { setGlobalRegex(e.target.value); }}
          placeholder="filter all fields…"
          spellCheck={false}
          className={cn(
            'h-6 w-44 rounded border bg-transparent px-2 text-xs font-mono outline-none focus:ring-1',
            regexValid
              ? 'border-border focus:ring-primary'
              : 'border-destructive focus:ring-destructive text-destructive'
          )}
          title={regexValid ? undefined : 'Invalid regular expression'}
        />
        {!regexValid && (
          <span className="text-xs text-destructive whitespace-nowrap">
            invalid regex
          </span>
        )}
      </div>

      <div className="h-4 w-px bg-border flex-shrink-0" />

      {/* Per-column inputs */}
      {colFilters.map((f) => (
        <div key={f.tag} className="flex items-center gap-1 flex-shrink-0">
          <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
            {String(f.tag)}&nbsp;
            <span className="hidden sm:inline">{TAG_LABELS[f.tag] ?? ''}</span>
          </span>
          <input
            type="text"
            value={f.value}
            onChange={(e) => { handleColChange(f.tag, e.target.value); }}
            placeholder="filter…"
            spellCheck={false}
            className="h-6 w-24 rounded border border-border bg-transparent px-2 text-xs font-mono outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      ))}

      {/* Reset button — only visible when filters are active */}
      {activeCount > 0 && (
        <>
          <div className="h-4 w-px bg-border flex-shrink-0" />
          <button
            onClick={handleReset}
            className="flex flex-shrink-0 items-center gap-1 rounded px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Clear all filters"
          >
            <X className="h-3 w-3" />
            Reset ({String(activeCount)})
          </button>
        </>
      )}
    </div>
  );
}
