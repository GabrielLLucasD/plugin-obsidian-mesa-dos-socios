import { Modal, Setting } from "obsidian";
import type { App } from "obsidian";

export class TextActionModal extends Modal {
  constructor(app: App, private readonly title: string, private readonly label: string,
    private readonly initial: string, private readonly submit: (value: string) => Promise<void>,
    private readonly dismissed: () => void) { super(app); }
  onOpen(): void {
    this.titleEl.setText(this.title);
    const form = this.contentEl.createEl("form");
    let value = this.initial;
    const setting = new Setting(form).setName(this.label);
    setting.addText((text) => { text.setValue(value).onChange((next) => { value = next; }); text.inputEl.required = true; text.inputEl.focus(); });
    const error = form.createEl("p", { attr: { role: "alert" } });
    const button = form.createEl("button", { text: "Salvar", cls: "mod-cta", attr: { type: "submit" } });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (button.disabled) return;
      button.disabled = true;
      void this.submit(value).then(() => this.close()).catch((failure: unknown) => {
        error.setText(failure instanceof Error ? failure.message : "Falha ao salvar.");
      }).finally(() => { button.disabled = false; });
    });
  }
  onClose(): void { this.dismissed(); this.contentEl.empty(); }
}
