import { describe, expect, it } from "vitest";
import { convert, DEFAULT_SETTINGS, renderValue } from "../src/converter";
import type { CurrencyRates, ParsedValue } from "../src/types";

const rates: CurrencyRates = {
  base: "USD",
  rates: { USD: 1, EUR: 0.8, RUB: 80 },
  updated: "2026-09-06",
  source: "Test rates",
};

describe("conversion", () => {
  it("converts currencies through the configured base", () => {
    const value: ParsedValue = { kind: "currency", value: 100, unit: "EUR", original: "100 EUR" };
    expect(convert(value, "USD", rates)).toBe(125);
    expect(convert(value, "RUB", rates)).toBe(10000);
  });

  it("converts physical units", () => {
    expect(convert({ kind: "length", value: 6, unit: "ft", original: "6 ft" }, "m", null))
      .toBeCloseTo(1.8288);
    expect(convert({ kind: "mass", value: 10, unit: "lb", original: "10 lb" }, "kg", null))
      .toBeCloseTo(4.5359237);
  });

  it("preserves standard casing for physical unit symbols", () => {
    expect(renderValue(
      { kind: "length", value: 6, unit: "ft", original: "6 ft" },
      DEFAULT_SETTINGS,
      null,
    ).display).toBe("1.83 m");
    expect(renderValue(
      { kind: "mass", value: 10, unit: "lb", original: "10 lb" },
      DEFAULT_SETTINGS,
      null,
    ).display).toBe("4.54 kg");
  });

  it("converts temperatures", () => {
    expect(convert({ kind: "temperature", value: 72, unit: "F", original: "72 F" }, "C", null))
      .toBeCloseTo(22.2222);
  });

  it("uses the preferred value for display and alternates for preview", () => {
    const rendered = renderValue(
      { kind: "currency", value: 100, unit: "EUR", original: "€100" },
      DEFAULT_SETTINGS,
      rates,
    );
    expect(rendered.display).toBe("$125");
    expect(rendered.previewLines).toContain("₽10,000");
    expect(rendered.previewLines.at(-1)).toBe("Rates: Test rates · 2026-09-06");
  });
});
