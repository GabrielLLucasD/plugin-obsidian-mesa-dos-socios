import { FuzzySuggestModal, TFile } from "obsidian";
import type { App } from "obsidian";

export class CampaignPicker extends FuzzySuggestModal<TFile> {
  constructor(app: App, private readonly choose: (file: TFile) => void, private readonly dismissed: () => void) {
    super(app); this.setPlaceholder("Buscar campanha no cofre…");
  }
  getItems(): TFile[] { return this.app.vault.getFiles().filter((file) => file.name === "campanha.yaml"); }
  getItemText(file: TFile): string { return file.path; }
  onChooseItem(file: TFile): void { this.choose(file); }
  onClose(): void { super.onClose(); this.dismissed(); }
}
