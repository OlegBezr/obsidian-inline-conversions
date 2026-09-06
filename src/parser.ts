import type { ParsedValue } from "./types";

const CURRENCY_SYMBOLS: Record<string, string> = {
  "$": "USD",
  "US$": "USD",
  "€": "EUR",
  "£": "GBP",
  "₽": "RUB",
  "¥": "JPY",
  "￥": "JPY",
  "₾": "GEL",
};

const LENGTH_UNITS: Record<string, string> = {
  mm: "mm",
  millimeter: "mm",
  millimeters: "mm",
  millimetre: "mm",
  millimetres: "mm",
  cm: "cm",
  centimeter: "cm",
  centimeters: "cm",
  centimetre: "cm",
  centimetres: "cm",
  m: "m",
  meter: "m",
  meters: "m",
  metre: "m",
  metres: "m",
  km: "km",
  kilometer: "km",
  kilometers: "km",
  kilometre: "km",
  kilometres: "km",
  in: "in",
  inch: "in",
  inches: "in",
  '"': "in",
  ft: "ft",
  foot: "ft",
  feet: "ft",
  "'": "ft",
  "′": "ft",
  yd: "yd",
  yard: "yd",
  yards: "yd",
  mi: "mi",
  mile: "mi",
  miles: "mi",
};

const MASS_UNITS: Record<string, string> = {
  mg: "mg",
  milligram: "mg",
  milligrams: "mg",
  g: "g",
  gram: "g",
  grams: "g",
  kg: "kg",
  kilogram: "kg",
  kilograms: "kg",
  oz: "oz",
  ounce: "oz",
  ounces: "oz",
  lb: "lb",
  lbs: "lb",
  pound: "lb",
  pounds: "lb",
  st: "st",
  stone: "st",
  stones: "st",
  t: "t",
  tonne: "t",
  tonnes: "t",
};

const TEMPERATURE_UNITS: Record<string, string> = {
  c: "C",
  "°c": "C",
  celsius: "C",
  f: "F",
  "°f": "F",
  fahrenheit: "F",
  k: "K",
  "°k": "K",
  kelvin: "K",
};

const NUMBER_SOURCE = "[+-]?[0-9][0-9\\s\\u00a0.,'’]*";

export function parseMarkedToken(text: string, marker = "cv"): ParsedValue | null {
  const escapedMarker = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(new RegExp(`^\\s*${escapedMarker}\\s*:\\s*(.+?)\\s*$`, "i"));
  return match ? parseValue(match[1]) : null;
}

export function parseValue(input: string): ParsedValue | null {
  const raw = input.trim();
  if (!raw) return null;

  const compound = parseCompoundLength(raw);
  if (compound) return compound;

  const symbolPattern = Object.keys(CURRENCY_SYMBOLS)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join("|");

  let match = raw.match(new RegExp(`^(${symbolPattern})\\s*(${NUMBER_SOURCE})$`, "i"));
  if (match) return currencyValue(raw, match[2], CURRENCY_SYMBOLS[canonicalSymbol(match[1])]);

  match = raw.match(new RegExp(`^(${NUMBER_SOURCE})\\s*(${symbolPattern})$`, "i"));
  if (match) return currencyValue(raw, match[1], CURRENCY_SYMBOLS[canonicalSymbol(match[2])]);

  match = raw.match(new RegExp(`^(${NUMBER_SOURCE})\\s*([°a-zA-Z\"'′]+)$`, "i"));
  if (match) {
    const parsed = unitValue(raw, match[1], match[2]);
    if (parsed) return parsed;
  }

  match = raw.match(new RegExp(`^([A-Za-z]{3,5})\\s*(${NUMBER_SOURCE})$`));
  if (match) return currencyValue(raw, match[2], match[1].toUpperCase());

  match = raw.match(new RegExp(`^(${NUMBER_SOURCE})\\s*([A-Za-z]{3,5})$`));
  if (match) return currencyValue(raw, match[1], match[2].toUpperCase());

  return null;
}

export function parseFlexibleNumber(input: string): number | null {
  let value = input.trim().replace(/[\s\u00a0'’]/g, "");
  if (!value) return null;

  const comma = value.lastIndexOf(",");
  const dot = value.lastIndexOf(".");

  if (comma >= 0 && dot >= 0) {
    const decimalSeparator = comma > dot ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    value = value.split(thousandsSeparator).join("");
    if (decimalSeparator === ",") value = value.replace(",", ".");
  } else if (comma >= 0) {
    const groups = value.split(",");
    if (groups.length > 2 || (groups.length === 2 && /^\d{3}$/.test(groups[1]))) {
      value = groups.join("");
    } else {
      value = value.replace(",", ".");
    }
  } else if ((value.match(/\./g) ?? []).length > 1) {
    const groups = value.split(".");
    if (groups.slice(1).every((part) => /^\d{3}$/.test(part))) value = groups.join("");
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseCompoundLength(raw: string): ParsedValue | null {
  const feetInches = raw.match(
    new RegExp(`^(${NUMBER_SOURCE})\\s*(?:ft|feet|foot|'|′)\\s*(${NUMBER_SOURCE})\\s*(?:in|inch|inches|\")$`, "i"),
  );
  if (!feetInches) return null;

  const feet = parseFlexibleNumber(feetInches[1]);
  const inches = parseFlexibleNumber(feetInches[2]);
  if (feet === null || inches === null) return null;

  return { kind: "length", value: feet + inches / 12, unit: "ft", original: raw };
}

function unitValue(raw: string, numeric: string, candidateUnit: string): ParsedValue | null {
  const value = parseFlexibleNumber(numeric);
  if (value === null) return null;
  const key = candidateUnit.toLowerCase();

  if (LENGTH_UNITS[key]) return { kind: "length", value, unit: LENGTH_UNITS[key], original: raw };
  if (MASS_UNITS[key]) return { kind: "mass", value, unit: MASS_UNITS[key], original: raw };
  if (TEMPERATURE_UNITS[key]) {
    return { kind: "temperature", value, unit: TEMPERATURE_UNITS[key], original: raw };
  }
  return null;
}

function currencyValue(raw: string, numeric: string, unit?: string): ParsedValue | null {
  if (!unit) return null;
  const value = parseFlexibleNumber(numeric);
  return value === null ? null : { kind: "currency", value, unit, original: raw };
}

function canonicalSymbol(value: string): string {
  return value.toUpperCase() === "US$" ? "US$" : value;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
