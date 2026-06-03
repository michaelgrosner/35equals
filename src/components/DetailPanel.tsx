import React, { useState, useEffect, useCallback } from 'react';
import { Copy, Check, AlertTriangle, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMessagesStore } from '@/state/messages';
import { cn } from '@/lib/utils';
import type { FixVersion, ParsedField } from '@/parser/types';
import { formatValue, type Tone } from '@/lib/format';

interface DetailPanelProps {
  onGetDetail: (rawText: string, version: FixVersion) => Promise<ParsedField[]>;
}

// NUMINGROUP tag → delimiter tag (first tag of each instance)
const GROUP_DELIMITERS: Record<number, number> = {
  555: 600,   // NoLegs → LegSymbol
  268: 269,   // NoMDEntries → MDEntryType
  146: 55,    // NoRelatedSym → Symbol
  453: 448,   // NoPartyIDs → PartyID
  454: 455,   // NoSecurityAltID → SecurityAltID
  232: 233,   // NoStipulations → StipulationType
  78: 79,     // NoAllocs → AllocAccount
  73: 11,     // NoOrders → ClOrdID
  386: 336,   // NoTradingSessions → TradingSessionID
  711: 311,   // NoUnderlyings → UnderlyingSymbol
  457: 458,   // NoUnderlyingSecurityAltID → UnderlyingSecurityAltID
};

type FlatItem = { kind: 'field'; field: ParsedField };
type GroupItem = { kind: 'group'; countField: ParsedField; instances: ParsedField[][] };
type RenderedItem = FlatItem | GroupItem;

function groupFields(fields: ParsedField[]): RenderedItem[] {
  const result: RenderedItem[] = [];
  let i = 0;
  while (i < fields.length) {
    const field = fields[i];
    if (field === undefined) { i++; continue; }
    const delimTag = GROUP_DELIMITERS[field.tag];
    if (delimTag !== undefined && field.type === 'NUMINGROUP') {
      const count = parseInt(field.rawValue, 10);
      if (!isNaN(count) && count > 0 && fields[i + 1]?.tag === delimTag) {
        const instances: ParsedField[][] = [];
        let current: ParsedField[] | null = null;
        let j = i + 1;
        while (j < fields.length) {
          const f = fields[j];
          if (f === undefined) break;
          // Checksum always terminates a group
          if (f.tag === 10) { if (current) instances.push(current); current = null; break; }
          if (f.tag === delimTag) {
            if (current) {
              instances.push(current);
              if (instances.length >= count) { current = null; break; }
            }
            current = [f];
          } else if (current) {
            current.push(f);
          } else {
            break;
          }
          j++;
        }
        if (current) instances.push(current);
        result.push({ kind: 'group', countField: field, instances });
        i = j;
        continue;
      }
    }
    result.push({ kind: 'field', field });
    i++;
  }
  return result;
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
  const [collapsedInstances, setCollapsedInstances] = useState<Set<string>>(new Set());
  const toggleInstance = useCallback((key: string) => {
    setCollapsedInstances(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

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
    setCollapsedInstances(new Set());
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
      <div
        id="detail-scroll"
        tabIndex={-1}
        className="flex-1 overflow-auto focus:outline-none"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            document.getElementById('grid-scroll')?.focus();
          }
        }}
      >
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
            {(() => {
              const items = groupFields(fields);
              const rows: React.JSX.Element[] = [];
              let flatIdx = 0;

              function renderFieldRow(field: ParsedField, isEven: boolean, key: string, indent = false) {
                const isUnknown = field.name === undefined;
                const formatted = formatValue(field.tag, field.rawValue, field.type, field.enumLabel);
                const showRaw = formatted.text !== field.rawValue;
                return (
                  <tr key={key} role="row" className={cn('border-b align-top', isUnknown ? 'bg-yellow-500/10 hover:bg-yellow-500/15' : isEven ? 'hover:bg-muted/30' : 'bg-muted/15 hover:bg-muted/30')}>
                    <td className={cn('py-1.5 font-mono text-muted-foreground', indent ? 'pl-6 pr-3' : 'px-3')}>{field.tag}</td>
                    <td className="px-3 py-1.5">{isUnknown ? <span className="italic text-muted-foreground">unknown</span> : field.name}</td>
                    <td className="px-3 py-1.5 font-mono break-all" title={formatted.title ?? field.rawValue}>
                      <div className="flex flex-wrap items-baseline gap-2">
                        <div className={cn(getToneClass(formatted.tone, !!formatted.isChip))}>{formatted.rendered ?? formatted.text}</div>
                        {showRaw && <div className="text-[10px] text-muted-foreground opacity-70">{field.rawValue}</div>}
                      </div>
                    </td>
                  </tr>
                );
              }

              for (const item of items) {
                if (item.kind === 'field') {
                  rows.push(renderFieldRow(item.field, flatIdx % 2 === 0, `f-${String(flatIdx)}`));
                  flatIdx++;
                } else {
                  const { countField, instances } = item;
                  const groupKey = String(countField.tag);
                  const allCollapsed = instances.every((_, i) => collapsedInstances.has(`${groupKey}-${String(i)}`));

                  // NUMINGROUP header row
                  rows.push(
                    <tr key={`g-${groupKey}`} className="border-b bg-muted/50">
                      <td className="px-3 py-1 font-mono text-muted-foreground text-[11px]">{countField.tag}</td>
                      <td className="px-3 py-1 font-semibold">{countField.name ?? 'Group'}</td>
                      <td className="px-3 py-1">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{instances.length} instance{instances.length !== 1 ? 's' : ''}</span>
                          <button
                            className="text-[10px] text-muted-foreground/70 hover:text-foreground transition-colors underline-offset-2 hover:underline"
                            onClick={() => {
                              setCollapsedInstances(prev => {
                                const next = new Set(prev);
                                instances.forEach((_, i) => {
                                  const k = `${groupKey}-${String(i)}`;
                                  if (allCollapsed) next.delete(k); else next.add(k);
                                });
                                return next;
                              });
                            }}
                          >
                            {allCollapsed ? 'expand all' : 'collapse all'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );

                  // Instance rows
                  for (let instIdx = 0; instIdx < instances.length; instIdx++) {
                    const instKey = `${groupKey}-${String(instIdx)}`;
                    const isCollapsed = collapsedInstances.has(instKey);
                    const instance = instances[instIdx];
                    if (instance === undefined) continue;

                    rows.push(
                      <tr key={`gi-${instKey}`} className="border-b bg-muted/25">
                        <td colSpan={3} className="border-l-2 border-l-muted-foreground/30">
                          <button
                            className="flex w-full items-center gap-1.5 px-3 py-1 text-left text-muted-foreground hover:text-foreground transition-colors"
                            onClick={() => { toggleInstance(instKey); }}
                          >
                            {isCollapsed
                              ? <ChevronRight className="h-3 w-3 flex-shrink-0" />
                              : <ChevronDown className="h-3 w-3 flex-shrink-0" />}
                            <span className="text-[11px] font-medium">
                              {countField.name ? countField.name.replace(/^No/, '') : 'Instance'} {instIdx + 1} of {instances.length}
                            </span>
                          </button>
                        </td>
                      </tr>
                    );

                    if (!isCollapsed) {
                      instance.forEach((field, fieldIdx) => {
                        rows.push(renderFieldRow(field, fieldIdx % 2 === 0, `gf-${instKey}-${String(fieldIdx)}`, true));
                      });
                    }
                  }
                }
              }
              return rows;
            })()}
          </tbody>
        </table>
        )}
      </div>
    </div>
  );
}
