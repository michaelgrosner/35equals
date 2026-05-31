export type FilterOperator =
  // strings
  | 'contains' | 'equals' | 'not equals' | 'regex' | 'is empty' | 'is set'
  // numbers/dates
  | '=' | '≠' | '>' | '≥' | '<' | '≤' | 'between'
  // dates
  | 'before' | 'after' | 'within last N'
  // enums
  | 'is one of' | 'is not one of';

export interface FilterRule {
  kind: 'rule';
  tag: number;
  op: FilterOperator;
  value: string | string[]; // Array for 'between' or 'is one of', otherwise string
  unit?: 's' | 'm' | 'h'; // For 'within last N'
}

export interface FilterGroup {
  kind: 'group';
  combinator: 'AND' | 'OR';
  children: FilterTree[];
}

export type FilterTree = FilterRule | FilterGroup;
