import { Injectable } from '@nestjs/common';

interface SupersetItem<T> {
  supersetGroupKey: string | null;
  orderIndex: number;
  item: T;
}

@Injectable()
export class SupersetService {
  interleave<T>(entries: SupersetItem<T>[]): T[] {
    const groups = new Map<string, SupersetItem<T>[]>();
    const singleUnits = entries
      .filter((entry) => !entry.supersetGroupKey)
      .map((entry) => ({
        orderIndex: entry.orderIndex,
        items: [entry.item],
      }));

    for (const entry of entries) {
      if (!entry.supersetGroupKey) {
        continue;
      }
      groups.set(entry.supersetGroupKey, [
        ...(groups.get(entry.supersetGroupKey) ?? []),
        entry,
      ]);
    }

    const groupUnits = Array.from(groups.values()).map((group) => {
      const sorted = [...group].sort((a, b) => a.orderIndex - b.orderIndex);
      return {
        orderIndex: sorted[0]!.orderIndex,
        items: sorted.map((entry) => entry.item),
      };
    });

    return [...singleUnits, ...groupUnits]
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .flatMap((unit) => unit.items);
  }
}
