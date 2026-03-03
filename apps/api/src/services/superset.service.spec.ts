import { SupersetService } from './superset.service';

describe('SupersetService', () => {
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
});
