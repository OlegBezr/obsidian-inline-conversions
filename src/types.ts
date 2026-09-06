export type ValueKind = "currency" | "length" | "mass" | "temperature";

export interface ParsedValue {
  kind: ValueKind;
  value: number;
  unit: string;
  original: string;
}

export interface CurrencyRates {
  base: string;
  rates: Record<string, number>;
  updated?: string;
  source?: string;
}

export interface InlineConversionsSettings {
  marker: string;
  ratesFile: string;
  primaryCurrency: string;
  previewCurrencies: string[];
  primaryLength: string;
  previewLengths: string[];
  primaryMass: string;
  previewMasses: string[];
  primaryTemperature: string;
  previewTemperatures: string[];
  decimals: number;
  showOriginal: boolean;
  useCurrencySymbols: boolean;
}

export interface RenderedValue {
  display: string;
  previewLines: string[];
  kind: ValueKind;
  valid: boolean;
}
