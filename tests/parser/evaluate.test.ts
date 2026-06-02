import { describe, it, expect } from 'vitest';
import { evaluateFilterTree } from '../../src/parser/filter/evaluate';
import type { ParsedMessage } from '../../src/parser/types';
import type { FilterTree } from '../../src/parser/filter/types';

describe('evaluateFilterTree', () => {
  const msgs: ParsedMessage[] = [
    { index: 0, lineNumber: 1, rawText: '8=FIX.4.2|35=D|55=AAPL|44=150.0|38=100|54=1|', byTag: new Map([[8, 'FIX.4.2'], [35, 'D'], [55, 'AAPL'], [44, '150.0'], [38, '100'], [54, '1']]), version: 'FIX.4.2', warnings: [] },
    { index: 1, lineNumber: 2, rawText: '8=FIX.4.2|35=8|55=AAPL|44=151.0|38=100|54=2|', byTag: new Map([[8, 'FIX.4.2'], [35, '8'], [55, 'AAPL'], [44, '151.0'], [38, '100'], [54, '2']]), version: 'FIX.4.2', warnings: [] },
    { index: 2, lineNumber: 3, rawText: '8=FIX.4.2|35=D|55=MSFT|44=200.0|38=500|54=1|', byTag: new Map([[8, 'FIX.4.2'], [35, 'D'], [55, 'MSFT'], [44, '200.0'], [38, '500'], [54, '1']]), version: 'FIX.4.2', warnings: [] },
  ];

  // Messages with SendingTime for timestamp tests (tag 52)
  const tsBase = '20240115-09:33:00.000';
  const tsMid  = '20240115-09:33:49.842';
  const tsLate = '20240115-09:35:00.000';
  const tsMsgs: ParsedMessage[] = [
    { index: 0, lineNumber: 1, rawText: '', byTag: new Map([[52, tsBase]]), version: 'FIX.4.2', warnings: [] },
    { index: 1, lineNumber: 2, rawText: '', byTag: new Map([[52, tsMid]]),  version: 'FIX.4.2', warnings: [] },
    { index: 2, lineNumber: 3, rawText: '', byTag: new Map([[52, tsLate]]), version: 'FIX.4.2', warnings: [] },
  ];

  it('matches all with null tree and no regex', () => {
    const res = evaluateFilterTree(null, msgs);
    expect(res).toEqual(new Uint32Array([0, 1, 2]));
  });

  it('filters by global regex', () => {
    const res = evaluateFilterTree(null, msgs, 'MSFT');
    expect(res).toEqual(new Uint32Array([2]));
  });

  it('evaluates simple equals rule', () => {
    const tree: FilterTree = { kind: 'rule', tag: 35, op: 'equals', value: 'D' };
    const res = evaluateFilterTree(tree, msgs);
    expect(res).toEqual(new Uint32Array([0, 2]));
  });

  it('evaluates > rule', () => {
    const tree: FilterTree = { kind: 'rule', tag: 44, op: '>', value: '150' };
    const res = evaluateFilterTree(tree, msgs);
    expect(res).toEqual(new Uint32Array([1, 2]));
  });

  it('evaluates AND group', () => {
    const tree: FilterTree = {
      kind: 'group',
      combinator: 'AND',
      children: [
        { kind: 'rule', tag: 35, op: 'equals', value: 'D' },
        { kind: 'rule', tag: 55, op: 'equals', value: 'AAPL' }
      ]
    };
    const res = evaluateFilterTree(tree, msgs);
    expect(res).toEqual(new Uint32Array([0]));
  });

  it('evaluates OR group', () => {
    const tree: FilterTree = {
      kind: 'group',
      combinator: 'OR',
      children: [
        { kind: 'rule', tag: 55, op: 'equals', value: 'MSFT' },
        { kind: 'rule', tag: 35, op: 'equals', value: '8' }
      ]
    };
    const res = evaluateFilterTree(tree, msgs);
    expect(res).toEqual(new Uint32Array([1, 2]));
  });

  it('evaluates is one of', () => {
    const tree: FilterTree = { kind: 'rule', tag: 35, op: 'is one of', value: ['D', '8'] };
    const res = evaluateFilterTree(tree, msgs);
    expect(res).toEqual(new Uint32Array([0, 1, 2]));
  });
  
  it('timestamp > filters using FIX UTCTIMESTAMP format', () => {
    // Only the late message should survive SendingTime > mid
    const tree: FilterTree = { kind: 'rule', tag: 52, op: '>', value: '2024-01-15 09:33:49.842Z' };
    const res = evaluateFilterTree(tree, tsMsgs);
    expect(res).toEqual(new Uint32Array([2]));
  });

  it('timestamp < filters correctly', () => {
    const tree: FilterTree = { kind: 'rule', tag: 52, op: '<', value: '2024-01-15 09:33:49.842Z' };
    const res = evaluateFilterTree(tree, tsMsgs);
    expect(res).toEqual(new Uint32Array([0]));
  });

  it('timestamp filter accepts date-only user input', () => {
    // All three are on 2024-01-15; a > 2024-01-14 check should pass all
    const tree: FilterTree = { kind: 'rule', tag: 52, op: '>', value: '2024-01-14' };
    const res = evaluateFilterTree(tree, tsMsgs);
    expect(res).toEqual(new Uint32Array([0, 1, 2]));
  });

  it('timestamp filter accepts time-only-less input (no Z)', () => {
    const tree: FilterTree = { kind: 'rule', tag: 52, op: '>=', value: '2024-01-15 09:33:49.842' };
    // The alias ≥ is the stored op; use ≥ from the operator set
    const tree2: FilterTree = { kind: 'rule', tag: 52, op: '≥', value: '2024-01-15 09:33:49.842' };
    const res = evaluateFilterTree(tree2, tsMsgs);
    expect(res).toEqual(new Uint32Array([1, 2]));
  });

  it('before/after operators work for timestamps', () => {
    const after: FilterTree = { kind: 'rule', tag: 52, op: 'after', value: '2024-01-15 09:33:49.842Z' };
    expect(evaluateFilterTree(after, tsMsgs)).toEqual(new Uint32Array([2]));
    const before: FilterTree = { kind: 'rule', tag: 52, op: 'before', value: '2024-01-15 09:33:49.842Z' };
    expect(evaluateFilterTree(before, tsMsgs)).toEqual(new Uint32Array([0]));
  });

  it('handles absent tags correctly', () => {
    const res1 = evaluateFilterTree({ kind: 'rule', tag: 99, op: 'is empty', value: '' }, msgs);
    expect(res1).toEqual(new Uint32Array([0, 1, 2]));

    const res2 = evaluateFilterTree({ kind: 'rule', tag: 99, op: 'equals', value: 'A' }, msgs);
    expect(res2).toEqual(new Uint32Array([]));

    // Negation on absent tag: tag is certainly not equal to the value, so include.
    const res3 = evaluateFilterTree({ kind: 'rule', tag: 99, op: 'not equals', value: 'A' }, msgs);
    expect(res3).toEqual(new Uint32Array([0, 1, 2]));
  });

  it('≠ on absent tag matches (consistent with not equals)', () => {
    // Bug was: '≠' returned false for missing tags while 'not equals' returned true.
    const res = evaluateFilterTree({ kind: 'rule', tag: 99, op: '≠', value: 'A' }, msgs);
    expect(res).toEqual(new Uint32Array([0, 1, 2]));
  });

  it('is not one of on absent tag matches (tag is not one of any set)', () => {
    // Bug was: 'is not one of' short-circuited to false when the tag was missing.
    const res = evaluateFilterTree({ kind: 'rule', tag: 99, op: 'is not one of', value: ['A', 'B'] }, msgs);
    expect(res).toEqual(new Uint32Array([0, 1, 2]));
  });

  it('is not one of excludes messages whose tag value is in the list', () => {
    // Positive side: messages where tag 35 IS one of ['D','8'] must not appear.
    const res = evaluateFilterTree({ kind: 'rule', tag: 35, op: 'is not one of', value: ['D', '8'] }, msgs);
    expect(res).toEqual(new Uint32Array([]));
  });
});
