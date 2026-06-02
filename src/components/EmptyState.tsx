import { FileText } from 'lucide-react';

const EXAMPLE_FIX =
  '8=FIX.4.2|9=150|35=D|49=CLIENT1|56=BROKER1|34=1|52=20240115-09:30:00.000|11=ORD00000001|55=AAPL|54=1|38=100|44=150.00|40=2|59=0|10=247|\n' +
  '8=FIX.4.2|9=200|35=8|49=BROKER1|56=CLIENT1|34=2|52=20240115-09:30:00.234|11=ORD00000001|37=ORD00000001|17=EXEC00000001|55=AAPL|54=1|38=100|44=150.00|14=100|151=0|39=2|150=2|6=150.00|10=181|';

export function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
        <FileText className="h-10 w-10 text-muted-foreground" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">35equals</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Paste FIX messages below or drop a log file anywhere
        </p>
      </div>

      <div className="w-full max-w-xl rounded-md border bg-muted/60 p-3 text-left">
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">Example</p>
        <code className="block whitespace-pre-wrap break-all font-mono text-xs leading-relaxed text-foreground">
          {EXAMPLE_FIX}
        </code>
      </div>

      <p className="text-xs text-muted-foreground/70">
        All parsing happens in your browser — nothing is uploaded
      </p>
    </div>
  );
}
