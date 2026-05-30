import { useRef, useCallback, useEffect, useState } from 'react';
import { Loader2, X, Upload, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMessagesStore } from '@/state/messages';

interface InputPanelProps {
  onParse: (text: string) => Promise<void>;
  onParseFile?: (file: File) => Promise<void>;
  /** When true, collapses to a thin strip showing message count + clear. */
  collapsed?: boolean;
}

const DEBOUNCE_MS = 300;

export function InputPanel({ onParse, onParseFile, collapsed = false }: InputPanelProps) {
  const [text, setText] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { parseState, parseProgress, errorMessage, messages, clear } = useMessagesStore();

  const isParsing = parseState === 'parsing';
  const isError = parseState === 'error';

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

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file !== undefined && onParseFile !== undefined) {
        void onParseFile(file);
      }
      // Reset so the same file can be re-opened
      e.target.value = '';
    },
    [onParseFile]
  );

  if (collapsed) {
    const versions = [...new Set(messages.map((m) => m.version))].join(', ');

    return (
      <div className="flex h-10 items-center gap-3 border-b bg-muted/40 px-4">
        <span className="text-sm font-medium">
          {messages.length} message{messages.length !== 1 ? 's' : ''} loaded
        </span>
        {versions.length > 0 && (
          <span className="text-xs font-mono text-muted-foreground">{versions}</span>
        )}
        {isParsing && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Parsing…" />
        )}
        <div className="ml-auto">
          <Button variant="ghost" size="sm" onClick={handleClear} aria-label="Clear all messages">
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
        aria-label="FIX message input"
      />

      {/* Error banner */}
      {isError && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{errorMessage ?? 'Parse error'}</span>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button
          onClick={handleParse}
          disabled={isParsing || text.trim().length === 0}
          size="sm"
          aria-label="Parse FIX messages"
        >
          {isParsing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Parse
        </Button>
        {onParseFile !== undefined && (
          <>
            <input
              type="file"
              ref={fileInputRef}
              accept=".log,.txt,.fix,text/plain,*/*"
              className="hidden"
              onChange={handleFileChange}
              aria-label="Select a FIX log file"
            />
            <Button
              variant="outline"
              size="sm"
              disabled={isParsing}
              onClick={() => { fileInputRef.current?.click(); }}
              aria-label="Open a FIX log file"
            >
              <Upload className="mr-1 h-4 w-4" />
              Open file
            </Button>
          </>
        )}
        {text.length > 0 && (
          <Button variant="ghost" size="sm" onClick={handleClear} aria-label="Clear input and messages">
            <X className="mr-1 h-3 w-3" />
            Clear
          </Button>
        )}
        {parseState === 'ready' && (
          <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {messages.length} message{messages.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      {isParsing && parseProgress > 0 && parseProgress < 100 && (
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={parseProgress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Parse progress"
        >
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${String(parseProgress)}%` }}
          />
        </div>
      )}
    </div>
  );
}
