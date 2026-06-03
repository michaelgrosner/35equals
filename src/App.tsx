import { useRef, useCallback, useEffect } from 'react';
import { Loader2, Info } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { InputPanel } from '@/components/InputPanel';
import { MessageGrid } from '@/components/MessageGrid';
import { DetailPanel } from '@/components/DetailPanel';
import { DropZone } from '@/components/DropZone';
import { FilterBar } from '@/components/FilterBar';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import { useParserWorker } from '@/worker/useParserWorker';
import { useMessagesStore } from '@/state/messages';
import { useSettingsStore } from '@/state/settings';

export function App() {
  const { parse, parseFile, getDetail } = useParserWorker();
  const { parseState, messages, selectedIndex, setSelectedIndex, clear } = useMessagesStore();
  const { splitRatio, setSplitRatio } = useSettingsStore();

  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isReady = parseState === 'ready' && messages.length > 0;
  const isParsing = parseState === 'parsing';
  const isSingleMessage = isReady && messages.length === 1;

  // Auto-select message 0 when there's exactly one message
  useEffect(() => {
    if (isSingleMessage) {
      setSelectedIndex(0);
    }
  }, [isSingleMessage, setSelectedIndex]);

  // Push a history entry so the back button can clear
  useEffect(() => {
    if (isReady) {
      history.pushState(null, '');
    }
  }, [isReady]);

  // Back button clears the session
  useEffect(() => {
    const handle = () => { clear(); };
    window.addEventListener('popstate', handle);
    return () => { window.removeEventListener('popstate', handle); };
  }, [clear]);

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;

      const onMouseMove = (ev: MouseEvent) => {
        if (!isDragging.current) return;
        const container = containerRef.current;
        if (container === null) return;
        const rect = container.getBoundingClientRect();
        const ratio = ((ev.clientX - rect.left) / rect.width) * 100;
        setSplitRatio(Math.min(85, Math.max(15, ratio)));
      };

      const onMouseUp = () => {
        isDragging.current = false;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [setSplitRatio]
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Full-window drag-and-drop overlay */}
      <DropZone onFileDrop={parseFile} />

      {/* Top bar */}
      <header className="flex h-12 flex-shrink-0 items-center border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <span className="text-base font-bold tracking-tight">35equals</span>
        <span className="ml-2 text-xs text-muted-foreground font-mono">
          FIX protocol log browser
        </span>
        <div className="ml-auto flex items-center gap-2">
          {/* About popover */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                aria-label="About 35equals"
                title="About 35equals"
              >
                <Info className="h-4 w-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 text-sm">
              <p className="font-semibold mb-1">35equals</p>
              <p className="text-muted-foreground text-xs leading-relaxed mb-3">
                All parsing happens in your browser. Nothing is uploaded. No analytics.
              </p>
              <p className="font-semibold text-xs mb-2">Keyboard shortcuts</p>
              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-muted-foreground items-center">
                <span className="font-mono bg-muted px-1 py-0.5 rounded text-[10px] text-foreground">↑ ↓</span><span>Move selection</span>
                <span className="font-mono bg-muted px-1 py-0.5 rounded text-[10px] text-foreground">j k</span><span>Move selection</span>
                <span className="font-mono bg-muted px-1 py-0.5 rounded text-[10px] text-foreground">g / G</span><span>First / last row</span>
                <span className="font-mono bg-muted px-1 py-0.5 rounded text-[10px] text-foreground">Enter</span><span>Focus detail panel</span>
                <span className="font-mono bg-muted px-1 py-0.5 rounded text-[10px] text-foreground">Esc</span><span>Return to grid</span>
                <span className="font-mono bg-muted px-1 py-0.5 rounded text-[10px] text-foreground">/</span><span>Focus search</span>
              </div>
            </PopoverContent>
          </Popover>

          <a
            href="https://github.com/michaelgrosner/35equals"
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="View source on GitHub"
            title="View source on GitHub"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
          </a>
          <ThemeToggle />
        </div>
      </header>

      {/* Main content */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Input section — collapses to thin strip once parsing completes */}
        <div
          className="flex flex-col overflow-hidden transition-[height] duration-300 ease-in-out"
          style={{ height: isReady ? '2.5rem' : 'calc(100vh - 3rem)' }}
        >
          {isReady ? (
            <InputPanel onParse={parse} onParseFile={parseFile} collapsed />
          ) : (
            <InputPanel onParse={parse} onParseFile={parseFile} fillHeight />
          )}
        </div>

        {/* Grid / detail — revealed as input collapses */}
        {isReady && (
          isSingleMessage ? (
            <div className="flex flex-1 overflow-hidden">
              <DetailPanel onGetDetail={getDetail} />
            </div>
          ) : (
            <div ref={containerRef} className="flex flex-1 overflow-hidden" role="group" aria-label="Message grid and detail panel">
              {/* Grid — expands to full width when nothing is selected */}
              <div
                className="flex flex-col overflow-hidden border-r transition-[width] duration-200 ease-in-out"
                style={{ width: selectedIndex !== null ? `${String(splitRatio)}%` : '100%' }}
                role="grid"
                aria-label="FIX messages grid"
              >
                <FilterBar />
                <MessageGrid />
              </div>

              {/* Drag handle + detail panel — collapses to 0 when nothing selected */}
              <div
                className="flex overflow-hidden transition-[width] duration-200 ease-in-out"
                style={{ width: selectedIndex !== null ? `${String(100 - splitRatio)}%` : '0%' }}
              >
                <div
                  className="w-1 flex-shrink-0 cursor-col-resize bg-border hover:bg-primary/40 transition-colors"
                  onMouseDown={handleDragStart}
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="Resize panels"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowLeft') {
                      setSplitRatio(Math.max(15, splitRatio - 2));
                    } else if (e.key === 'ArrowRight') {
                      setSplitRatio(Math.min(85, splitRatio + 2));
                    }
                  }}
                />
                <div className="flex flex-1 flex-col overflow-hidden min-w-0">
                  <DetailPanel onGetDetail={getDetail} />
                </div>
              </div>
            </div>
          )
        )}

        {/* Parsing overlay */}
        {isParsing && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/50">
            <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Parsing messages…" />
          </div>
        )}
      </main>
    </div>
  );
}
