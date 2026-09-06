import type {
  CurrencyRates,
  ParsedValue,
  RenderedValue,
  InlineConversionsSettings,
} from "./types";

const LENGTH_TO_METERS: Record<string, number> = {
  mm: 0.001,
  cm: 0.01,
  m: 1,
  km: 1000,
  in: 0.0254,
  ft: 0.3048,
  yd: 0.9144,
  mi: 1609.344,
};

const MASS_TO_KILOGRAMS: Record<string, number> = {
  mg: 0.000001,
  g: 0.001,
  kg: 1,
  oz: 0.028349523125,
  lb: 0.45359237,
  st: 6.35029318,
  t: 1000,
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  RUB: "₽",
  JPY: "¥",
  GEL: "₾",
};

export const DEFAULT_SETTINGS: InlineConversionsSettings = {
  marker: "cv",
  ratesFile: "Inline Conversions Rates.md",
  primaryCurrency: "USD",
  previewCurrencies: ["USD", "RUB"],
  primaryLength: "m",
  previewLengths: ["m", "ft"],
  primaryMass: "kg",
  previewMasses: ["kg", "lb"],
  primaryTemperature: "C",
  previewTemperatures: ["C", "F"],
  decimals: 2,
  showOriginal: true,
  useCurrencySymbols: true,
};

export function renderValue(
  parsed: ParsedValue,
  settings: InlineConversionsSettings,
  rates: CurrencyRates | null,
): RenderedValue {
  const targets = targetsFor(parsed, settings);
  const primary = primaryFor(parsed, settings);
  const primaryValue = convert(parsed, primary, rates);

  if (primaryValue === null) {
    return {
      display: parsed.original,
      previewLines: ["Conversion unavailable", currencyProblem(parsed, primary, rates)],
      kind: parsed.kind,
      valid: false,
    };
  }

  const previewLines: string[] = [];
  if (settings.showOriginal) previewLines.push(`Original: ${parsed.original}`);

  for (const target of unique([primary, ...targets])) {
    const converted = convert(parsed, target, rates);
    if (converted !== null) previewLines.push(formatConverted(converted, target, parsed.kind, settings));
  }

  if (parsed.kind === "currency" && rates) {
    const metadata = [rates.source, rates.updated].filter(Boolean).join(" · ");
    if (metadata) previewLines.push(`Rates: ${metadata}`);
  }

  return {
    display: formatConverted(primaryValue, primary, parsed.kind, settings),
    previewLines,
    kind: parsed.kind,
    valid: true,
  };
}

export function convert(
  parsed: ParsedValue,
  target: string,
  rates: CurrencyRates | null,
): number | null {
  if (parsed.kind === "length") {
    const sourceFactor = LENGTH_TO_METERS[parsed.unit];
    const targetFactor = LENGTH_TO_METERS[target];
    return sourceFactor && targetFactor ? (parsed.value * sourceFactor) / targetFactor : null;
  }

  if (parsed.kind === "mass") {
    const sourceFactor = MASS_TO_KILOGRAMS[parsed.unit];
    const targetFactor = MASS_TO_KILOGRAMS[target];
    return sourceFactor && targetFactor ? (parsed.value * sourceFactor) / targetFactor : null;
  }

  if (parsed.kind === "temperature") return convertTemperature(parsed.value, parsed.unit, target);
  return convertCurrency(parsed.value, parsed.unit, target, rates);
}

function convertCurrency(
  value: number,
  source: string,
  target: string,
  rates: CurrencyRates | null,
): number | null {
  if (!rates) return null;
  const normalizedSource = source.toUpperCase();
  const normalizedTarget = target.toUpperCase();
  const sourceRate = normalizedSource === rates.base ? 1 : rates.rates[normalizedSource];
  const targetRate = normalizedTarget === rates.base ? 1 : rates.rates[normalizedTarget];
  if (!sourceRate || !targetRate) return null;
  return (value / sourceRate) * targetRate;
}

function convertTemperature(value: number, source: string, target: string): number | null {
  const normalizedSource = source.toUpperCase();
  const normalizedTarget = target.toUpperCase();
  if (!["C", "F", "K"].includes(normalizedSource) || !["C", "F", "K"].includes(normalizedTarget)) {
    return null;
  }

  let celsius = value;
  if (normalizedSource === "F") celsius = ((value - 32) * 5) / 9;
  if (normalizedSource === "K") celsius = value - 273.15;

  if (normalizedTarget === "F") return (celsius * 9) / 5 + 32;
  if (normalizedTarget === "K") return celsius + 273.15;
  return celsius;
}

function targetsFor(parsed: ParsedValue, settings: InlineConversionsSettings): string[] {
  if (parsed.kind === "currency") return settings.previewCurrencies.map((value) => value.toUpperCase());
  if (parsed.kind === "length") return settings.previewLengths;
  if (parsed.kind === "mass") return settings.previewMasses;
  return settings.previewTemperatures.map((value) => value.toUpperCase());
}

function primaryFor(parsed: ParsedValue, settings: InlineConversionsSettings): string {
  if (parsed.kind === "currency") return settings.primaryCurrency.toUpperCase();
  if (parsed.kind === "length") return settings.primaryLength;
  if (parsed.kind === "mass") return settings.primaryMass;
  return settings.primaryTemperature.toUpperCase();
}

function formatConverted(
  value: number,
  unit: string,
  kind: ParsedValue["kind"],
  settings: InlineConversionsSettings,
): string {
  const formatted = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: settings.decimals,
    minimumFractionDigits: 0,
  }).format(value);

  if (kind === "temperature") return `${formatted} °${unit.toUpperCase()}`;
  if (kind === "currency" && settings.useCurrencySymbols && CURRENCY_SYMBOLS[unit.toUpperCase()]) {
    return `${CURRENCY_SYMBOLS[unit.toUpperCase()]}${formatted}`;
  }
  return `${formatted} ${unit.toUpperCase()}`;
}

function currencyProblem(parsed: ParsedValue, primary: string, rates: CurrencyRates | null): string {
  if (parsed.kind !== "currency") return `Check the preferred ${parsed.kind} unit in settings.`;
  if (!rates) return "Currency rates file is missing or invalid.";
  return `Rates do not contain ${parsed.unit.toUpperCase()} or ${primary.toUpperCase()}.`;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
