import { useState, useEffect, useCallback } from 'react';
import { Copy, Check, AlertTriangle, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMessagesStore } from '@/state/messages';
import { cn } from '@/lib/utils';
import type { FixVersion, ParsedField } from '@/parser/types';
import { formatValue, type Tone } from '@/lib/format';

interface DetailPanelProps {
  onGetDetail: (rawText: string, version: FixVersion) => Promise<ParsedField[]>;
}

function versionBadgeClass(version: FixVersion): string {
  if (version.startsWith('FIX.4')) return 'bg-tone-sky/15 text-tone-sky';
  if (version.startsWith('FIX.5') || version.startsWith('FIXT')) return 'bg-tone-teal/15 text-tone-teal';
  return 'bg-tone-amber/15 text-tone-amber';
}

const CHIP_BASE = 'inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase';
const CHIP_DEFAULT = `${CHIP_BASE} bg-secondary text-secondary-foreground`;

const TONE_CHIP: Record<string, string> = {
  rose:    `${CHIP_BASE} bg-tone-rose/15 text-tone-rose`,
  emerald: `${CHIP_BASE} bg-tone-emerald/15 text-tone-emerald`,
  amber:   `${CHIP_BASE} bg-tone-amber/15 text-tone-amber`,
  sky:     `${CHIP_BASE} bg-tone-sky/15 text-tone-sky`,
  indigo:  `${CHIP_BASE} bg-tone-indigo/15 text-tone-indigo`,
  violet:  `${CHIP_BASE} bg-tone-violet/15 text-tone-violet`,
  teal:    `${CHIP_BASE} bg-tone-teal/15 text-tone-teal`,
  slate:   `${CHIP_BASE} bg-tone-slate/15 text-tone-slate`,
  neutral: `${CHIP_BASE} bg-tone-neutral/15 text-tone-neutral`,
  muted:   `${CHIP_BASE} bg-tone-muted/15 text-tone-muted`,
  peach:   `${CHIP_BASE} bg-tone-peach/15 text-tone-peach`,
  pink:    `${CHIP_BASE} bg-tone-pink/15 text-tone-pink`,
};

const TONE_TEXT: Record<string, string> = {
  rose: 'text-tone-rose', emerald: 'text-tone-emerald', amber: 'text-tone-amber',
  sky: 'text-tone-sky', indigo: 'text-tone-indigo', violet: 'text-tone-violet',
  teal: 'text-tone-teal', slate: 'text-tone-slate', neutral: 'text-tone-neutral',
  muted: 'text-tone-muted', peach: 'text-tone-peach', pink: 'text-tone-pink',
};

function getToneClass(tone: Tone | undefined, isChip: boolean): string {
  if (!tone) return isChip ? CHIP_DEFAULT : '';
  return isChip ? (TONE_CHIP[tone] ?? CHIP_DEFAULT) : (TONE_TEXT[tone] ?? '');
}

export function DetailPanel({ onGetDetail }: DetailPanelProps) {
  const { messages, selectedIndex } = useMessagesStore();

  const msg =
    selectedIndex !== null ? (messages[selectedIndex] ?? null) : null;

  const [fields, setFields] = useState<ParsedField[]>([]);
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [warningsOpen, setWarningsOpen] = useState(false);

  useEffect(() => {
    if (msg === null) {
      setFields([]);
      return;
    }
    setFieldsLoading(true);
    void onGetDetail(msg.rawText, msg.version).then((f) => {
      setFields(f);
      setFieldsLoading(false);
    });
  }, [msg, onGetDetail]);

  // Reset copy/warnings state when message changes
  useEffect(() => {
    setCopied(false);
  }, [selectedIndex]);

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

  if (msg === null) return null;

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
        <span className={cn('text-sm font-semibold', getToneClass(formatValue(35, msgTypeCode).tone, true))}>
          {msgTypeDisplay}
        </span>

        {/* Warning count badge */}
        {hasWarnings && (
          <button
            onClick={() => { setWarningsOpen((o) => !o); }}
            className="flex items-center gap-1 rounded bg-tone-amber/15 px-1.5 py-0.5 text-xs font-medium text-tone-amber hover:bg-tone-amber/25 transition-colors"
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
        <div className="border-b bg-tone-amber/5 px-4 py-2 flex-shrink-0 space-y-1">
          {msg.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-tone-amber">
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
        {fieldsLoading ? (
          <div className="flex h-20 items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
        <table className="w-full border-collapse text-xs" role="table">
          <thead>
            <tr className="sticky top-0 bg-background border-b z-10">
              <th className="px-3 py-1.5 text-left font-semibold text-muted-foreground w-14">Tag</th>
              <th className="px-3 py-1.5 text-left font-semibold text-muted-foreground w-40">Name</th>
              <th className="px-3 py-1.5 text-left font-semibold text-muted-foreground">Value</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field, i) => {
              const isUnknown = field.name === undefined;
              const isEven = i % 2 === 0;

              const formatted = formatValue(
                field.tag,
                field.rawValue,
                field.type,
                field.enumLabel
              );

              const showRawUnderneath =
                formatted.text !== field.rawValue;

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
                    {isUnknown ? (
                      <span className="italic text-muted-foreground">unknown</span>
                    ) : (
                      field.name
                    )}
                  </td>
                  <td className="px-3 py-1.5 font-mono break-all" title={formatted.title ?? field.rawValue}>
                    <div className="flex flex-wrap items-baseline gap-2">
                      <div className={cn(getToneClass(formatted.tone, !!formatted.isChip))}>
                        {formatted.rendered ?? formatted.text}
                      </div>
                      {showRawUnderneath && (
                        <div className="text-[10px] text-muted-foreground opacity-70">
                          {field.rawValue}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        )}
      </div>
    </div>
  );
}
