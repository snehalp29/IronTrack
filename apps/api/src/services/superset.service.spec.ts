import { SupersetService } from './superset.service';

describe('SupersetService', () => {
  it('returns an empty list when no entries are provided', () => {
    const service = new SupersetService();

    expect(service.interleave<string>([])).toEqual([]);
  });

  it('keeps superset groups aligned to overall orderIndex flow', () => {
    const service = new SupersetService();

    const ordered = service.interleave<string>([
      { supersetGroupKey: null, orderIndex: 0, item: 'single-0' },
      { supersetGroupKey: 'A', orderIndex: 1, item: 'A-1' },
      { supersetGroupKey: null, orderIndex: 2, item: 'single-2' },
      { supersetGroupKey: 'A', orderIndex: 3, item: 'A-3' },
    ]);

    expect(ordered).toEqual(['single-0', 'A-1', 'A-3', 'single-2']);
  });

  it('normalizes superset group keys before grouping', () => {
    const service = new SupersetService();

    const ordered = service.interleave<string>([
      { supersetGroupKey: null, orderIndex: 0, item: 'single-0' },
      { supersetGroupKey: 'A', orderIndex: 1, item: 'A-1' },
      { supersetGroupKey: null, orderIndex: 2, item: 'single-2' },
      { supersetGroupKey: ' A ', orderIndex: 3, item: 'A-3' },
    ]);

    expect(ordered).toEqual(['single-0', 'A-1', 'A-3', 'single-2']);
  });

  it('treats blank superset group keys as ungrouped entries', () => {
    const service = new SupersetService();

    const ordered = service.interleave<string>([
      { supersetGroupKey: '   ', orderIndex: 0, item: 'single-0' },
      { supersetGroupKey: 'A', orderIndex: 1, item: 'A-1' },
      { supersetGroupKey: 'A', orderIndex: 2, item: 'A-2' },
    ]);

    expect(ordered).toEqual(['single-0', 'A-1', 'A-2']);
  });

  it('uses first appearance order to break ties when orderIndex is equal', () => {
    const service = new SupersetService();

    const ordered = service.interleave<string>([
      { supersetGroupKey: 'B', orderIndex: 1, item: 'B-1' },
      { supersetGroupKey: null, orderIndex: 1, item: 'single-1' },
      { supersetGroupKey: 'A', orderIndex: 1, item: 'A-1' },
      { supersetGroupKey: 'B', orderIndex: 2, item: 'B-2' },
      { supersetGroupKey: 'A', orderIndex: 2, item: 'A-2' },
    ]);

    expect(ordered).toEqual(['B-1', 'B-2', 'single-1', 'A-1', 'A-2']);
  });
});
