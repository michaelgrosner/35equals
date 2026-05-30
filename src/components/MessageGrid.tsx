import { useMessagesStore } from '@/state/messages';
import { cn } from '@/lib/utils';
import type { ParsedMessage } from '@/parser/types';

const COL_HEADERS = [
  { label: '#', key: 'index' },
  { label: 'Version (8)', key: 'beginString' },
  { label: 'MsgType (35)', key: 'msgType' },
  { label: 'Sender (49)', key: 'sender' },
  { label: 'Target (56)', key: 'target' },
  { label: 'SendingTime (52)', key: 'sendingTime' },
];

function getField(msg: ParsedMessage, tag: number): string {
  return msg.byTag.get(tag) ?? '';
}

export function MessageGrid() {
  const { messages, selectedIndex, setSelectedIndex } = useMessagesStore();

  if (messages.length === 0) return null;

  return (
    <div className="flex flex-col overflow-hidden">
      <div className="overflow-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="sticky top-0 z-10 bg-background border-b">
              {COL_HEADERS.map((col) => (
                <th
                  key={col.key}
                  className="px-3 py-1.5 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {messages.map((msg) => {
              const isSelected = selectedIndex === msg.index;
              return (
                <tr
                  key={msg.index}
                  onClick={() => { setSelectedIndex(isSelected ? null : msg.index); }}
                  className={cn(
                    'cursor-pointer border-b transition-colors',
                    isSelected
                      ? 'bg-primary/10 hover:bg-primary/15'
                      : 'hover:bg-muted/50'
                  )}
                >
                  <td className="px-3 py-1 font-mono text-xs text-muted-foreground">
                    {msg.index + 1}
                  </td>
                  <td className="px-3 py-1 font-mono text-xs">
                    {getField(msg, 8)}
                  </td>
                  <td className="px-3 py-1 text-xs">
                    <span className="font-medium">{msg.msgType ?? getField(msg, 35)}</span>
                  </td>
                  <td className="px-3 py-1 font-mono text-xs">
                    {getField(msg, 49)}
                  </td>
                  <td className="px-3 py-1 font-mono text-xs">
                    {getField(msg, 56)}
                  </td>
                  <td className="px-3 py-1 font-mono text-xs text-muted-foreground">
                    {getField(msg, 52)}
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
