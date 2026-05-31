import type { FilterTree, FilterRule, FilterGroup } from './types';
import type { ParsedMessage } from '../types';

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
    case 'between': {
      const numVal = parseFloat(rawValue);
      if (isNaN(numVal)) return String(rawValue).localeCompare(String(rule.value)) > 0;
      
      if (rule.op === 'between') {
         const limits = rule.value as string[];
         if (limits.length !== 2) return false;
         return numVal >= parseFloat(limits[0]!) && numVal <= parseFloat(limits[1]!);
      }
      
      const compVal = parseFloat(rule.value as string);
      if (rule.op === '>') return numVal > compVal;
      if (rule.op === '≥') return numVal >= compVal;
      if (rule.op === '<') return numVal < compVal;
      if (rule.op === '≤') return numVal <= compVal;
      return false;
    }
    case 'is one of':
      return (rule.value as string[]).includes(rawValue);
    case 'is not one of':
      return !(rule.value as string[]).includes(rawValue);
    case 'before':
    case 'after':
    case 'within last N':
      return false; 
    default:
      return false;
  }
}
