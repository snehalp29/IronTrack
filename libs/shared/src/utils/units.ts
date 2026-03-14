import { UnitPreference } from '../enums';

const KG_TO_LB = 2.2046226218;

function roundWeight(value: number): number {
  return Number(value.toFixed(2));
}

export function kgToLb(value: number): number {
  return roundWeight(value * KG_TO_LB);
}

export function lbToKg(value: number): number {
  return roundWeight(value / KG_TO_LB);
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
