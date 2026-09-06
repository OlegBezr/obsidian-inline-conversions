import { MarkdownView, Notice, Plugin, TFile, normalizePath } from "obsidian";
import type { EditorView } from "@codemirror/view";
import { DEFAULT_SETTINGS, renderValue } from "./converter";
import { createLivePreviewExtension } from "./live-preview";
import { parseMarkedToken } from "./parser";
import { parseRatesFile } from "./rates";
import { InlineConversionsSettingTab } from "./settings";
import type { CurrencyRates, InlineConversionsSettings, RenderedValue } from "./types";

const EXAMPLE_RATES = `---
base: USD
updated: 2026-09-06
source: Replace with your rate source
rates:
  USD: 1
  EUR: 0.86
  RUB: 80.00
  GBP: 0.75
  GEL: 2.70
---

# Inline Conversions currency rates

Rates mean “units of currency per one base currency”. Replace these example
numbers before relying on conversions. Inline Conversions never updates this file.
`;

export default class InlineConversionsPlugin extends Plugin {
  settings: InlineConversionsSettings = { ...DEFAULT_SETTINGS };
  rates: CurrencyRates | null = null;
  ratesStatus = "Rates have not been loaded.";
  revision = 0;

  async onload(): Promise<void> {
    const saved = (await this.loadData()) as Partial<InlineConversionsSettings> | null;
    this.settings = mergeSettings(saved);
    await this.loadRates(false);

    this.registerEditorExtension(createLivePreviewExtension(this));
    this.registerMarkdownPostProcessor((element) => this.decorateReadingMode(element));
    this.addSettingTab(new InlineConversionsSettingTab(this.app, this));

    this.addCommand({
      id: "reload-currency-rates",
      name: "Reload currency rates",
      callback: () => void this.loadRates(true),
    });
    this.addCommand({
      id: "create-example-rates-file",
      name: "Create example currency rates file",
      callback: () => void this.createExampleRatesFile(),
    });

    this.registerEvent(this.app.vault.on("create", (file) => {
      if (file instanceof TFile && file.path === normalizePath(this.settings.ratesFile)) {
        void this.loadRates(false);
      }
    }));
    this.registerEvent(this.app.vault.on("modify", (file) => {
      if (file instanceof TFile && file.path === normalizePath(this.settings.ratesFile)) {
        void this.loadRates(false);
      }
    }));
    this.registerEvent(this.app.vault.on("rename", () => void this.loadRates(false)));
    this.registerEvent(this.app.vault.on("delete", () => void this.loadRates(false)));
  }

  evaluateToken(token: string): RenderedValue | null {
    const parsed = parseMarkedToken(token, this.settings.marker);
    return parsed ? renderValue(parsed, this.settings, this.rates) : null;
  }

  createValueElement(token: string): HTMLElement {
    const rendered = this.evaluateToken(token);
    const element = document.createElement("span");
    if (!rendered) {
      element.textContent = `\`${token}\``;
      return element;
    }

    element.className = `inline-conversions inline-conversions--${rendered.kind}`;
    if (!rendered.valid) element.classList.add("inline-conversions--invalid");
    element.textContent = rendered.display;
    element.dataset.inlineConversionsPreview = rendered.previewLines.join("\n");
    element.tabIndex = 0;
    element.setAttribute("role", "button");
    element.setAttribute("aria-description", rendered.previewLines.join(". "));
    element.addEventListener("click", (event) => {
      event.preventDefault();
      element.classList.toggle("inline-conversions--open");
    });
    element.addEventListener("blur", () => element.classList.remove("inline-conversions--open"));
    element.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        element.classList.toggle("inline-conversions--open");
      }
      if (event.key === "Escape") element.classList.remove("inline-conversions--open");
    });
    return element;
  }

  async updateSettings(patch: Partial<InlineConversionsSettings>): Promise<void> {
    this.settings = mergeSettings({ ...this.settings, ...patch });
    await this.saveData(this.settings);
    await this.loadRates(false);
  }

  async loadRates(showNotice: boolean): Promise<void> {
    const path = normalizePath(this.settings.ratesFile);
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) {
      this.rates = null;
      this.ratesStatus = `No rate file at ${path}.`;
      this.refreshViews();
      if (showNotice) new Notice(this.ratesStatus);
      return;
    }

    try {
      this.rates = parseRatesFile(await this.app.vault.cachedRead(file), file.path);
      const details = [this.rates.source, this.rates.updated].filter(Boolean).join(" · ");
      this.ratesStatus = `Loaded ${Object.keys(this.rates.rates).length} currencies${details ? ` · ${details}` : ""}.`;
    } catch (error) {
      this.rates = null;
      this.ratesStatus = `Could not load rates: ${errorMessage(error)}`;
    }
    this.refreshViews();
    if (showNotice) new Notice(this.ratesStatus);
  }

  async createExampleRatesFile(): Promise<void> {
    const path = normalizePath(this.settings.ratesFile);
    if (this.app.vault.getAbstractFileByPath(path)) {
      new Notice(`Inline Conversions did not overwrite existing file: ${path}`);
      return;
    }

    const parent = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
    if (parent && !this.app.vault.getAbstractFileByPath(parent)) await this.app.vault.createFolder(parent);
    await this.app.vault.create(path, EXAMPLE_RATES);
    await this.loadRates(false);
    new Notice(`Created ${path}. Replace the example rates before use.`);
  }

  private decorateReadingMode(element: HTMLElement): void {
    for (const code of Array.from(element.querySelectorAll("code"))) {
      if (code.closest("pre")) continue;
      const token = code.textContent ?? "";
      if (!this.evaluateToken(token)) continue;
      code.replaceWith(this.createValueElement(token));
    }
  }

  private refreshViews(): void {
    this.revision += 1;
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (!(leaf.view instanceof MarkdownView)) return;
      const editor = leaf.view.editor as MarkdownView["editor"] & { cm?: EditorView };
      editor.cm?.dispatch({});
      leaf.view.previewMode.rerender(true);
    });
  }
}

function mergeSettings(saved: Partial<InlineConversionsSettings> | null): InlineConversionsSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...(saved ?? {}),
    previewCurrencies: saved?.previewCurrencies ?? [...DEFAULT_SETTINGS.previewCurrencies],
    previewLengths: saved?.previewLengths ?? [...DEFAULT_SETTINGS.previewLengths],
    previewMasses: saved?.previewMasses ?? [...DEFAULT_SETTINGS.previewMasses],
    previewTemperatures: saved?.previewTemperatures ?? [...DEFAULT_SETTINGS.previewTemperatures],
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
