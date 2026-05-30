import { Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useSettingsStore } from '@/state/settings';
import { DEFAULT_VISIBLE_TAGS } from '@/lib/columns';

const TAG_NAMES: Record<number, string> = {
  8: 'BeginString',
  35: 'MsgType',
  49: 'SenderCompID',
  56: 'TargetCompID',
  52: 'SendingTime',
  34: 'MsgSeqNum',
  11: 'ClOrdID',
  37: 'OrderID',
  17: 'ExecID',
  55: 'Symbol',
  54: 'Side',
  38: 'OrderQty',
  44: 'Price',
  40: 'OrdType',
  59: 'TimeInForce',
  39: 'OrdStatus',
  150: 'ExecType',
  6: 'AvgPx',
  14: 'CumQty',
  151: 'LeavesQty',
};

export function ColumnSettings() {
  const { columns, setColumnVisible, resetColumns } = useSettingsStore();

  // Build a lookup for current visibility from the store
  const visibilityMap = new Map(columns.map((c) => [c.tag, c.visible]));

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          title="Column settings"
        >
          <Settings2 className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Columns
          </span>
          <button
            onClick={resetColumns}
            className="text-xs text-primary hover:underline"
          >
            Reset to defaults
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto space-y-1">
          {DEFAULT_VISIBLE_TAGS.map((tag) => {
            const name = TAG_NAMES[tag] ?? `Tag${String(tag)}`;
            const visible = visibilityMap.get(tag) ?? true;
            return (
              <label
                key={tag}
                className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-muted"
              >
                <input
                  type="checkbox"
                  checked={visible}
                  onChange={(e) => {
                    setColumnVisible(tag, e.target.checked);
                  }}
                  className="h-3.5 w-3.5 accent-primary"
                />
                <span className="font-mono text-xs text-muted-foreground w-8 shrink-0">
                  {tag}
                </span>
                <span className="truncate">{name}</span>
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
