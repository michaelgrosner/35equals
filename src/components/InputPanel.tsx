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

function generateSamples(): string {
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)] as T;
  const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
  const randId = (prefix: string) => `${prefix}${String(randInt(1000, 9999))}`;

  const UNDERLYINGS = ['AAPL', 'MSFT', 'SPY', 'QQQ', 'TSLA', 'NVDA'] as const;
  const SENDERS = ['CLIENT1', 'CLIENT2', 'ALGOFUND'] as const;
  const BROKERS = ['BROKER1', 'BROKER2', 'EXECBROKER'] as const;

  const sender = pick(SENDERS);
  const broker = pick(BROKERS);
  const und = pick(UNDERLYINGS);

  const BASE_PRICES: Record<string, number> = { AAPL: 185, MSFT: 375, SPY: 475, QQQ: 415, TSLA: 250, NVDA: 620 };
  const base = BASE_PRICES[und] ?? 200;
  const atm = Math.round(base / 5) * 5;
  const width = pick([5, 10, 15] as const);

  const EXPIRIES = ['202403', '202406', '202409', '202412'] as const;
  const expiry = pick(EXPIRIES);

  type Strategy = 'call_spread' | 'put_spread' | 'straddle' | 'strangle';
  const strategy = pick<Strategy>(['call_spread', 'put_spread', 'straddle', 'strangle']);

  interface Leg { cfi: string; strike: number; side: '1' | '2'; qty: number; price: number; }
  const legQty = randInt(1, 10) * 5;

  function legPrice(moneyness: number): string {
    return (base * moneyness + randInt(0, 50) * 0.01).toFixed(2);
  }

  let legs: Leg[];
  if (strategy === 'call_spread') {
    legs = [
      { cfi: 'OCAXXX', strike: atm, side: '1', qty: legQty, price: parseFloat(legPrice(0.03)) },
      { cfi: 'OCAXXX', strike: atm + width, side: '2', qty: legQty, price: parseFloat(legPrice(0.015)) },
    ];
  } else if (strategy === 'put_spread') {
    legs = [
      { cfi: 'OPAXXX', strike: atm, side: '1', qty: legQty, price: parseFloat(legPrice(0.03)) },
      { cfi: 'OPAXXX', strike: atm - width, side: '2', qty: legQty, price: parseFloat(legPrice(0.015)) },
    ];
  } else if (strategy === 'straddle') {
    legs = [
      { cfi: 'OCAXXX', strike: atm, side: '1', qty: legQty, price: parseFloat(legPrice(0.03)) },
      { cfi: 'OPAXXX', strike: atm, side: '1', qty: legQty, price: parseFloat(legPrice(0.03)) },
    ];
  } else {
    legs = [
      { cfi: 'OCAXXX', strike: atm + width, side: '1', qty: legQty, price: parseFloat(legPrice(0.02)) },
      { cfi: 'OPAXXX', strike: atm - width, side: '1', qty: legQty, price: parseFloat(legPrice(0.02)) },
    ];
  }

  const now = new Date();
  const ts = (offsetMs = 0): string => {
    const d = new Date(now.getTime() - 120000 + offsetMs);
    const pad = (n: number, w = 2) => String(n).padStart(w, '0');
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}.${pad(d.getUTCMilliseconds(), 3)}`;
  };

  const legFields = legs
    .map((l, i) =>
      `600=${und}|608=${l.cfi}|609=${expiry}|612=${l.strike.toFixed(2)}|687=${l.qty}|624=${l.side}|566=${l.price.toFixed(2)}|654=LEG${String(i + 1).padStart(3, '0')}|`
    )
    .join('');

  const leg0 = legs[0]!;
  const leg1 = legs[1]!;

  const mlClOrdId = randId('ML');
  const mlOrdId = randId('MORD');
  const sngClOrdId = randId('SNG');
  const sngOrdId = randId('SORD');
  const sngSym = pick((['AAPL', 'MSFT', 'SPY', 'NVDA'] as const).filter(s => s !== und));
  const sngSide = pick(['1', '2'] as const);
  const sngQty = randInt(100, 500);
  const sngPrice = (BASE_PRICES[sngSym] ?? 200) + (Math.random() - 0.5) * 4;
  const netPremium = Math.abs(leg0.price - leg1.price).toFixed(2);

  let seq = 1;
  const msgs: string[] = [];

  // 1. NewOrderMultileg (AB)
  msgs.push(fixMsg(
    `8=FIX.4.4|9=250|35=AB|49=${sender}|56=${broker}|34=${seq++}|52=${ts(0)}|` +
    `1=ACCT001|11=${mlClOrdId}|55=${und}|54=${leg0.side}|38=${legQty}|40=2|59=0|` +
    `555=${legs.length}|${legFields}`
  ));

  // 2. ExecutionReport — Pending New
  msgs.push(fixMsg(
    `8=FIX.4.4|9=220|35=8|49=${broker}|56=${sender}|34=${seq++}|52=${ts(randInt(50, 200))}|` +
    `11=${mlClOrdId}|37=${mlOrdId}|17=${randId('EX')}|55=${und}|54=${leg0.side}|38=${legQty}|` +
    `14=0|151=${legQty}|39=A|150=A|6=0.00|555=${legs.length}|${legFields}`
  ));

  // 3. ExecutionReport — New
  msgs.push(fixMsg(
    `8=FIX.4.4|9=220|35=8|49=${broker}|56=${sender}|34=${seq++}|52=${ts(randInt(200, 500))}|` +
    `11=${mlClOrdId}|37=${mlOrdId}|17=${randId('EX')}|55=${und}|54=${leg0.side}|38=${legQty}|` +
    `14=0|151=${legQty}|39=0|150=0|6=0.00|555=${legs.length}|${legFields}`
  ));

  // 4. ExecutionReport — Filled
  msgs.push(fixMsg(
    `8=FIX.4.4|9=240|35=8|49=${broker}|56=${sender}|34=${seq++}|52=${ts(randInt(500, 1500))}|` +
    `11=${mlClOrdId}|37=${mlOrdId}|17=${randId('EX')}|55=${und}|54=${leg0.side}|38=${legQty}|` +
    `32=${legQty}|31=${netPremium}|14=${legQty}|151=0|39=2|150=F|6=${netPremium}|555=${legs.length}|${legFields}`
  ));

  // 5. NewOrderSingle — equity hedge
  msgs.push(fixMsg(
    `8=FIX.4.4|9=148|35=D|49=${sender}|56=${broker}|34=${seq++}|52=${ts(randInt(1500, 2500))}|` +
    `11=${sngClOrdId}|55=${sngSym}|54=${sngSide}|38=${sngQty}|44=${sngPrice.toFixed(2)}|40=2|59=0|`
  ));

  // 6. ExecutionReport — New for equity
  msgs.push(fixMsg(
    `8=FIX.4.4|9=195|35=8|49=${broker}|56=${sender}|34=${seq++}|52=${ts(randInt(2500, 3500))}|` +
    `11=${sngClOrdId}|37=${sngOrdId}|17=${randId('EX')}|55=${sngSym}|54=${sngSide}|38=${sngQty}|` +
    `44=${sngPrice.toFixed(2)}|14=0|151=${sngQty}|39=0|150=0|6=0.00|`
  ));

  // 7. ExecutionReport — Filled for equity
  msgs.push(fixMsg(
    `8=FIX.4.4|9=210|35=8|49=${broker}|56=${sender}|34=${seq++}|52=${ts(randInt(3500, 5000))}|` +
    `11=${sngClOrdId}|37=${sngOrdId}|17=${randId('EX')}|55=${sngSym}|54=${sngSide}|38=${sngQty}|` +
    `32=${sngQty}|31=${sngPrice.toFixed(2)}|14=${sngQty}|151=0|39=2|150=F|6=${sngPrice.toFixed(2)}|`
  ));

  return msgs.join('\n');
}

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
    <div className={fillHeight ? 'flex flex-1 flex-col gap-3 px-6 py-4' : 'flex w-full max-w-2xl flex-col gap-3'}>
      <div className={fillHeight ? 'flex flex-1 flex-col gap-3 w-full' : 'contents'}>
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
          onClick={() => { setText(generateSamples()); }}
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
