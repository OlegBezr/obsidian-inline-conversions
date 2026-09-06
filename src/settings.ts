import { App, PluginSettingTab, Setting } from "obsidian";
import type InlineConversionsPlugin from "./main";

export class InlineConversionsSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: InlineConversionsPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Inline Conversions" });

    new Setting(containerEl)
      .setName("Inline marker")
      .setDesc("The prefix inside inline code. With “cv”, write `cv: 100 EUR`.")
      .addText((text) => text
        .setValue(this.plugin.settings.marker)
        .onChange(async (value) => this.applyPatch({ marker: value.trim() || "cv" })));

    new Setting(containerEl)
      .setName("Currency rates file")
      .setDesc("Vault-relative Markdown, JSON, or CSV file. Inline Conversions never downloads rates.")
      .addText((text) => text
        .setPlaceholder("Inline Conversions Rates.md")
        .setValue(this.plugin.settings.ratesFile)
        .onChange(async (value) => this.applyPatch({ ratesFile: value.trim() })));

    this.addTextSetting("Primary currency", "Currency shown in the note.", "primaryCurrency");
    this.addListSetting("Currency previews", "Currencies shown on hover, comma separated.", "previewCurrencies");
    this.addTextSetting("Primary length", "Examples: m, km, ft, mi.", "primaryLength");
    this.addListSetting("Length previews", "Length units shown on hover.", "previewLengths");
    this.addTextSetting("Primary mass", "Examples: kg, g, lb, oz.", "primaryMass");
    this.addListSetting("Mass previews", "Mass units shown on hover.", "previewMasses");
    this.addTextSetting("Primary temperature", "C, F, or K.", "primaryTemperature");
    this.addListSetting("Temperature previews", "Temperature units shown on hover.", "previewTemperatures");

    new Setting(containerEl)
      .setName("Decimal places")
      .setDesc("Maximum digits after the decimal point.")
      .addSlider((slider) => slider
        .setLimits(0, 6, 1)
        .setDynamicTooltip()
        .setValue(this.plugin.settings.decimals)
        .onChange(async (value) => this.applyPatch({ decimals: value })));

    new Setting(containerEl)
      .setName("Show original on hover")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.showOriginal)
        .onChange(async (value) => this.applyPatch({ showOriginal: value })));

    new Setting(containerEl)
      .setName("Use familiar currency symbols")
      .setDesc("Use $, €, £, ₽, ¥, and ₾ where known; otherwise show the ISO code.")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.useCurrencySymbols)
        .onChange(async (value) => this.applyPatch({ useCurrencySymbols: value })));

    new Setting(containerEl)
      .setName("Reload rates")
      .setDesc(this.plugin.ratesStatus)
      .addButton((button) => button.setButtonText("Reload").onClick(async () => {
        await this.plugin.loadRates(true);
        this.display();
      }));

    new Setting(containerEl)
      .setName("Create example rates file")
      .setDesc("Creates a local template only when the configured file does not exist.")
      .addButton((button) => button.setButtonText("Create").onClick(async () => {
        await this.plugin.createExampleRatesFile();
        this.display();
      }));
  }

  private addTextSetting(
    name: string,
    description: string,
    key: "primaryCurrency" | "primaryLength" | "primaryMass" | "primaryTemperature",
  ): void {
    new Setting(this.containerEl)
      .setName(name)
      .setDesc(description)
      .addText((text) => text.setValue(this.plugin.settings[key]).onChange(async (value) => {
        await this.applyPatch({ [key]: value.trim() });
      }));
  }

  private addListSetting(
    name: string,
    description: string,
    key: "previewCurrencies" | "previewLengths" | "previewMasses" | "previewTemperatures",
  ): void {
    new Setting(this.containerEl)
      .setName(name)
      .setDesc(description)
      .addText((text) => text.setValue(this.plugin.settings[key].join(", ")).onChange(async (value) => {
        const values = value.split(",").map((part) => part.trim()).filter(Boolean);
        await this.applyPatch({ [key]: values });
      }));
  }

  private async applyPatch(patch: Partial<typeof this.plugin.settings>): Promise<void> {
    await this.plugin.updateSettings(patch);
  }
}
