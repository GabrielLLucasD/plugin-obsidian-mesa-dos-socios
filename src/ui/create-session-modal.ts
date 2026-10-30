import { Modal, Setting } from "obsidian";
import type { App } from "obsidian";

export class CreateSessionModal extends Modal {
  private readonly onCreate: (maxPlayers: number) => Promise<void>;
  private cleanup: (() => void) | undefined;
  private pending = false;
  private closed = false;
  private readonly onCancel: () => void;

  constructor(app: App, onCreate: (maxPlayers: number) => Promise<void>, onCancel: () => void, private readonly onDismiss: () => void = () => {}) {
    super(app);
    this.onCreate = onCreate;
    this.onCancel = onCancel;
  }

  onOpen(): void {
    this.closed = false;
    this.contentEl.empty();
    this.titleEl.setText("Criar sessão");

    const form = this.contentEl.createEl("form");
    // Exibimos as falhas de validação no próprio formulário.
    form.noValidate = true;

    const capacitySetting = new Setting(form)
      .setName("Máximo de jogadores")
      .setDesc("Obrigatório. O mestre não ocupa uma vaga.");

    let input: HTMLInputElement | undefined;
    capacitySetting.addText((text) => {
      input = text.inputEl;
      input.type = "number";
      input.min = "1";
      input.step = "1";
      input.required = true;
      input.placeholder = "Ex.: 4";
      input.setAttribute("aria-label", "Máximo de jogadores");
    });

    const errorEl = form.createEl("p", {
      attr: { role: "alert", "aria-live": "assertive" },
    });
    let createButton: HTMLButtonElement | undefined;

    new Setting(form)
      .addButton((button) => {
        button.buttonEl.type = "button";
        button.setButtonText("Cancelar").onClick(() => this.close());
      })
      .addButton((button) => {
        createButton = button.buttonEl;
        button.buttonEl.type = "submit";
        button.setButtonText("Criar sessão").setCta();
      });

    const submit = async (event: SubmitEvent): Promise<void> => {
      event.preventDefault();
      if (this.pending || this.closed) return;
      errorEl.setText("");
      input?.removeAttribute("aria-invalid");

      try {
        const value = input?.value.trim() ?? "";
        if (value === "") {
          throw new Error("Informe a quantidade máxima de jogadores.");
        }

        this.pending = true;
        if (createButton) createButton.disabled = true;
        await this.onCreate(Number(value));
        this.pending = false;
        this.close();
      } catch (error: unknown) {
        if (this.closed) return;
        errorEl.setText(
          error instanceof Error ? error.message : "Não foi possível criar a sessão.",
        );
        input?.setAttribute("aria-invalid", "true");
        input?.focus();
      } finally {
        this.pending = false;
        if (createButton) createButton.disabled = false;
      }
    };

    form.addEventListener("submit", submit);
    this.cleanup = () => form.removeEventListener("submit", submit);
    input?.focus();
  }

  onClose(): void {
    this.closed = true;
    this.onDismiss();
    if (this.pending) this.onCancel();
    this.cleanup?.();
    this.cleanup = undefined;
    this.contentEl.empty();
  }
}
