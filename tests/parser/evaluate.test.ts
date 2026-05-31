import { describe, it, expect } from 'vitest';
import { evaluateFilterTree } from '../../src/parser/filter/evaluate';
import type { ParsedMessage } from '../../src/parser/types';
import type { FilterTree } from '../../src/parser/filter/types';

describe('evaluateFilterTree', () => {
  const msgs: ParsedMessage[] = [
    { index: 0, rawText: '8=FIX.4.2|35=D|55=AAPL|44=150.0|38=100|54=1|', byTag: new Map([[8, 'FIX.4.2'], [35, 'D'], [55, 'AAPL'], [44, '150.0'], [38, '100'], [54, '1']]), version: 'FIX.4.2', warnings: [] },
    { index: 1, rawText: '8=FIX.4.2|35=8|55=AAPL|44=151.0|38=100|54=2|', byTag: new Map([[8, 'FIX.4.2'], [35, '8'], [55, 'AAPL'], [44, '151.0'], [38, '100'], [54, '2']]), version: 'FIX.4.2', warnings: [] },
    { index: 2, rawText: '8=FIX.4.2|35=D|55=MSFT|44=200.0|38=500|54=1|', byTag: new Map([[8, 'FIX.4.2'], [35, 'D'], [55, 'MSFT'], [44, '200.0'], [38, '500'], [54, '1']]), version: 'FIX.4.2', warnings: [] },
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
  
  it('handles absent tags correctly', () => {
    const res1 = evaluateFilterTree({ kind: 'rule', tag: 99, op: 'is empty', value: '' }, msgs);
    expect(res1).toEqual(new Uint32Array([0, 1, 2]));
    
    const res2 = evaluateFilterTree({ kind: 'rule', tag: 99, op: 'equals', value: 'A' }, msgs);
    expect(res2).toEqual(new Uint32Array([]));
    
    const res3 = evaluateFilterTree({ kind: 'rule', tag: 99, op: 'not equals', value: 'A' }, msgs);
    expect(res3).toEqual(new Uint32Array([0, 1, 2]));
  });
});
