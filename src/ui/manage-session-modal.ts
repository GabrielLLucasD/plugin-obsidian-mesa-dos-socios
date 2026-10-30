import { Modal, Notice, Setting } from "obsidian";
import type { App } from "obsidian";
import type { HostingService } from "../application/hosting-service";

/** Adaptador de mestre: não disponibiliza operações administrativas por HTTP. */
export class ManageSessionModal extends Modal {
  constructor(app: App, private readonly hosting: HostingService, private readonly onDismiss: () => void = () => {}) { super(app); }

  onOpen(): void { this.render(); }
  onClose(): void { this.onDismiss(); this.contentEl.empty(); }

  private act(action: () => void): void {
    try { action(); this.render(); }
    catch (error) { new Notice(error instanceof Error ? error.message : "Falha na operação."); }
  }

  private copyField(label: string, value: string): void {
    let input: HTMLInputElement;
    new Setting(this.contentEl).setName(label)
      .addText((text) => {
        text.setValue(value);
        input = text.inputEl;
        input.readOnly = true;
        input.setAttribute("aria-label", label);
        input.spellcheck = false;
        input.style.userSelect = "text";
        input.addEventListener("focus", () => input.select());
        input.addEventListener("click", () => input.select());
      })
      .addButton((button) => button.setButtonText("Copiar").setTooltip(`Copiar ${label.toLowerCase()}`)
        .onClick(async () => {
          try {
            await navigator.clipboard.writeText(value);
            new Notice(`${label} copiado.`);
          } catch {
            input.focus(); input.select();
            new Notice("Não foi possível copiar automaticamente. Use Ctrl+C no campo selecionado.");
          }
        }));
  }

  private render(): void {
    this.contentEl.empty();
    this.titleEl.setText("Gerenciar sessão");
    const access = this.hosting.access;
    if (!access || !this.hosting.url) { this.contentEl.createEl("p", { text: "Nenhuma sessão hospedada." }); return; }
    const room = access.room;
    this.copyField("Endereço", this.hosting.url);
    this.copyField("Convite", access.invite);
    this.contentEl.createEl("p", { text: "Compartilhe o endereço e o convite. A entrada ainda depende da sua aprovação. O endereço atual funciona apenas neste computador." });
    this.contentEl.createEl("p", { text: `Vagas ocupadas: ${room.approvedPlayers}/${room.maxPlayers}` });
    new Setting(this.contentEl)
      .addButton((button) => button.setButtonText("Atualizar lista").onClick(() => this.act(() => {})))
      .addButton((button) => button.setButtonText("Novo convite").onClick(() => this.act(() => { access.rotateInvite(); })))
      .addButton((button) => button.setButtonText(room.acceptingRequests ? "Bloquear pedidos" : "Permitir pedidos")
        .onClick(() => this.act(() => access.setAccepting(!room.acceptingRequests))));

    this.contentEl.createEl("h3", { text: "Solicitações pendentes" });
    const requests = access.listRequests().filter((request) => request.status === "pending");
    if (!requests.length) this.contentEl.createEl("p", { text: "Nenhuma solicitação pendente." });
    for (const request of requests) {
      new Setting(this.contentEl).setName(request.displayName)
        .setDesc(`Pedido: ${request.id}`)
        .addButton((button) => button.setButtonText("Aprovar").onClick(() => this.act(() => { access.approve(request.id); })))
        .addButton((button) => button.setButtonText("Rejeitar").onClick(() => this.act(() => access.reject(request.id))));
    }
    this.contentEl.createEl("h3", { text: "Participantes aprovados" });
    for (const player of access.listPlayers()) {
      new Setting(this.contentEl).setName(player.displayName).setDesc(player.id)
        .addButton((button) => button.setButtonText("Remover e revogar").onClick(() => this.act(() => access.removePlayer(player.id))));
    }
    this.contentEl.createEl("p", { text: "Desconexão, logout ou expiração não liberam a vaga. Remova o participante para liberar ou autorizar uma nova entrada." });
  }
}
