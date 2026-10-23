import { Modal, Setting } from "obsidian";
import type { App } from "obsidian";

export class CreateSessionModal extends Modal {
  private readonly onCreate: (maxPlayers: number) => void;
  private cleanup: (() => void) | undefined;

  constructor(app: App, onCreate: (maxPlayers: number) => void) {
    super(app);
    this.onCreate = onCreate;
  }

  onOpen(): void {
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

    new Setting(form)
      .addButton((button) => {
        button.buttonEl.type = "button";
        button.setButtonText("Cancelar").onClick(() => this.close());
      })
      .addButton((button) => {
        button.buttonEl.type = "submit";
        button.setButtonText("Criar sessão").setCta();
      });

    const submit = (event: SubmitEvent): void => {
      event.preventDefault();
      errorEl.setText("");
      input?.removeAttribute("aria-invalid");

      try {
        const value = input?.value.trim() ?? "";
        if (value === "") {
          throw new Error("Informe a quantidade máxima de jogadores.");
        }

        this.onCreate(Number(value));
        this.close();
      } catch (error: unknown) {
        errorEl.setText(
          error instanceof Error ? error.message : "Não foi possível criar a sessão.",
        );
        input?.setAttribute("aria-invalid", "true");
        input?.focus();
      }
    };

    form.addEventListener("submit", submit);
    this.cleanup = () => form.removeEventListener("submit", submit);
    input?.focus();
  }

  onClose(): void {
    this.cleanup?.();
    this.cleanup = undefined;
    this.contentEl.empty();
  }
}
