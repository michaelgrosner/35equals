import { useRef, useCallback, useState } from 'react';
import { Loader2, X, Upload, AlertCircle, FlaskConical, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMessagesStore } from '@/state/messages';

function fixChecksum(body: string): string {
  let sum = 0;
  for (let i = 0; i < body.length; i++) sum += body.charCodeAt(i);
  return String(sum & 0xff).padStart(3, '0');
}

function fixMsg(body: string): string {
  return `${body}10=${fixChecksum(body)}|`;
}

const SAMPLE_MESSAGES = [
  fixMsg('8=FIX.4.2|9=148|35=D|49=CLIENT1|56=BROKER1|34=1|52=20240115-09:30:00.000|11=ORD001|55=AAPL|54=1|38=100|44=185.50|40=2|59=0|'),
  fixMsg('8=FIX.4.2|9=195|35=8|49=BROKER1|56=CLIENT1|34=2|52=20240115-09:30:00.121|11=ORD001|37=BORD001|17=EXEC001|55=AAPL|54=1|38=100|44=185.50|14=0|151=100|39=0|150=0|6=0.00|'),
  fixMsg('8=FIX.4.2|9=215|35=8|49=BROKER1|56=CLIENT1|34=3|52=20240115-09:30:01.543|11=ORD001|37=BORD001|17=EXEC002|55=AAPL|54=1|38=100|44=185.50|32=60|31=185.48|14=60|151=40|39=1|150=F|6=185.48|'),
  fixMsg('8=FIX.4.2|9=144|35=F|49=CLIENT1|56=BROKER1|34=4|52=20240115-09:30:02.000|11=ORD002|41=ORD001|37=BORD001|55=AAPL|54=1|38=40|'),
  fixMsg('8=FIX.4.2|9=210|35=8|49=BROKER1|56=CLIENT1|34=5|52=20240115-09:30:02.089|11=ORD002|41=ORD001|37=BORD001|17=EXEC003|55=AAPL|54=1|38=0|44=185.50|14=60|151=0|39=4|150=4|6=185.48|'),
].join('\n');

interface InputPanelProps {
  onParse: (text: string) => Promise<void>;
  onParseFile?: (file: File) => Promise<void>;
  /** When true, collapses to a thin strip showing message count + clear. */
  collapsed?: boolean;
  /** When true, textarea grows to fill available vertical space. */
  fillHeight?: boolean;
}

export function InputPanel({ onParse, onParseFile, collapsed = false, fillHeight = false }: InputPanelProps) {
  const [text, setText] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { parseState, parseProgress, errorMessage, messages, filename, clear } = useMessagesStore();

  const isParsing = parseState === 'parsing';
  const isError = parseState === 'error';

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value);
    },
    []
  );

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
        {filename !== null && (
          <span className="text-xs font-mono text-muted-foreground truncate max-w-xs" title={filename}>
            {filename}
          </span>
        )}
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

  const textareaClass = fillHeight
    ? 'flex-1 min-h-0 w-full resize-none rounded-md border bg-background px-3 py-2 font-mono text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50'
    : 'h-48 w-full resize-none rounded-md border bg-background px-3 py-2 font-mono text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50';

  return (
    <div className={fillHeight ? 'flex flex-1 flex-col gap-3 px-4 py-4' : 'flex w-full max-w-2xl flex-col gap-3'}>
      <div className={fillHeight ? 'mx-auto flex flex-1 flex-col gap-3 w-full max-w-2xl' : 'contents'}>
      <textarea
        className={textareaClass}
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
        <Button
          variant="ghost"
          size="sm"
          disabled={isParsing}
          onClick={() => { setText(SAMPLE_MESSAGES); }}
          aria-label="Load sample FIX messages"
        >
          <FlaskConical className="mr-1 h-3 w-3" />
          Samples
        </Button>
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
      {fillHeight && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
          <Lock className="h-3 w-3 flex-shrink-0" />
          All parsing happens locally in your browser — nothing is transmitted
        </p>
      )}
      </div>
    </div>
  );
}
