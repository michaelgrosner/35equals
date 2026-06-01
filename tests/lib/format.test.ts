import { describe, it, expect } from 'vitest';
import { formatValue } from '@/lib/format';

describe('formatValue', () => {
  it('formats UTCTIMESTAMP correctly', () => {
    const result = formatValue(52, '20260531-14:23:01.045');
    expect(result.text).toBe('2026-05-31 14:23:01.045Z');
    expect(result.align).toBe('right');
  });

  it('formats UTCDATEONLY correctly', () => {
    const result = formatValue(75, '20260531', 'UTCDATEONLY');
    expect(result.text).toBe('2026-05-31');
    expect(result.align).toBe('right');
  });

  it('formats PRICE with locale grouping', () => {
    const result = formatValue(44, '1234567.89');
    expect(result.text).toBe('1,234,567.89');
    expect(result.align).toBe('right');
  });

  it('formats INT with locale grouping', () => {
    const result = formatValue(34, '12345');
    expect(result.text).toBe('12,345');
    expect(result.align).toBe('right');
  });

  it('formats BOOLEAN correctly', () => {
    expect(formatValue(0, 'Y', 'BOOLEAN').text).toBe('✓');
    expect(formatValue(0, 'N', 'BOOLEAN').text).toBe('✗');
  });

  it('assigns correct tones for Side', () => {
    expect(formatValue(54, '1', 'CHAR', 'Buy').tone).toBe('emerald');
    expect(formatValue(54, '2', 'CHAR', 'Sell').tone).toBe('rose');
  });

  it('assigns correct tones for MsgType', () => {
    expect(formatValue(35, 'D', 'STRING', 'New Order Single').tone).toBe('sky');
    expect(formatValue(35, '0', 'STRING', 'Heartbeat').tone).toBe('slate');
    expect(formatValue(35, 'W', 'STRING', 'Snapshot').tone).toBe('emerald');
  });

  it('handles multiple values', () => {
    const result = formatValue(277, '1 2 3', 'MULTIPLEVALUESTRING' as any);
    expect(result.text).toBe('1 · 2 · 3');
  });
});
