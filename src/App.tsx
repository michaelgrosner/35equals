import { Loader2 } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { InputPanel } from '@/components/InputPanel';
import { MessageGrid } from '@/components/MessageGrid';
import { DetailPanel } from '@/components/DetailPanel';
import { useParserWorker } from '@/worker/useParserWorker';
import { useMessagesStore } from '@/state/messages';

export function App() {
  const { parse } = useParserWorker();
  const { parseState, messages } = useMessagesStore();

  const isReady = parseState === 'ready' && messages.length > 0;
  const isParsing = parseState === 'parsing';

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-50 flex h-12 items-center border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <span className="text-base font-bold tracking-tight">FIXate</span>
        <span className="ml-2 text-xs text-muted-foreground font-mono">
          FIX protocol log browser
        </span>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </header>

      {/* Main content */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {isReady ? (
          <>
            {/* Collapsed input strip */}
            <InputPanel onParse={parse} collapsed />

            {/* Grid + detail pane */}
            <div className="flex flex-1 overflow-hidden">
              <div className="flex w-[65%] flex-col overflow-auto border-r">
                <MessageGrid />
              </div>
              <div className="flex w-[35%] flex-col overflow-hidden">
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
