import type { CurrencyRates } from "./types";

export function parseRatesFile(content: string, path: string): CurrencyRates {
  const extension = path.split(".").pop()?.toLowerCase();
  if (extension === "json") return normalizeRates(parseJson(content));
  if (extension === "csv") return normalizeRates(parseCsv(content));
  return normalizeRates(parseMarkdownFrontmatter(content));
}

function parseJson(content: string): unknown {
  return JSON.parse(content) as unknown;
}

function parseCsv(content: string): CurrencyRates {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) throw new Error("CSV rate file needs a header and at least one rate.");

  const header = lines[0].split(",").map((part) => part.trim().toLowerCase());
  const currencyIndex = header.indexOf("currency");
  const rateIndex = header.indexOf("rate");
  if (currencyIndex < 0 || rateIndex < 0) throw new Error("CSV header must contain currency,rate.");

  let base = "USD";
  let updated: string | undefined;
  let source: string | undefined;
  const rates: Record<string, number> = {};

  for (const line of lines.slice(1)) {
    const parts = line.split(",").map((part) => part.trim());
    const currency = parts[currencyIndex]?.toUpperCase();
    const rate = Number(parts[rateIndex]);
    if (currency === "BASE") base = parts[rateIndex]?.toUpperCase();
    else if (currency === "UPDATED") updated = parts[rateIndex];
    else if (currency === "SOURCE") source = parts[rateIndex];
    else if (currency && Number.isFinite(rate)) rates[currency] = rate;
  }
  return { base, rates, updated, source };
}

function parseMarkdownFrontmatter(content: string): CurrencyRates {
  const match = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
  if (!match) throw new Error("Markdown rate file needs YAML frontmatter.");

  let base = "USD";
  let updated: string | undefined;
  let source: string | undefined;
  let insideRates = false;
  const rates: Record<string, number> = {};

  for (const line of match[1].split(/\r?\n/)) {
    const topLevel = line.match(/^([A-Za-z_-]+):\s*(.*?)\s*$/);
    if (topLevel) {
      insideRates = topLevel[1].toLowerCase() === "rates";
      if (topLevel[1].toLowerCase() === "base") base = stripQuotes(topLevel[2]).toUpperCase();
      if (topLevel[1].toLowerCase() === "updated") updated = stripQuotes(topLevel[2]);
      if (topLevel[1].toLowerCase() === "source") source = stripQuotes(topLevel[2]);
      continue;
    }

    if (insideRates) {
      const rate = line.match(/^\s+([A-Za-z]{3,5}):\s*([0-9.eE+-]+)\s*$/);
      if (rate) rates[rate[1].toUpperCase()] = Number(rate[2]);
    }
  }
  return { base, rates, updated, source };
}

function normalizeRates(value: unknown): CurrencyRates {
  if (!value || typeof value !== "object") throw new Error("Rate file must contain an object.");
  const record = value as Record<string, unknown>;
  const nestedRates = record.rates && typeof record.rates === "object"
    ? (record.rates as Record<string, unknown>)
    : record;
  const base = typeof record.base === "string" ? record.base.toUpperCase() : "USD";
  const rates: Record<string, number> = {};

  for (const [currency, rawRate] of Object.entries(nestedRates)) {
    if (!/^[A-Za-z]{3,5}$/.test(currency)) continue;
    const rate = typeof rawRate === "number" ? rawRate : Number(rawRate);
    if (Number.isFinite(rate) && rate > 0) rates[currency.toUpperCase()] = rate;
  }
  rates[base] = 1;

  if (Object.keys(rates).length < 2) throw new Error("Rate file must contain at least one currency besides its base.");
  return {
    base,
    rates,
    updated: typeof record.updated === "string" ? record.updated : undefined,
    source: typeof record.source === "string" ? record.source : undefined,
  };
}

function stripQuotes(value: string): string {
  return value.replace(/^['"]|['"]$/g, "");
}
