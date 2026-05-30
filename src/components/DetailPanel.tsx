import { useState, useEffect, useCallback } from 'react';
import { Copy, Check, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMessagesStore } from '@/state/messages';
import { cn } from '@/lib/utils';
import type { FixVersion } from '@/parser/types';

function versionBadgeClass(version: FixVersion): string {
  if (version.startsWith('FIX.4')) return 'bg-blue-500/15 text-blue-600 dark:text-blue-400';
  if (version.startsWith('FIX.5') || version.startsWith('FIXT')) {
    return 'bg-green-500/15 text-green-600 dark:text-green-400';
  }
  return 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400';
}

export function DetailPanel() {
  const { messages, selectedIndex } = useMessagesStore();

  const msg =
    selectedIndex !== null ? (messages[selectedIndex] ?? null) : null;

  const [copied, setCopied] = useState(false);
  const [warningsOpen, setWarningsOpen] = useState(false);

  // Reset copy state when message changes
  useEffect(() => {
    setCopied(false);
  }, [selectedIndex]);

  // Reset warnings open state when message changes
  useEffect(() => {
    setWarningsOpen(false);
  }, [selectedIndex]);

  const handleCopy = useCallback(() => {
    if (msg === null) return;
    void navigator.clipboard.writeText(msg.rawText).then(() => {
      setCopied(true);
      const timer = setTimeout(() => { setCopied(false); }, 2000);
      return () => { clearTimeout(timer); };
    });
  }, [msg]);

  if (msg === null) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground p-6">
        Select a message from the grid
      </div>
    );
  }

  // Extract msgType code for display (tag 35 raw value)
  const msgTypeCode = msg.byTag.get(35) ?? '';
  const msgTypeDisplay = msg.msgType !== undefined
    ? `${msg.msgType}${msgTypeCode.length > 0 ? ` (${msgTypeCode})` : ''}`
    : (msgTypeCode.length > 0 ? msgTypeCode : '—');

  const hasWarnings = msg.warnings.length > 0;

  return (
    <div className="flex flex-col overflow-hidden h-full">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2 flex-shrink-0">
        {/* Version badge */}
        <span
          className={cn(
            'rounded px-1.5 py-0.5 font-mono text-xs font-medium',
            versionBadgeClass(msg.version)
          )}
        >
          {msg.version}
        </span>

        {/* MsgType name + code */}
        <span className="text-sm font-semibold">{msgTypeDisplay}</span>

        {/* Warning count badge */}
        {hasWarnings && (
          <button
            onClick={() => { setWarningsOpen((o) => !o); }}
            className="flex items-center gap-1 rounded bg-orange-500/15 px-1.5 py-0.5 text-xs font-medium text-orange-600 dark:text-orange-400 hover:bg-orange-500/25 transition-colors"
            aria-label={`${String(msg.warnings.length)} warning${msg.warnings.length !== 1 ? 's' : ''} — click to ${warningsOpen ? 'collapse' : 'expand'}`}
            aria-expanded={warningsOpen}
          >
            <AlertTriangle className="h-3 w-3" />
            {msg.warnings.length} warning{msg.warnings.length !== 1 ? 's' : ''}
            {warningsOpen
              ? <ChevronDown className="h-3 w-3" />
              : <ChevronRight className="h-3 w-3" />}
          </button>
        )}

        {/* Copy raw button */}
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={handleCopy}
          aria-label="Copy raw FIX message to clipboard"
          title="Copy raw FIX message to clipboard"
        >
          {copied
            ? <Check className="h-3.5 w-3.5 text-green-500" />
            : <Copy className="h-3.5 w-3.5" />}
          <span className="ml-1 text-xs">
            {copied ? 'Copied!' : 'Copy raw'}
          </span>
        </Button>
      </div>

      {/* Collapsible warnings section */}
      {hasWarnings && warningsOpen && (
        <div className="border-b bg-orange-500/5 px-4 py-2 flex-shrink-0 space-y-1">
          {msg.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-orange-600 dark:text-orange-400">
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
        <table className="w-full border-collapse text-xs" role="table">
          <thead>
            <tr className="sticky top-0 bg-background border-b z-10">
              <th className="px-3 py-1.5 text-left font-semibold text-muted-foreground w-14">Tag</th>
              <th className="px-3 py-1.5 text-left font-semibold text-muted-foreground w-40">Name</th>
              <th className="px-3 py-1.5 text-left font-semibold text-muted-foreground">Value</th>
              <th className="px-3 py-1.5 text-left font-semibold text-muted-foreground">Description</th>
            </tr>
          </thead>
          <tbody>
            {msg.fields.map((field, i) => {
              const isUnknown = field.name === undefined;
              const isEven = i % 2 === 0;

              // For tag 35 (MsgType), combine rawValue and enumLabel
              const valueDisplay =
                field.tag === 35 && field.enumLabel !== undefined
                  ? `${field.rawValue} — ${field.enumLabel}`
                  : field.rawValue;

              const descriptionDisplay =
                field.tag !== 35 ? (field.enumLabel ?? field.description ?? '') : '';

              return (
                <tr
                  key={i}
                  role="row"
                  className={cn(
                    'border-b align-top',
                    isUnknown
                      ? 'bg-yellow-500/10 hover:bg-yellow-500/15'
                      : isEven
                        ? 'hover:bg-muted/30'
                        : 'bg-muted/15 hover:bg-muted/30'
                  )}
                >
                  <td className="px-3 py-1.5 font-mono text-muted-foreground">
                    {field.tag}
                  </td>
                  <td className="px-3 py-1.5">
                    {isUnknown
                      ? <span className="italic text-muted-foreground">unknown</span>
                      : field.name}
                  </td>
                  <td className="px-3 py-1.5 font-mono text-primary break-all">
                    {valueDisplay}
                  </td>
                  <td className="px-3 py-1.5 italic text-muted-foreground">
                    {descriptionDisplay}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
