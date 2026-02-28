import { Injectable } from '@nestjs/common';

interface SupersetItem<T> {
  supersetGroupKey: string | null;
  orderIndex: number;
  item: T;
}

@Injectable()
export class SupersetService {
  interleave<T>(entries: SupersetItem<T>[]): T[] {
    const singles = entries
      .filter((entry) => !entry.supersetGroupKey)
      .sort((a, b) => a.orderIndex - b.orderIndex);
    const groups = new Map<string, SupersetItem<T>[]>();

    for (const entry of entries) {
      if (!entry.supersetGroupKey) {
        continue;
      }
      groups.set(entry.supersetGroupKey, [
        ...(groups.get(entry.supersetGroupKey) ?? []),
        entry,
      ]);
    }

    const interleavedGroups = Array.from(groups.values()).flatMap((group) => {
      const sorted = [...group].sort((a, b) => a.orderIndex - b.orderIndex);
      return sorted.map((entry) => entry.item);
    });

    return [...singles.map((single) => single.item), ...interleavedGroups];
  }
}
