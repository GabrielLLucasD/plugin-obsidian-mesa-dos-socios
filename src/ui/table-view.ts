import { ItemView, Notice, setIcon } from "obsidian";
import type { Modal, ViewStateResult, WorkspaceLeaf } from "obsidian";
import type { PlayerView } from "../shared/access-contracts";
import type { CampaignService } from "../application/campaign-service";
import type { CampaignTransfer } from "../infrastructure/vault-campaign-transfer";
import { ARCHIVE_LIMITS } from "../infrastructure/campaign-archive";
import { TextActionModal } from "./text-action-modal";
import { CampaignPicker } from "./campaign-picker";
import { DockLayout } from "./dock-layout";
import { defaultDockState, readDockState } from "./dock-state";
import { iconButton } from "./icon-button";
import tableStyles from "./table-view.css";

export const TABLE_VIEW_TYPE = "obsidian-vtt-table";
export type TableSession = { id: string; capacity: number; players: PlayerView[]; pending: number };
export type TableActions = { snapshot: () => TableSession | undefined; create: () => void; manage: () => void; end: () => void | Promise<void> };

/** A view recebe casos de uso e adaptadores; não interpreta YAML ou ZIP. */
export class TableView extends ItemView {
  private timer: ReturnType<typeof globalThis.setInterval> | undefined;
  private previous = "";
  private selected: string | undefined;
  private closed = true;
  private status!: HTMLElement;
  private list!: HTMLElement;
  private properties!: HTMLElement;
  private createButton!: HTMLButtonElement;
  private manageButton!: HTMLButtonElement;
  private entriesButton!: HTMLButtonElement;
  private endButton!: HTMLButtonElement;
  private exportButton!: HTMLButtonElement;
  private campaignLabel!: HTMLElement;
  private sceneList!: HTMLElement;
  private sceneHeading!: HTMLElement;
  private emptyHeading!: HTMLElement;
  private sceneId: string | undefined;
  private campaignSignature = "";
  private modal: Modal | undefined;
  private dock: DockLayout | undefined;
  private dockState = defaultDockState();
  private transferBusy = false;
  private readonly downloads = new Set<string>();
  private readonly downloadTimers = new Set<ReturnType<typeof globalThis.setTimeout>>();

  constructor(leaf: WorkspaceLeaf, private readonly actions: TableActions,
    private readonly campaigns: CampaignService, private readonly transfer: CampaignTransfer) {
    super(leaf);
    this.register(() => this.cleanup());
  }
  getViewType(): string { return TABLE_VIEW_TYPE; }
  getDisplayText(): string { return "Mesa"; }
  getIcon(): string { return "dices"; }
  getState(): Record<string, unknown> { return { dock: this.dock?.snapshot() ?? this.dockState }; }
  async setState(state: unknown, result: ViewStateResult): Promise<void> {
    if (state && typeof state === "object" && "dock" in state) {
      this.dockState = readDockState(state.dock); this.dock?.restore(this.dockState);
    }
    await super.setState(state, result);
  }

  async onOpen(): Promise<void> {
    this.cleanup(); this.closed = false;
    this.contentEl.empty();
    this.contentEl.createEl("style", { text: tableStyles });
    this.contentEl.addClass("vtt-table-view");
    const header = this.contentEl.createDiv({ cls: "vtt-table-header" });
    const title = header.createDiv();
    title.createEl("h2", { text: "Mesa do mestre" });
    this.status = title.createEl("p", { cls: "vtt-table-muted", attr: { "aria-live": "polite" } });
    const controls = header.createDiv({ cls: "vtt-table-actions" });
    this.createButton = this.button(controls, "Criar sessão", this.actions.create);
    this.createButton.addClass("mod-cta");
    this.manageButton = iconButton(controls, "user-plus", "Convidar e gerenciar sessão", this.actions.manage);
    this.endButton = iconButton(controls, "square", "Encerrar sessão", this.actions.end);
    const panels = iconButton(controls, "panels-top-left", "Painéis e layout", () => this.dock?.showMenu(panels));

    const layout = this.contentEl.createDiv();
    const main = this.contentEl.createEl("main", { cls: "vtt-table-stage" });
    const heading = main.createDiv({ cls: "vtt-table-stage-heading" });
    this.sceneHeading = heading.createEl("h3", { text: "Mesa" });
    iconButton(heading, "circle-help", "Ajuda da mesa", () => { new Notice("Selecione uma cena para prepará-la. Mapas, tokens e compartilhamento de cenas serão implementados depois. O servidor atual atende apenas neste computador.", 10000); });
    const canvas = main.createDiv({ cls: "vtt-table-canvas" });
    const empty = canvas.createDiv({ cls: "vtt-table-empty" });
    setIcon(empty.createDiv({ cls: "vtt-table-empty-icon", attr: { "aria-hidden": "true" } }), "map");
    this.emptyHeading = empty.createEl("h3", { text: "Selecione uma cena" });
    this.dock = new DockLayout(layout, main, this.dockState, (state) => {
      this.dockState = state; this.app.workspace.requestSaveLayout();
    });

    const campaign = this.dock.add("campaign", "Campanha", "Crie ou abra uma campanha no cofre. Importar e exportar usam ZIP com toda a pasta, incluindo notas privadas. Nenhum arquivo é enviado aos jogadores. Arraste o título para encaixar o painel.");
    const campaignTools = campaign.body.createDiv({ cls: "vtt-table-actions" });
    iconButton(campaignTools, "folder-plus", "Nova campanha", () => this.editText("Nova campanha", "Nome", "", (name) => this.campaigns.create(name)));
    iconButton(campaignTools, "folder-open", "Abrir campanha do cofre", () => this.openCampaign());
    iconButton(campaignTools, "import", "Importar campanha ZIP", () => this.chooseImport());
    this.exportButton = iconButton(campaignTools, "export", "Exportar campanha completa em ZIP", () => this.exportCampaign());
    this.campaignLabel = campaign.body.createEl("p", { cls: "vtt-campaign-name" });
    const scenesHeading = campaign.body.createDiv({ cls: "vtt-section-heading" });
    scenesHeading.createEl("h4", { text: "Cenas" });
    iconButton(scenesHeading, "plus", "Nova cena", () => {
      if (!this.campaigns.current) throw new Error("Crie ou abra uma campanha primeiro.");
      this.editText("Nova cena", "Nome", "", (name) => this.campaigns.addScene(name));
    });
    this.sceneList = campaign.body.createDiv({ cls: "vtt-table-scenes" });

    const people = this.dock.add("participants", "Participantes", "Participantes aprovados da sessão. Selecione alguém para ver seus detalhes. Aprovação não indica presença online. O controle de tokens será adicionado com a mesa.");
    this.entriesButton = iconButton(people.actions, "user-plus", "Gerenciar entradas", this.actions.manage);
    this.list = people.body;
    const properties = this.dock.add("properties", "Propriedades", "Detalhes da seleção atual. A atribuição e revogação de tokens serão disponibilizadas com os tokens.");
    this.properties = properties.body;
    const history = this.dock.add("history", "Histórico", "Histórico de eventos de jogo. Será preenchido quando as ações da mesa estiverem disponíveis.");
    history.body.createEl("p", { text: "Sem eventos", cls: "vtt-table-muted" });
    this.previous = ""; this.campaignSignature = ""; this.refresh();
    this.timer = globalThis.setInterval(() => this.refresh(), 1000);
  }
  async onClose(): Promise<void> {
    if (this.dock) this.dockState = this.dock.snapshot();
    this.cleanup(); this.dock = undefined;
    this.contentEl.empty(); this.contentEl.removeClass("vtt-table-view");
  }
  private cleanup(): void {
    this.closed = true;
    if (this.timer !== undefined) globalThis.clearInterval(this.timer);
    this.timer = undefined; this.modal?.close();
    for (const timer of this.downloadTimers) globalThis.clearTimeout(timer);
    this.downloadTimers.clear();
    for (const url of this.downloads) URL.revokeObjectURL(url);
    this.downloads.clear();
  }
  private button(parent: HTMLElement, text: string, action: () => void | Promise<void>): HTMLButtonElement {
    const button = parent.createEl("button", { text, attr: { type: "button" } });
    button.addEventListener("click", () => {
      void Promise.resolve().then(action).catch((error: unknown) => {
        new Notice(error instanceof Error ? error.message : "Não foi possível concluir a operação.");
      }).finally(() => this.refresh());
    });
    return button;
  }
  private refresh(): void {
    if (this.closed) return;
    this.refreshCampaign();
    const session = this.actions.snapshot();
    const signature = JSON.stringify(session ?? null);
    if (signature === this.previous) return;
    this.previous = signature;
    if (!session?.players.some((player) => player.id === this.selected)) this.selected = undefined;
    this.status.setText(session ? `${session.players.length}/${session.capacity} participantes` : "Sem sessão");
    this.createButton.hidden = !!session; this.manageButton.hidden = !session; this.endButton.hidden = !session;
    this.entriesButton.disabled = !session;
    this.list.empty();
    this.list.createEl("p", { cls: "vtt-table-muted", text: session ? `${session.pending} pedidos pendentes` : "Sem sessão" });
    for (const player of session?.players ?? []) {
      const button = this.button(this.list, player.displayName, () => {
        this.selected = player.id; this.renderProperties(session);
        this.list.querySelectorAll("button").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
      });
      button.addClass("vtt-table-participant"); button.setAttribute("aria-pressed", String(this.selected === player.id));
    }
    this.renderProperties(session);
  }
  private editText(title: string, label: string, value: string, save: (value: string) => Promise<void>): void {
    this.modal?.close();
    this.modal = new TextActionModal(this.app, title, label, value, async (next) => {
      if (this.closed) throw new Error("A mesa foi fechada.");
      await save(next); this.refresh();
    }, () => { this.modal = undefined; });
    this.modal.open();
  }
  private openCampaign(): void {
    this.modal?.close();
    this.modal = new CampaignPicker(this.app, (file) => {
      void this.campaigns.open(file.path).then(() => this.refresh()).catch((error: unknown) => new Notice(error instanceof Error ? error.message : "Falha ao abrir."));
    }, () => { this.modal = undefined; });
    this.modal.open();
  }
  private chooseImport(): void {
    if (this.transferBusy) throw new Error("Aguarde a transferência atual.");
    const input = this.contentEl.createEl("input", { attr: { type: "file", accept: ".zip,application/zip" } });
    input.hidden = true;
    input.addEventListener("cancel", () => input.remove(), { once: true });
    input.addEventListener("change", () => {
      const file = input.files?.[0]; input.remove();
      if (!file || this.closed) return;
      if (file.size > ARCHIVE_LIMITS.bytes) { new Notice("ZIP excede 128 MiB."); return; }
      this.transferBusy = true;
      void file.arrayBuffer().then((data) => {
        if (this.closed) return;
        const imported = this.transfer.inspect(new Uint8Array(data));
        this.editText("Importar campanha", "Nome da nova pasta", imported.name, async (name) => {
          if (this.transferBusy) throw new Error("Aguarde a transferência atual.");
          this.transferBusy = true;
          try { const path = await imported.restore(name); await this.campaigns.open(path); }
          finally { this.transferBusy = false; }
        });
      }).catch((error: unknown) => new Notice(error instanceof Error ? error.message : "ZIP inválido.")).finally(() => { this.transferBusy = false; });
    }, { once: true });
    input.click();
  }
  private async exportCampaign(): Promise<void> {
    if (this.transferBusy) throw new Error("Aguarde a transferência atual.");
    const current = this.campaigns.current;
    if (!current) throw new Error("Abra uma campanha primeiro.");
    this.transferBusy = true;
    try {
      const bytes = await this.transfer.export(current.path);
      if (this.closed) return;
      const url = URL.createObjectURL(new Blob([bytes.slice().buffer as ArrayBuffer], { type: "application/zip" }));
      this.downloads.add(url);
      const anchor = this.contentEl.createEl("a", { attr: { href: url, download: `${current.campaign.name.replace(/[<>:"/\\|?*]/g, "-")}.zip` } });
      anchor.click(); anchor.remove();
      const timer = globalThis.setTimeout(() => { URL.revokeObjectURL(url); this.downloads.delete(url); this.downloadTimers.delete(timer); }, 60_000);
      this.downloadTimers.add(timer);
    } finally { this.transferBusy = false; }
  }
  private refreshCampaign(): void {
    const document = this.campaigns.current;
    const signature = JSON.stringify([document?.path, document?.campaign, this.sceneId]);
    if (signature === this.campaignSignature) return;
    const scenes = document?.campaign.scenes ?? [];
    if (!scenes.some((scene) => scene.id === this.sceneId)) this.sceneId = scenes[0]?.id;
    this.campaignSignature = JSON.stringify([document?.path, document?.campaign, this.sceneId]);
    this.campaignLabel.setText(document?.campaign.name ?? "Nenhuma campanha");
    this.exportButton.disabled = !document;
    this.sceneList.empty();
    if (!scenes.length) this.sceneList.createEl("p", { text: "Nenhuma cena", cls: "vtt-table-muted" });
    for (const scene of scenes) {
      const row = this.sceneList.createDiv({ cls: "vtt-table-scene-row" });
      const select = this.button(row, scene.name, () => { this.sceneId = scene.id; this.refreshCampaign(); });
      select.setAttribute("aria-pressed", String(scene.id === this.sceneId)); select.addClass("vtt-table-scene-select");
      iconButton(row, "pencil", `Renomear ${scene.name}`, () => this.editText("Renomear cena", "Nome", scene.name, (name) => this.campaigns.renameScene(scene.id, name)));
      const remove = iconButton(row, "trash-2", `Remover ${scene.name}`, () => {
        remove.hidden = true;
        this.button(row, "Confirmar", async () => { await this.campaigns.removeScene(scene.id); });
        this.button(row, "Cancelar", () => { this.campaignSignature = ""; this.refreshCampaign(); });
      });
    }
    const current = scenes.find((scene) => scene.id === this.sceneId);
    this.sceneHeading.setText(current?.name ?? "Mesa");
    this.emptyHeading.setText(current ? "Cena vazia" : "Selecione uma cena");
  }
  private renderProperties(session: TableSession | undefined): void {
    this.properties.empty();
    const player = session?.players.find((item) => item.id === this.selected);
    if (player) {
      this.properties.createEl("h4", { text: player.displayName });
      this.properties.createEl("p", { text: "Aprovado", cls: "vtt-table-muted" });
    } else this.properties.createEl("p", { text: "Nada selecionado", cls: "vtt-table-muted" });
  }
}
