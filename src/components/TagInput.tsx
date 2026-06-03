import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";

// Common FIX tags for typeahead
const COMMON_TAGS: Record<string, string> = {
  "8": "BeginString",
  "9": "BodyLength",
  "35": "MsgType",
  "49": "SenderCompID",
  "56": "TargetCompID",
  "34": "MsgSeqNum",
  "52": "SendingTime",
  "11": "ClOrdID",
  "37": "OrderID",
  "17": "ExecID",
  "55": "Symbol",
  "54": "Side",
  "38": "OrderQty",
  "44": "Price",
  "40": "OrdType",
  "59": "TimeInForce",
  "39": "OrdStatus",
  "150": "ExecType",
  "6": "AvgPx",
  "14": "CumQty",
  "151": "LeavesQty",
  "58": "Text",
  "10": "CheckSum",
};

interface Props {
  value: number;
  onChange: (tag: number) => void;
  className?: string;
}

export function TagInput({ value, onChange, className }: Props) {
  // Local state for the text being typed (could be "MsgType" or "35")
  const tagName = COMMON_TAGS[String(value)];
  const initialText = tagName
    ? `${tagName} ${String(value)}`
    : String(value);
    
  const [text, setText] = useState(initialText);

  const options = useMemo(() => {
    return Object.entries(COMMON_TAGS).map(([tag, name]) => ({
      tag: parseInt(tag, 10),
      name,
      label: `${name} ${tag}`
    }));
  }, []);

  const handleBlur = () => {
    // Try to resolve the text to a tag number
    // 1. Check if it's a known label "Name Number"
    const match = text.match(/(\d+)$/);
    if (match && match[1]) {
      const tag = parseInt(match[1], 10);
      onChange(tag);
      return;
    }
    
    // 2. Check if it's just a number
    const num = parseInt(text, 10);
    if (!isNaN(num)) {
      onChange(num);
      return;
    }

    // 3. Check if it's a name
    const found = options.find(o => o.name.toLowerCase() === text.toLowerCase());
    if (found) {
      onChange(found.tag);
      setText(`${found.name} ${String(found.tag)}`);
    }
  };

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setText(val);
    
    // Auto-resolve if user picked from datalist
    const found = options.find(o => o.label === val);
    if (found) {
      onChange(found.tag);
    }
  };

  return (
    <div className={className}>
      <Input
        list="fix-tags"
        value={text}
        onChange={handleSelect}
        onBlur={handleBlur}
        placeholder="Tag / Name"
        className="h-7 w-full text-xs font-mono"
      />
      <datalist id="fix-tags">
        {options.map(o => (
          <option key={o.tag} value={o.label} />
        ))}
      </datalist>
    </div>
  );
}
