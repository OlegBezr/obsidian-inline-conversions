import { App, PluginSettingTab } from "obsidian";
import type { SettingDefinitionItem } from "obsidian";
import type InlineConversionsPlugin from "./main";
import type { InlineConversionsSettings } from "./types";

type SettingKey = keyof InlineConversionsSettings;

const LIST_KEYS = new Set<SettingKey>([
  "previewCurrencies",
  "previewLengths",
  "previewMasses",
  "previewTemperatures",
]);

export class InlineConversionsSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: InlineConversionsPlugin) {
    super(app, plugin);
  }

  getSettingDefinitions(): SettingDefinitionItem<SettingKey>[] {
    return [
      {
        name: "Inline marker",
        desc: "Prefix inside inline code. With “cv”, write `cv: 100 EUR`.",
        control: {
          type: "text",
          key: "marker",
          defaultValue: "cv",
          validate: required("Inline marker"),
        },
      },
      {
        name: "Currency rates file",
        desc: "Vault-relative Markdown, JSON, or CSV file. Inline Conversions never downloads rates.",
        control: {
          type: "text",
          key: "ratesFile",
          placeholder: "Inline Conversions Rates.md",
          validate: required("Currency rates file"),
        },
      },
      textSetting("Primary currency", "Currency shown in note.", "primaryCurrency"),
      textSetting("Currency previews", "Currencies shown on hover, comma separated.", "previewCurrencies"),
      textSetting("Primary length", "Examples: m, km, ft, mi.", "primaryLength"),
      textSetting("Length previews", "Length units shown on hover, comma separated.", "previewLengths"),
      textSetting("Primary mass", "Examples: kg, g, lb, oz.", "primaryMass"),
      textSetting("Mass previews", "Mass units shown on hover, comma separated.", "previewMasses"),
      textSetting("Primary temperature", "C, F, or K.", "primaryTemperature"),
      textSetting("Temperature previews", "Temperature units shown on hover, comma separated.", "previewTemperatures"),
      {
        name: "Decimal places",
        desc: "Maximum digits after decimal point.",
        control: {
          type: "slider",
          key: "decimals",
          min: 0,
          max: 6,
          step: 1,
        },
      },
      {
        name: "Show original on hover",
        control: { type: "toggle", key: "showOriginal" },
      },
      {
        name: "Use familiar currency symbols",
        desc: "Use $, €, £, ₽, ¥, and ₾ where known; otherwise show ISO code.",
        control: { type: "toggle", key: "useCurrencySymbols" },
      },
      {
        name: "Reload rates",
        desc: this.plugin.ratesStatus,
        render: (setting) => {
          setting.addButton((button) => button.setButtonText("Reload").onClick(async () => {
            await this.plugin.loadRates(true);
            this.update();
          }));
        },
      },
      {
        name: "Create example rates file",
        desc: "Creates local template only when configured file does not exist.",
        render: (setting) => {
          setting.addButton((button) => button.setButtonText("Create").onClick(async () => {
            await this.plugin.createExampleRatesFile();
            this.update();
          }));
        },
      },
    ];
  }

  getControlValue(key: string): unknown {
    if (!isSettingKey(key)) return undefined;
    const value = this.plugin.settings[key];
    return Array.isArray(value) ? value.join(", ") : value;
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    if (!isSettingKey(key)) return;

    let normalized = value;
    if (LIST_KEYS.has(key)) {
      normalized = String(value)
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
    } else if (typeof this.plugin.settings[key] === "string") {
      normalized = String(value).trim();
    }

    await this.plugin.updateSettings({ [key]: normalized });
  }
}

function textSetting(
  name: string,
  desc: string,
  key: SettingKey,
): SettingDefinitionItem<SettingKey> {
  return {
    name,
    desc,
    control: { type: "text", key },
  };
}

function required(name: string): (value: string) => string | undefined {
  return (value) => value.trim() ? undefined : `${name} is required.`;
}

function isSettingKey(key: string): key is SettingKey {
  return key in SETTING_KEYS;
}

const SETTING_KEYS: Record<SettingKey, true> = {
  marker: true,
  ratesFile: true,
  primaryCurrency: true,
  previewCurrencies: true,
  primaryLength: true,
  previewLengths: true,
  primaryMass: true,
  previewMasses: true,
  primaryTemperature: true,
  previewTemperatures: true,
  decimals: true,
  showOriginal: true,
  useCurrencySymbols: true,
};
