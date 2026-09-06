import { describe, expect, it } from "vitest";
import { parseRatesFile } from "../src/rates";

describe("parseRatesFile", () => {
  it("reads JSON", () => {
    const rates = parseRatesFile(JSON.stringify({
      base: "USD",
      updated: "2026-09-06",
      rates: { EUR: 0.8, RUB: 80 },
    }), "rates.json");
    expect(rates).toMatchObject({ base: "USD", rates: { USD: 1, EUR: 0.8, RUB: 80 } });
  });

  it("reads Markdown frontmatter", () => {
    const rates = parseRatesFile(`---
base: EUR
updated: 2026-09-06
source: Manual
rates:
  USD: 1.25
  RUB: 100
---`, "rates.md");
    expect(rates).toMatchObject({ base: "EUR", source: "Manual", rates: { EUR: 1, USD: 1.25, RUB: 100 } });
  });

  it("reads CSV", () => {
    const rates = parseRatesFile("currency,rate\nBASE,USD\nEUR,0.8\nRUB,80", "rates.csv");
    expect(rates.rates).toMatchObject({ USD: 1, EUR: 0.8, RUB: 80 });
  });
});
