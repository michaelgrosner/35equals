import type { FilterTree, FilterRule, FilterGroup } from './types';
import type { ParsedMessage } from '../types';

// ---------------------------------------------------------------------------
// Timestamp helpers
// ---------------------------------------------------------------------------

/**
 * Parse a FIX UTCTIMESTAMP (YYYYMMDD-HH:MM:SS[.mmm[mmm]]) to epoch ms.
 * Returns null if the value doesn't match the format.
 */
function parseFIXTimestamp(raw: string): number | null {
  if (raw.length < 17 || raw.charCodeAt(8) !== 0x2d) return null; // '-' at index 8
  const iso = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T${raw.slice(9)}Z`;
  const ms = Date.parse(iso);
  return isNaN(ms) ? null : ms;
}

/**
 * Parse a user-supplied timestamp string in any common format to epoch ms.
 * Accepts ISO 8601, space-separated date+time, date-only, with or without Z.
 */
function parseUserTimestamp(value: string): number | null {
  let s = value.trim();
  // Replace space between date and time with T: "2024-01-15 09:33" → "2024-01-15T09:33"
  s = s.replace(/^(\d{4}-\d{2}-\d{2})\s+(\d)/, '$1T$2');
  // Append UTC marker if no timezone present
  if (!/[Zz]$|[+-]\d{2}:?\d{2}$/.test(s)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) s += 'T00:00:00';
    s += 'Z';
  }
  const ms = Date.parse(s);
  return isNaN(ms) ? null : ms;
}

export function evaluateFilterTree(
  tree: FilterTree | null,
  messages: ParsedMessage[],
  globalRegex?: string
): Uint32Array {
  const result: number[] = [];
  
  let regex: RegExp | null = null;
  if (globalRegex) {
    try {
      regex = new RegExp(globalRegex, 'i');
    } catch {
      // invalid regex, ignore global regex
    }
  }

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]!;
    
    if (regex && !regex.test(msg.rawText)) {
      continue;
    }
    
    if (tree && !evaluateNode(tree, msg)) {
      continue;
    }
    
    result.push(i);
  }

  return new Uint32Array(result);
}

function evaluateNode(node: FilterTree, msg: ParsedMessage): boolean {
  if (node.kind === 'group') {
    return evaluateGroup(node, msg);
  } else {
    return evaluateRule(node, msg);
  }
}

function evaluateGroup(group: FilterGroup, msg: ParsedMessage): boolean {
  if (group.children.length === 0) return true;
  
  if (group.combinator === 'AND') {
    for (const child of group.children) {
      if (!evaluateNode(child, msg)) return false;
    }
    return true;
  } else {
    for (const child of group.children) {
      if (evaluateNode(child, msg)) return true;
    }
    return false;
  }
}

function evaluateRule(rule: FilterRule, msg: ParsedMessage): boolean {
  // Incomplete rule — don't filter yet. "is empty" and "is set" need no value.
  const needsValue = rule.op !== 'is empty' && rule.op !== 'is set';
  const hasValue = Array.isArray(rule.value)
    ? rule.value.length > 0
    : rule.value !== '' && rule.value !== undefined && rule.value !== null;
  if (needsValue && !hasValue) return true;

  const rawValue = msg.byTag.get(rule.tag);

  if (rule.op === 'is empty') return rawValue === undefined || rawValue === '';
  if (rule.op === 'is set') return rawValue !== undefined && rawValue !== '';
  if (rule.op === 'not equals') return rawValue !== rule.value;
  
  if (rawValue === undefined) return false;
  
  switch (rule.op) {
    case 'contains':
      return rawValue.includes(rule.value as string);
    case 'equals':
    case '=':
      return rawValue === rule.value;
    case 'regex':
      try {
        return new RegExp(rule.value as string).test(rawValue);
      } catch {
        return false;
      }
    case '≠':
      return rawValue !== rule.value;
    case '>':
    case '≥':
    case '<':
    case '≤':
    case 'between':
    case 'before':
    case 'after': {
      // Prefer timestamp comparison when rawValue looks like a FIX UTCTIMESTAMP.
      const rawMs = parseFIXTimestamp(rawValue);
      if (rawMs !== null) {
        if (rule.op === 'between') {
          const limits = rule.value as string[];
          const lo = parseUserTimestamp(limits[0] ?? '');
          const hi = parseUserTimestamp(limits[1] ?? '');
          if (lo !== null && hi !== null) return rawMs >= lo && rawMs <= hi;
          return false;
        }
        const compMs = parseUserTimestamp(rule.value as string);
        if (compMs !== null) {
          if (rule.op === '>' || rule.op === 'after')  return rawMs > compMs;
          if (rule.op === '≥')                          return rawMs >= compMs;
          if (rule.op === '<' || rule.op === 'before')  return rawMs < compMs;
          if (rule.op === '≤')                          return rawMs <= compMs;
        }
        return false;
      }

      // Numeric / lexicographic fallback.
      if (rule.op === 'between') {
        const limits = rule.value as string[];
        if (limits.length !== 2) return false;
        const numVal = parseFloat(rawValue);
        if (isNaN(numVal)) return false;
        return numVal >= parseFloat(limits[0]!) && numVal <= parseFloat(limits[1]!);
      }
      const numVal = parseFloat(rawValue);
      const compStr = rule.value as string;
      if (isNaN(numVal)) {
        const cmp = rawValue.localeCompare(compStr);
        if (rule.op === '>' || rule.op === 'after')  return cmp > 0;
        if (rule.op === '≥')                          return cmp >= 0;
        if (rule.op === '<' || rule.op === 'before')  return cmp < 0;
        if (rule.op === '≤')                          return cmp <= 0;
        return false;
      }
      const compVal = parseFloat(compStr);
      if (rule.op === '>')  return numVal > compVal;
      if (rule.op === '≥')  return numVal >= compVal;
      if (rule.op === '<')  return numVal < compVal;
      if (rule.op === '≤')  return numVal <= compVal;
      return false;
    }
    case 'within last N': {
      const rawMs = parseFIXTimestamp(rawValue);
      if (rawMs === null) return false;
      const n = parseFloat(rule.value as string);
      if (isNaN(n)) return false;
      const unitMs = rule.unit === 'h' ? 3_600_000 : rule.unit === 'm' ? 60_000 : 1_000;
      return rawMs >= Date.now() - n * unitMs;
    }
    case 'is one of':
      return (rule.value as string[]).includes(rawValue);
    case 'is not one of':
      return !(rule.value as string[]).includes(rawValue);
    default:
      return false;
  }
}
