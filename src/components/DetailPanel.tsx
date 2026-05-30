import { useCallback } from 'react';
import { Copy, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMessagesStore } from '@/state/messages';
import { cn } from '@/lib/utils';

export function DetailPanel() {
  const { messages, selectedIndex } = useMessagesStore();

  const msg =
    selectedIndex !== null ? messages[selectedIndex] ?? null : null;

  const handleCopy = useCallback(() => {
    if (msg === null) return;
    void navigator.clipboard.writeText(msg.rawText);
  }, [msg]);

  if (msg === null) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground p-6">
        Select a message to inspect its fields.
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-hidden h-full">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-2 flex-shrink-0">
        <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-xs text-primary">
          {msg.version}
        </span>
        {msg.msgType !== undefined && (
          <span className="text-sm font-semibold">{msg.msgType}</span>
        )}
        {msg.warnings.length > 0 && (
          <span className="ml-auto flex items-center gap-1 rounded bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive">
            <AlertTriangle className="h-3 w-3" />
            {msg.warnings.length} warning{msg.warnings.length !== 1 ? 's' : ''}
          </span>
        )}
        <Button
          variant="ghost"
          size="sm"
          className={cn(msg.warnings.length === 0 && 'ml-auto')}
          onClick={handleCopy}
          title="Copy raw FIX message"
        >
          <Copy className="h-3.5 w-3.5" />
          <span className="ml-1 text-xs">Copy raw</span>
        </Button>
      </div>

      {/* Warnings */}
      {msg.warnings.length > 0 && (
        <div className="border-b bg-destructive/5 px-4 py-2 flex-shrink-0">
          {msg.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" />
              <span>
                <span className="font-semibold">{w.type}:</span> {w.detail}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Fields table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="sticky top-0 bg-background border-b">
              <th className="px-3 py-1.5 text-left font-semibold text-muted-foreground w-14">Tag</th>
              <th className="px-3 py-1.5 text-left font-semibold text-muted-foreground w-40">Name</th>
              <th className="px-3 py-1.5 text-left font-semibold text-muted-foreground w-28">Type</th>
              <th className="px-3 py-1.5 text-left font-semibold text-muted-foreground">Value</th>
            </tr>
          </thead>
          <tbody>
            {msg.fields.map((field, i) => (
              <tr key={i} className="border-b hover:bg-muted/30 align-top">
                <td className="px-3 py-1.5 font-mono text-muted-foreground">
                  {field.tag}
                </td>
                <td className="px-3 py-1.5 font-medium">
                  {field.name ?? <span className="text-muted-foreground italic">unknown</span>}
                </td>
                <td className="px-3 py-1.5 text-muted-foreground">
                  {field.type ?? '—'}
                </td>
                <td className="px-3 py-1.5">
                  <div className="font-mono">{field.rawValue}</div>
                  {field.enumLabel !== undefined && (
                    <div className="mt-0.5 text-muted-foreground">
                      {field.enumLabel}
                    </div>
                  )}
                  {field.description !== undefined && (
                    <div className="mt-0.5 text-muted-foreground italic">
                      {field.description}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
