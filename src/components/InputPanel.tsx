import { useRef, useCallback, useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMessagesStore } from '@/state/messages';

interface InputPanelProps {
  onParse: (text: string) => Promise<void>;
  /** When true, collapses to a thin strip showing message count + clear. */
  collapsed?: boolean;
}

const DEBOUNCE_MS = 300;

export function InputPanel({ onParse, collapsed = false }: InputPanelProps) {
  const [text, setText] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { parseState, messages, clear } = useMessagesStore();

  const isParsing = parseState === 'parsing';

  // Auto-parse with debounce when text changes
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setText(val);

      if (debounceRef.current !== null) {
        clearTimeout(debounceRef.current);
      }
      if (val.trim().length === 0) return;

      debounceRef.current = setTimeout(() => {
        void onParse(val);
      }, DEBOUNCE_MS);
    },
    [onParse]
  );

  // Clear debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleClear = useCallback(() => {
    setText('');
    clear();
  }, [clear]);

  const handleParse = useCallback(() => {
    if (text.trim().length > 0) {
      void onParse(text);
    }
  }, [onParse, text]);

  if (collapsed) {
    return (
      <div className="flex h-10 items-center gap-3 border-b bg-muted/40 px-4">
        <span className="text-sm font-medium">
          {messages.length} message{messages.length !== 1 ? 's' : ''} loaded
        </span>
        {isParsing && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
        <div className="ml-auto">
          <Button variant="ghost" size="sm" onClick={handleClear}>
            <X className="mr-1 h-3 w-3" />
            Clear
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-2xl flex-col gap-3">
      <textarea
        className="h-48 w-full resize-none rounded-md border bg-background px-3 py-2 font-mono text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        placeholder={"Paste FIX messages here, e.g.\n8=FIX.4.2|35=D|49=SENDER|56=TARGET|..."}
        value={text}
        onChange={handleChange}
        disabled={isParsing}
        spellCheck={false}
      />
      <div className="flex items-center gap-2">
        <Button
          onClick={handleParse}
          disabled={isParsing || text.trim().length === 0}
          size="sm"
        >
          {isParsing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Parse
        </Button>
        {text.length > 0 && (
          <Button variant="ghost" size="sm" onClick={handleClear}>
            <X className="mr-1 h-3 w-3" />
            Clear
          </Button>
        )}
        {parseState === 'ready' && (
          <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {messages.length} message{messages.length !== 1 ? 's' : ''}
          </span>
        )}
        {parseState === 'error' && (
          <span className="ml-2 text-xs text-destructive">
            {useMessagesStore.getState().errorMessage ?? 'Parse error'}
          </span>
        )}
      </div>
    </div>
  );
}
