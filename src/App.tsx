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
        <span className="text-base font-bold tracking-tight">FIXate</span>
        <span className="ml-2 text-xs text-muted-foreground font-mono">
          FIX protocol log browser
        </span>
        <div className="ml-auto flex items-center gap-2">
          {/* About popover */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                aria-label="About FIXate"
                title="About FIXate"
              >
                <Info className="h-4 w-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 text-sm">
              <p className="font-semibold mb-1">FIXate</p>
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
