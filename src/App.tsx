import { useRef, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { InputPanel } from '@/components/InputPanel';
import { FilterBar } from '@/components/FilterBar';
import { MessageGrid } from '@/components/MessageGrid';
import { DetailPanel } from '@/components/DetailPanel';
import { ColumnSettings } from '@/components/ColumnSettings';
import { useParserWorker } from '@/worker/useParserWorker';
import { useMessagesStore } from '@/state/messages';
import { useSettingsStore } from '@/state/settings';

export function App() {
  const { parse } = useParserWorker();
  const { parseState, messages } = useMessagesStore();
  const { splitRatio, setSplitRatio } = useSettingsStore();

  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isReady = parseState === 'ready' && messages.length > 0;
  const isParsing = parseState === 'parsing';

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
    <div className="flex min-h-screen flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-50 flex h-12 items-center border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <span className="text-base font-bold tracking-tight">FIXate</span>
        <span className="ml-2 text-xs text-muted-foreground font-mono">
          FIX protocol log browser
        </span>
        <div className="ml-auto flex items-center gap-2">
          {isReady && <ColumnSettings />}
          <ThemeToggle />
        </div>
      </header>

      {/* Main content */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {isReady ? (
          <>
            {/* Collapsed input strip */}
            <InputPanel onParse={parse} collapsed />

            {/* Filter bar */}
            <FilterBar />

            {/* Grid + detail pane with resizable split */}
            <div ref={containerRef} className="flex flex-1 overflow-hidden">
              <div
                className="flex flex-col overflow-hidden border-r"
                style={{ width: `${String(splitRatio)}%` }}
              >
                <MessageGrid />
              </div>

              {/* Drag handle */}
              <div
                className="w-1 flex-shrink-0 cursor-col-resize bg-border hover:bg-primary/40 transition-colors"
                onMouseDown={handleDragStart}
              />

              <div
                className="flex flex-col overflow-hidden"
                style={{ width: `${String(100 - splitRatio)}%` }}
              >
                <DetailPanel />
              </div>
            </div>
          </>
        ) : (
          /* Idle / parsing / error: centred input */
          <div className="flex flex-1 flex-col items-center justify-center px-4 py-16">
            <InputPanel onParse={parse} />
          </div>
        )}

        {/* Parsing overlay */}
        {isParsing && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/50">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
      </main>
    </div>
  );
}
