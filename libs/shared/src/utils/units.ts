import { UnitPreference } from '../enums';

const KG_TO_LB = 2.2046226218;

export function kgToLb(value: number): number {
  return Number((value * KG_TO_LB).toFixed(2));
}

export function lbToKg(value: number): number {
  return Number((value / KG_TO_LB).toFixed(2));
}

export function formatWeight(
  valueKg: number,
  unitPreference: UnitPreference,
): string {
  if (unitPreference === UnitPreference.IMPERIAL) {
    return `${kgToLb(valueKg)} lb`;
  }

  return `${valueKg.toFixed(2)} kg`;
}
