import { describe, expect, it } from "vitest";
import { parseFlexibleNumber, parseMarkedToken, parseValue } from "../src/parser";

describe("parseFlexibleNumber", () => {
  it.each([
    ["1,200.50", 1200.5],
    ["1.200,50", 1200.5],
    ["1 200,50", 1200.5],
    ["1'200.50", 1200.5],
    ["12,5", 12.5],
  ])("parses %s", (input, expected) => {
    expect(parseFlexibleNumber(input)).toBe(expected);
  });
});

describe("parseValue", () => {
  it.each([
    ["€1,200.50", "currency", 1200.5, "EUR"],
    ["1.200,50 EUR", "currency", 1200.5, "EUR"],
    ["USD 42", "currency", 42, "USD"],
    ["5' 11\"", "length", 5 + 11 / 12, "ft"],
    ["12 miles", "length", 12, "mi"],
    ["2.5 kg", "mass", 2.5, "kg"],
    ["72°F", "temperature", 72, "F"],
    ["20 Celsius", "temperature", 20, "C"],
  ])("parses %s", (input, kind, value, unit) => {
    expect(parseValue(input)).toMatchObject({ kind, value, unit });
  });

  it("requires the configured marker", () => {
    expect(parseMarkedToken("cv: 100 EUR")).toMatchObject({ kind: "currency", unit: "EUR" });
    expect(parseMarkedToken("price: 100 EUR")).toBeNull();
  });
});
