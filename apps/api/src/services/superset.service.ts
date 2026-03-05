import { Injectable } from '@nestjs/common';

interface SupersetItem<T> {
  supersetGroupKey: string | null | undefined;
  orderIndex: number;
  item: T;
}

interface OrderedUnit<T> {
  orderIndex: number;
  sequence: number;
  items: T[];
}

type NormalizedSupersetItem<T> = SupersetItem<T> & {
  supersetGroupKey: string | null;
  sequence: number;
};

@Injectable()
export class SupersetService {
  interleave<T>(entries: SupersetItem<T>[]): T[] {
    const normalizedEntries: NormalizedSupersetItem<T>[] = entries.map(
      (entry, sequence) => ({
        ...entry,
        sequence,
        supersetGroupKey: normalizeSupersetGroupKey(entry.supersetGroupKey),
      }),
    );

    const groups = new Map<string, NormalizedSupersetItem<T>[]>();
    const singleUnits: OrderedUnit<T>[] = normalizedEntries
      .filter((entry) => entry.supersetGroupKey == null)
      .map((entry) => ({
        orderIndex: entry.orderIndex,
        sequence: entry.sequence,
        items: [entry.item],
      }));

    for (const entry of normalizedEntries) {
      if (entry.supersetGroupKey == null) {
        continue;
      }
      const existingGroup = groups.get(entry.supersetGroupKey);
      if (existingGroup) {
        existingGroup.push(entry);
        continue;
      }

      groups.set(entry.supersetGroupKey, [entry]);
    }

    const groupUnits: OrderedUnit<T>[] = Array.from(groups.values()).map(
      (group) => {
        const sorted = [...group].sort((a, b) => a.orderIndex - b.orderIndex);
        return {
          orderIndex: sorted[0]!.orderIndex,
          sequence: Math.min(...sorted.map((entry) => entry.sequence)),
          items: sorted.map((entry) => entry.item),
        };
      },
    );

    return [...singleUnits, ...groupUnits]
      .sort((a, b) =>
        a.orderIndex !== b.orderIndex
          ? a.orderIndex - b.orderIndex
          : a.sequence - b.sequence,
      )
      .flatMap((unit) => unit.items);
  }
}

function normalizeSupersetGroupKey(
  key: string | null | undefined,
): string | null {
  if (key == null) {
    return null;
  }

  const trimmed = key.trim();
  return trimmed.length === 0 ? null : trimmed;
}
