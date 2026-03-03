import { Injectable } from '@nestjs/common';

interface SupersetItem<T> {
  supersetGroupKey: string | null | undefined;
  orderIndex: number;
  item: T;
}

@Injectable()
export class SupersetService {
  interleave<T>(entries: SupersetItem<T>[]): T[] {
    const normalizedEntries = entries.map((entry) => ({
      ...entry,
      supersetGroupKey: normalizeSupersetGroupKey(entry.supersetGroupKey),
    }));

    const groups = new Map<string, SupersetItem<T>[]>();
    const singleUnits = normalizedEntries
      .filter((entry) => entry.supersetGroupKey == null)
      .map((entry) => ({
        orderIndex: entry.orderIndex,
        items: [entry.item],
      }));

    for (const entry of normalizedEntries) {
      if (entry.supersetGroupKey == null) {
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

function normalizeSupersetGroupKey(
  key: string | null | undefined,
): string | null {
  if (key == null) {
    return null;
  }

  const trimmed = key.trim();
  return trimmed.length === 0 ? null : trimmed;
}
